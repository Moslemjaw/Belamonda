// Session outcomes at the clinic: cancel, complete (cashback reward + POS deduction), no-show.
// Routes handle HTTP and notifications; these functions decide and persist. Refusals are
// thrown as ApiError with the same status/code/message the routes always returned.
import mongoose from "mongoose";
import * as userOfferService from "../../services/userOffer.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore } from "./sessions.store.js";
import { bookingRequestsStore } from "./bookingRequests.store.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { PaymentModel } from "../../models/payment.model.js";
import { ScanLogModel } from "../../models/scanLog.model.js";
import { incrementMetric } from "../../services/metric.service.js";
import { logAuditAction } from "../../services/audit.service.js";
import { kwdToMils } from "../../utils/money.js";
import { withTransaction } from "../../db/transaction.js";
import { ApiError } from "../../utils/apiError.js";
import { canActOnClinic, loadOffer, loadUserOffer } from "./scheduling.helpers.js";

type Actor = { userId: string; role: string; clinicId?: string };

export type MarkInput = {
  status: "completed" | "no_show" | "cancelled" | string;
  notes?: string;
  cashbackToDeductKwd?: string;
  extraItems?: Array<{ name: string; priceKwd: string; qty: number }>;
};

export async function markSession(actor: Actor, sessionId: string, input: MarkInput) {
  const session = await sessionsStore.get(sessionId);
  if (!session) throw new ApiError(404, "NOT_FOUND");
  if (!(await canActOnClinic(actor, String(session.clinicId)))) throw new ApiError(403, "FORBIDDEN_CLINIC");

  const uo = session.userOfferId ? await loadUserOffer(session.userOfferId) : null;

  // For cancellations, skip offer validation — allow cancelling orphaned or expired sessions
  if (input.status === "cancelled") {
    const { result, breq } = await withTransaction(async () => {
      const result = await sessionsStore.mark({ sessionId, status: "cancelled", markedBy: actor.userId, notes: input.notes });
      if (session.userOfferId && mongoose.isValidObjectId(session.userOfferId)) {
        await UserOfferModel.findOneAndUpdate(
          { _id: session.userOfferId, sessionsUsed: { $gt: 0 } },
          { $inc: { sessionsUsed: -1 } }
        );
      }
      const breq = await bookingRequestsStore.findBySessionId(session.id);
      if (breq) await bookingRequestsStore.update(breq.id, { status: "cancelled" });
      return { result, breq };
    });
    return { kind: "cancelled" as const, session, result, breq };
  }

  if (session.userOfferId) {
    // A session booked inside the membership validity can still be marked after the
    // membership expires (e.g. the clinic records yesterday's visit today).
    const withinValidity = !!uo?.expiresAt && new Date(session.scheduledAt) <= new Date(uo.expiresAt);
    if (!uo || !(uo.status === "active" || (uo.status === "expired" && withinValidity))) {
      throw new ApiError(409, "OFFER_NOT_ACTIVE");
    }
    const offer = await loadOffer(uo.offerId);
    if (!offer) throw new ApiError(400, "OFFER_NOT_FOUND");
  }

  let cashbackUnlocked = "0.000";
  if (input.status === "completed") {
    if (actor.role === "clinicStaff") {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hasScan = await ScanLogModel.exists({
        userId: session.userId,
        clinicId: actor.clinicId || session.clinicId,
        scannedAt: { $gte: twentyFourHoursAgo }
      });
      if (!hasScan) {
        throw new ApiError(403, "SCAN_REQUIRED", {
          message: "Clinic staff cannot mark sessions as completed manually. Attendance must be recorded via QR card scan."
        });
      }
    }

    // A session can't be completed before its scheduled date (admins may)
    if (session.scheduledAt) {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (new Date(session.scheduledAt) > endOfToday && actor.role !== "admin") {
        throw new ApiError(400, "FUTURE_SESSION_NOT_ALLOWED", {
          message: "Cannot mark a session as completed before its scheduled date."
        });
      }
    }

    if (uo) {
      const offer = await loadOffer(uo.offerId);
      if (offer) cashbackUnlocked = offer.cashbackPerSessionKwd ?? "0.000";
    }
  }

  // Reward, POS deduction, session status and booking-request sync commit together, so a
  // failed deduction can't leave the reward granted (and granted again on retry).
  const updated = await withTransaction(async () => {
    if (input.status === "completed" && uo && parseFloat(cashbackUnlocked) > 0) {
      await kycStore.rewardSessionCashback({ userId: uo.userId, amountKwd: cashbackUnlocked, sessionId: session.id, createdById: "system" });
    }

    if (input.status === "completed" && input.cashbackToDeductKwd && parseFloat(input.cashbackToDeductKwd) > 0) {
      const deductionAmount = parseFloat(input.cashbackToDeductKwd);
      const resAdjust = await kycStore.deductUnlocked({
        userId: session.userId,
        amountKwd: deductionAmount.toFixed(3),
        reference: { kind: "session", id: session.id },
        createdBy: { kind: "admin", id: actor.userId }
      });
      if ("error" in resAdjust) throw new ApiError(400, resAdjust.error ?? "CASHBACK_DEDUCTION_FAILED");
      if (session.userOfferId) {
        await userOfferService.adjustCashbackBalance(session.userOfferId, -kwdToMils(deductionAmount), { onlyIfSet: true });
      }
    }

    let totalBillKwd: string | undefined;
    let finalPaidKwd: string | undefined;
    if (input.status === "completed") {
      const extraSum = input.extraItems?.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0) || 0;
      totalBillKwd = extraSum.toFixed(3);
      const cbDeduct = parseFloat(input.cashbackToDeductKwd || "0");
      finalPaidKwd = Math.max(0, extraSum - cbDeduct).toFixed(3);
    }

    const updated = await sessionsStore.mark({
      sessionId: session.id,
      status: input.status as any,
      markedBy: actor.userId,
      notes: input.notes,
      cashbackUnlockedKwd: input.status === "completed" ? cashbackUnlocked : undefined,
      extraItems: input.extraItems,
      totalBillKwd,
      finalPaidKwd
    });

    if (updated?.status === "completed") {
      // Sync the booking request(s) for this session and stamp when the customer showed up.
      // The original scheduledAt is always preserved.
      const sessObjId = mongoose.isValidObjectId(session.id) ? new mongoose.Types.ObjectId(session.id) : null;
      await BookingRequestModel.updateMany(
        {
          $or: [
            { scheduledSessionId: session.id },
            ...(sessObjId ? [{ scheduledSessionId: sessObjId }] : []),
            { _id: session.id },
            ...(sessObjId ? [{ _id: sessObjId }] : [])
          ]
        },
        { $set: { status: "completed", shownAt: new Date().toISOString() } }
      );

      await logAuditAction({
        actorId: actor.userId,
        actorRole: actor.role as any,
        actionType: "admin_manual_session_complete",
        targetEntityType: "BookingSession",
        targetEntityId: session.id,
        beforeState: { status: session.status },
        afterState: { status: "completed" },
        metadata: {
          shortId: (session as any).shortId || session.id,
          userId: session.userId,
          clinicId: session.clinicId,
          notes: input.notes
        }
      });
    }

    if (updated?.status === "no_show") {
      const breq = await bookingRequestsStore.findBySessionId(session.id);
      if (breq) await bookingRequestsStore.update(breq.id, { status: "no_show" });
    }
    return updated;
  });

  return { kind: "marked" as const, session, updated, uo, cashbackUnlocked };
}

export type MarkPaidInput = {
  cashbackToDeductKwd?: string;
  extraItems?: Array<{ name: string; priceKwd: string; qty: number }>;
};

async function markSessionPaid(sessionId: string, actorId: string) {
  await BookingSessionModel.findByIdAndUpdate(sessionId, {
    $set: { clinicPaymentStatus: "paid", clinicPaymentMarkedAt: new Date(), clinicPaymentMarkedBy: actorId }
  });
}

/** Revenue metrics for a session payment that just became paid. */
async function countSessionRevenue(netKwd: number, cashbackKwd: number, grossKwd: number) {
  const netMils = Math.round(netKwd * 1000);
  const cbMils = Math.round(cashbackKwd * 1000);
  const grossMils = Math.round(grossKwd * 1000);
  await incrementMetric({
    totalRevenueMils: netMils,
    totalGrossRevenueMils: grossMils,
    totalCashbackAppliedMils: cbMils,
    totalStandaloneSessionsSold: 1,
    totalStandaloneSessionRevenueMils: netMils,
    totalGrossStandaloneSessionRevenueMils: grossMils
  });
}

/**
 * Clinic POS checkout: mark a booking request (or a bare session) paid, settle the session
 * payment, apply the POS cashback deduction, and record the bill.
 */
export async function markClinicPaid(actor: Actor, id: string, input: MarkPaidInput) {
  let breq = await bookingRequestsStore.get(id);
  if (!breq && mongoose.isValidObjectId(id)) {
    // The clinic may pass a session id instead of a request id
    const sess = await BookingSessionModel.findById(id).lean<{ _id: mongoose.Types.ObjectId; bookingRequestId?: unknown } | null>();
    if (sess) {
      if (sess.bookingRequestId) breq = await bookingRequestsStore.get(String(sess.bookingRequestId));
      if (!breq) {
        const reqBySess = await BookingRequestModel.findOne({ scheduledSessionId: sess._id }).lean<{ _id: unknown } | null>();
        if (reqBySess) {
          breq = await bookingRequestsStore.get(String(reqBySess._id));
        } else {
          await markSessionPaid(String(sess._id), actor.userId);
          return { kind: "session_only" as const };
        }
      }
    }
  }
  if (!breq) throw new ApiError(404, "NOT_FOUND");
  if (!(await canActOnClinic(actor, breq.clinicId))) throw new ApiError(403, "FORBIDDEN_CLINIC");
  if (breq.clinicPaymentStatus === "paid") {
    if (breq.scheduledSessionId) await markSessionPaid(breq.scheduledSessionId, actor.userId);
    return { kind: "already_paid" as const };
  }

  const requestId = breq.id;
  const out = await withTransaction(async () => {
    // Re-read inside the transaction: a double-clicked checkout must not deduct twice.
    const breq = await bookingRequestsStore.get(requestId);
    if (!breq) throw new ApiError(404, "NOT_FOUND");
    if (breq.clinicPaymentStatus === "paid") return { alreadyPaid: true as const, breq };

    if (breq.sessionPaymentId) {
      const oldPay = await PaymentModel.findByIdAndUpdate(breq.sessionPaymentId, {
        status: "paid",
        confirmedAt: new Date(),
        confirmedBy: actor.userId,
        method: "cash" // clinic-side payments default to cash
      }).lean<{ status: string; amountKwd: string; cashbackAppliedKwd?: string; grossAmountKwd?: string } | null>();
      if (oldPay && oldPay.status !== "paid") {
        const netKwd = parseFloat(oldPay.amountKwd) || 0;
        const cbKwd = parseFloat(oldPay.cashbackAppliedKwd ?? "") || 0;
        const grossKwd = oldPay.grossAmountKwd ? parseFloat(oldPay.grossAmountKwd) : netKwd + cbKwd;
        await countSessionRevenue(netKwd, cbKwd, grossKwd);
      }
    } else if (breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0) {
      // No pending session payment existed — record one now
      const cb = parseFloat(breq.cashbackDeductedKwd || "0");
      const gross = parseFloat(breq.sessionPriceKwd) + cb;
      const payDoc = await PaymentModel.create({
        userId: breq.userId,
        offerId: breq.offerId ? new mongoose.Types.ObjectId(breq.offerId) : undefined,
        userOfferId: breq.userOfferId ? new mongoose.Types.ObjectId(breq.userOfferId) : undefined,
        amountKwd: breq.sessionPriceKwd,
        grossAmountKwd: gross.toFixed(3),
        cashbackAppliedKwd: cb > 0 ? cb.toFixed(3) : undefined,
        currency: "KWD",
        method: "cash",
        purpose: "session_payment",
        status: "paid",
        provider: "manual",
        bookingRequestId: breq.id,
        confirmedAt: new Date(),
        confirmedBy: actor.userId
      });
      await countSessionRevenue(parseFloat(breq.sessionPriceKwd), cb, gross);
      await bookingRequestsStore.update(breq.id, { sessionPaymentId: payDoc.id });
    }

    const cbToDeduct = parseFloat(input.cashbackToDeductKwd || "0");
    const alreadyDeducted = parseFloat(breq.cashbackDeductedKwd || "0");
    const diff = cbToDeduct - alreadyDeducted;

    if (diff > 0) {
      const resAdjust = await kycStore.deductUnlocked({
        userId: breq.userId,
        amountKwd: diff.toFixed(3),
        reference: { kind: "session", id: breq.id },
        createdBy: { kind: "admin", id: actor.userId }
      });
      // Rolls back the payment/status writes above too.
      if ("error" in resAdjust) throw new ApiError(400, resAdjust.error ?? "CASHBACK_DEDUCTION_FAILED");
      if (breq.userOfferId) {
        await userOfferService.adjustCashbackBalance(breq.userOfferId, -kwdToMils(diff), { onlyIfSet: true });
      }
    } else if (diff < 0) {
      await kycStore.adjustUnlocked({
        userId: breq.userId,
        amountKwd: Math.abs(diff).toFixed(3),
        reason: "Cashback un-applied at clinic POS",
        createdById: actor.userId
      });
      if (breq.userOfferId) {
        await userOfferService.adjustCashbackBalance(breq.userOfferId, kwdToMils(Math.abs(diff)), { onlyIfSet: true });
      }
    }

    const extraSum = input.extraItems?.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0) || 0;
    const basePrice = parseFloat(breq.sessionPriceKwd || "0");
    const totalBillKwd = (basePrice + extraSum).toFixed(3);
    const finalPaidKwd = Math.max(0, basePrice + extraSum - cbToDeduct).toFixed(3);

    let finalStatus = breq.status;
    if (breq.scheduledSessionId) {
      const linkedSess = await BookingSessionModel.findById(breq.scheduledSessionId).select("status").lean<{ status?: string } | null>();
      if (linkedSess?.status === "completed") finalStatus = "completed";
    }

    const updated = await bookingRequestsStore.update(breq.id, {
      status: finalStatus,
      clinicPaymentStatus: "paid",
      clinicPaymentMarkedAt: new Date().toISOString(),
      clinicPaymentMarkedBy: actor.userId,
      extraItems: input.extraItems,
      totalBillKwd,
      finalPaidKwd,
      cashbackDeductedKwd: cbToDeduct > 0 ? cbToDeduct.toFixed(3) : undefined
    });
    if (breq.scheduledSessionId) await markSessionPaid(breq.scheduledSessionId, actor.userId);
    return { alreadyPaid: false as const, breq, updated };
  });

  if (out.alreadyPaid) {
    if (out.breq.scheduledSessionId) await markSessionPaid(out.breq.scheduledSessionId, actor.userId);
    return { kind: "already_paid" as const };
  }
  return { kind: "paid" as const, breq: out.breq, updated: out.updated };
}
