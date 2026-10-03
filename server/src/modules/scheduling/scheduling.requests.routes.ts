// Booking-request workflow for clinic staff / CS: list, propose, confirm, pay, reject, CS scheduling.
import { Router } from "express";
import { kwDateTime } from "../../utils/kwDate.js";
import mongoose from "mongoose";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { offersStore } from "../offers/offers.store.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore } from "./sessions.store.js";
import { bookingRequestsStore } from "./bookingRequests.store.js";
import type { AppointmentStatus } from "@belamonda/shared";
import { emitToUser } from "../chat/chat.socket.js";
import { UserModel } from "../../models/user.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel, type OfferDoc } from "../../models/offer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { PaymentModel } from "../../models/payment.model.js";
import { incrementMetric } from "../../services/metric.service.js";
import { notifyBookingConfirmed, notifyBookingRejected } from "../notifications/notifications.service.js";
import { notifyChatRelatedUsers } from "../notifications/notifications.service.chat.js";
import { createSessionPayment } from "../../services/payment.service.js";
import { kwdToMils } from "../../utils/money.js";
import { withTransaction } from "../../db/transaction.js";
import { ApiError } from "../../utils/apiError.js";
import { ProposeSchema, RejectSchema, ScheduleSchema, canActOnClinic, checkStaffIntervalConstraint, computeBookingRequestFinancials, eligibilityError, ensureConversationFor, findCsUserIds, findFinanceUserIds, getUserClinicId, isWithinOfferValidity, loadOffer, loadUserOffer, mapOfferDocToSched, postSystemMessage } from "./scheduling.helpers.js";
import type { SchedOffer } from "./scheduling.helpers.js";

export const requestsRoutes = Router();

// ── Clinic / CS lists pending booking requests ─────────────────────────────
requestsRoutes.get("/cs/requests", authRequired, requireRole(["cs", "legal", "admin", "clinicStaff", "finance", "cs_director"]), async (req, res) => {
  try {
  const status = (typeof req.query.status === "string" ? req.query.status : "open") as AppointmentStatus | "all" | "open";
  const filter: Parameters<typeof bookingRequestsStore.list>[0] = { status };
  if (req.auth!.role === "clinicStaff") {
    const cid = await getUserClinicId(req.auth!.userId);
    if (cid) filter.clinicId = cid;
  }
  const items = await bookingRequestsStore.list(filter);

  // Enrich with users, offers, userOffers, and clinics in a single parallel batch
  const uniqueUserIds = [...new Set(items.map((i) => i.userId))].filter(Boolean);
  const uniqueOfferIds = [...new Set(items.map((it) => it.offerId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const uniqueUserOfferIds = [...new Set(items.map((it) => it.userOfferId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const uniqueClinicIds = [...new Set(items.map((it) => it.clinicId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];

  const [users, offerDocs, userOfferDocs, clinicDocs] = await Promise.all([
    uniqueUserIds.length > 0
      ? UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()
      : Promise.resolve([]),
    uniqueOfferIds.length > 0
      ? OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean<OfferDoc[]>()
      : Promise.resolve([]),
    uniqueUserOfferIds.length > 0
      ? UserOfferModel.find({ _id: { $in: uniqueUserOfferIds } }).lean()
      : Promise.resolve([]),
    uniqueClinicIds.length > 0
      ? ClinicModel.find({ _id: { $in: uniqueClinicIds } }).select("nameEn nameAr").lean()
      : Promise.resolve([])
  ]);

  const userMap = new Map((users as any[]).map((u) => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));
  const offerMap = new Map((offerDocs as any[]).map((o) => [String(o._id), mapOfferDocToSched(o)]));
  const userOfferMap = new Map((userOfferDocs as any[]).map((uo) => [String(uo._id), uo]));
  const clinicMap = new Map((clinicDocs as any[]).map((c) => [c._id.toString(), c]));

  const enriched = items.map((it) => {
    const c = clinicMap.get(it.clinicId) || {};
    const offer = it.offerId && mongoose.isValidObjectId(it.offerId)
      ? (offerMap.get(it.offerId) ?? null)
      : null;
    const financials = computeBookingRequestFinancials(it, offer);
    return {
      ...it,
      customerName: userMap.get(it.userId)?.fullName ?? null,
      customerPhone: userMap.get(it.userId)?.phone ?? null,
      clinicNameEn: (c as any).nameEn,
      clinicNameAr: (c as any).nameAr,
      offerName: it.standaloneName ?? offer?.name ?? null,
      userOffer: it.userOfferId && mongoose.isValidObjectId(it.userOfferId) ? userOfferMap.get(it.userOfferId) ?? null : null,
      ...financials,
    };
  });
  return res.json({ items: enriched });
  } catch (err: any) {
    console.error("[/cs/requests] Error:", err);
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

requestsRoutes.get("/clinic/requests", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  let clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  if (req.auth!.role === "clinicStaff") {
    clinicId = req.auth!.clinicId || await getUserClinicId(req.auth!.userId);
    if (!clinicId) return res.json({ items: [] });
  }
  const status = (typeof req.query.status === "string" ? req.query.status : "open") as AppointmentStatus | "all" | "open";
  const filter: Parameters<typeof bookingRequestsStore.list>[0] = { status };
  if (clinicId) filter.clinicId = clinicId;
  let items = await bookingRequestsStore.list(filter);

  // Clinic staff should only see requests that have been forwarded by admin (not request_received)
  if (req.auth!.role === "clinicStaff") {
    items = items.filter(i => i.status !== "request_received");
  }

  const uniqueUserIds = [...new Set(items.map((i) => i.userId))];
  const users = uniqueUserIds.length > 0
    ? (await UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()) as Array<{ _id: { toString(): string }; fullName?: string; phone?: string }>
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));

  const enriched = items.map((item) => ({
    ...item,
    customerName: userMap.get(item.userId)?.fullName ?? null,
    customerPhone: userMap.get(item.userId)?.phone ?? null,
  }));

  const uniqueOfferIds = [...new Set(enriched.map((it) => it.offerId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const offerDocs = uniqueOfferIds.length > 0
    ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean<OfferDoc[]>()
    : [];
  const offerMap = new Map(offerDocs.map((o) => [String(o._id), mapOfferDocToSched(o)]));

  const finalItems = enriched
    .map((it) => {
      const offer = it.offerId && mongoose.isValidObjectId(it.offerId)
        ? (offerMap.get(it.offerId) ?? null)
        : (it.offerId ? (offersStore.get(it.offerId) as any as SchedOffer | undefined) ?? null : null);
      const financials = computeBookingRequestFinancials(it, offer);
      return {
        ...it,
        offerName: it.standaloneName ?? offer?.name ?? (it.offerId && !mongoose.isValidObjectId(it.offerId) ? (offersStore.get(it.offerId) as { name?: string } | undefined)?.name ?? null : null),
        ...financials,
      };
    });

  return res.json({ items: finalItems });
});

requestsRoutes.get("/clinic/financial-summary", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  let clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  if (req.auth!.role === "clinicStaff") {
    clinicId = req.auth!.clinicId || ((await getUserClinicId(req.auth!.userId)) ?? undefined);
  }
  const empty = {
    totalGrossSalesKwd: "0.000",
    totalCashbackSpentKwd: "0.000",
    totalClinicCashKwd: "0.000",
    totalPendingCashKwd: "0.000",
    totalPaidCashKwd: "0.000",
    salesWithoutCashbackKwd: "0.000",
    salesWithCashbackKwd: "0.000",
    totalCashbackTakenKwd: "0.000",
    grossWithCashbackKwd: "0.000",
  };
  if (!clinicId) return res.json({ summary: empty });

  const docs = await BookingRequestModel.find({
    clinicId,
    status: { $nin: ["cancelled", "rejected"] },
  }).select("sessionPriceKwd cashbackDeductedKwd offerId clinicId membershipType hadCashback isStandalone status clinicPaymentStatus").lean();

  const offerIds = [...new Set(docs.map((d) => d.offerId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const offerDocs = offerIds.length > 0 ? await OfferModel.find({ _id: { $in: offerIds } }).lean<OfferDoc[]>() : [];
  const offerMap = new Map(offerDocs.map((o) => [String(o._id), mapOfferDocToSched(o)]));

  let totalGross = 0;
  let totalCashback = 0;
  let totalClinicCash = 0;
  let totalPending = 0;
  let totalPaid = 0;

  for (const d of docs) {
    const offer = d.offerId ? offerMap.get(String(d.offerId)) ?? null : null;
    const fin = computeBookingRequestFinancials(d as any, offer as any);
    const gross = parseFloat(fin.sessionGrossKwd) || 0;
    const cb = parseFloat(fin.cashbackDeductedKwd) || 0;
    const cash = parseFloat(fin.clinicTakeKwd) || 0;
    totalGross += gross;
    totalCashback += cb;
    if (d.status === "confirmed") {
      totalClinicCash += cash;
      if (d.clinicPaymentStatus === "paid") totalPaid += cash;
      else totalPending += cash;
    }
  }

  return res.json({
    summary: {
      totalGrossSalesKwd: totalGross.toFixed(3),
      totalCashbackSpentKwd: totalCashback.toFixed(3),
      totalClinicCashKwd: totalClinicCash.toFixed(3),
      totalPendingCashKwd: totalPending.toFixed(3),
      totalPaidCashKwd: totalPaid.toFixed(3),
      salesWithoutCashbackKwd: totalClinicCash.toFixed(3),
      salesWithCashbackKwd: totalPaid.toFixed(3),
      totalCashbackTakenKwd: totalCashback.toFixed(3),
      grossWithCashbackKwd: totalGross.toFixed(3),
    },
  });
});

requestsRoutes.post("/requests/:id/conversation", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  const { conv } = await ensureConversationFor(breq.id);
  return res.json({ conversationId: conv?.id ?? breq.conversationId ?? null });
});

// ── Clinic staff / CS proposes a slot in chat ─────────────────────────────
requestsRoutes.post("/requests/:id/propose", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const parsed = ProposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (!["request_received", "slot_assigned"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }

  if (parsed.data.scheduledAt && breq.userOfferId) {
    const check = await checkStaffIntervalConstraint({
      userOfferId: breq.userOfferId,
      userId: breq.userId,
      targetDate: new Date(parsed.data.scheduledAt),
      forceOverride: parsed.data.forceOverride,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      actionContext: "requests_propose"
    });
    if (!check.allowed) {
      return res.status(409).json(check);
    }
  }

  const updated = await bookingRequestsStore.update(breq.id, {
    status: "slot_assigned",
    proposedAt: parsed.data.scheduledAt,
    proposedBy: req.auth!.userId,
    adminSuggestedAt: parsed.data.scheduledAt
  });
  const { conv } = await ensureConversationFor(breq.id);
  if (conv) {
    postSystemMessage(
      conv.id,
      "slot_proposed",
      `Proposed time: ${kwDateTime(parsed.data.scheduledAt)}${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
      { bookingRequestId: breq.id, scheduledAt: parsed.data.scheduledAt },
      req.auth!.userId
    );
    notifyChatRelatedUsers({
      userIds: [breq.userId],
      kind: "booking_slot_proposed",
      body: `New time proposed: ${kwDateTime(parsed.data.scheduledAt)}`,
      payload: { bookingRequestId: breq.id }
    });
  }
  return res.json({ request: updated });
});

// ── Clinic staff / CS confirms the booking ──────────────────────────────────
requestsRoutes.post("/requests/:id/confirm", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (!["request_received", "slot_assigned"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }
  const bodyParsed = ProposeSchema.safeParse(req.body ?? {});
  const scheduledAt = (bodyParsed.success ? bodyParsed.data.scheduledAt : undefined) || breq.proposedAt;
  if (!scheduledAt) return res.status(400).json({ error: "NO_SCHEDULED_TIME" });

  if (!breq.userOfferId) {
    return res.status(400).json({ error: "STANDALONE_USE_SCHEDULE_ENDPOINT" });
  }

  if (breq.userOfferId && scheduledAt) {
    const check = await checkStaffIntervalConstraint({
      userOfferId: breq.userOfferId,
      userId: breq.userId,
      targetDate: new Date(scheduledAt),
      forceOverride: bodyParsed.success ? bodyParsed.data?.forceOverride : false,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      actionContext: "requests_confirm"
    });
    if (!check.allowed) {
      return res.status(409).json(check);
    }
  }

  const uo = await loadUserOffer(breq.userOfferId);
  if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
  const offer = await loadOffer(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
  const elErr = await eligibilityError(uo, offer, { skipSessionCap: true });
  if (elErr) return res.status(elErr.status).json({ error: elErr.code });

  const sessionClinicId = breq.clinicId || uo.clinicId;
  // if (await sessionsStore.isSlotTaken(sessionClinicId, scheduledAt)) {
  //   return res.status(409).json({ error: "SLOT_TAKEN" });
  // }

  const { session, updated } = await withTransaction(async () => {
    // Re-check inside the transaction so a double-click can't create two sessions.
    const current = await bookingRequestsStore.get(breq.id);
    if (!current || !["request_received", "slot_assigned"].includes(current.status)) {
      return { session: null, updated: null };
    }

    const session = await sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: sessionClinicId,
      scheduledAt,
      scheduledBy: req.auth!.userId
    });

    // Increment sessionsUsed when booking is confirmed/scheduled (non-standalone memberships)
    if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
      await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: 1 } });
    }

    const finPreview = computeBookingRequestFinancials(breq, offer);
    const clinicStaffConfirm = req.auth!.role === "clinicStaff";
    await bookingRequestsStore.update(breq.id, {
      sessionPriceKwd: breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0 ? breq.sessionPriceKwd : finPreview.clinicTakeKwd,
      cashbackDeductedKwd: breq.cashbackDeductedKwd && parseFloat(breq.cashbackDeductedKwd) > 0 ? breq.cashbackDeductedKwd : finPreview.cashbackDeductedKwd,
      clinicPaymentStatus: clinicStaffConfirm ? "payment_pending" : breq.clinicPaymentStatus,
    });

    let sessionPaymentId = breq.sessionPaymentId;
    if (breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0 && !sessionPaymentId) {
      const cb = parseFloat(breq.cashbackDeductedKwd || "0");
      const gross = parseFloat(breq.sessionPriceKwd) + cb;
      const sessionPayment = await createSessionPayment({
        userId: uo.userId,
        offerId: uo.offerId,
        userOfferId: uo.id,
        amountKwd: breq.sessionPriceKwd,
        grossAmountKwd: gross.toFixed(3),
        cashbackAppliedKwd: cb > 0 ? cb.toFixed(3) : undefined,
        bookingRequestId: breq.id
      });
      sessionPaymentId = sessionPayment.id;
    }

    const updated = await bookingRequestsStore.update(breq.id, {
      status: "scheduled",
      confirmedAt: new Date().toISOString(),
      confirmedBy: req.auth!.userId,
      scheduledSessionId: session.id,
      ...(sessionPaymentId ? { sessionPaymentId } : {})
    });
    return { session, updated };
  });
  if (!session) return res.status(409).json({ error: "INVALID_STATE" });

  if (updated?.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_confirmed",
      `Booking confirmed for ${kwDateTime(scheduledAt)}.`,
      { bookingRequestId: updated.id, sessionId: session.id, scheduledAt },
      req.auth!.userId
    );
  }

  notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
  notifyChatRelatedUsers({
    userIds: [uo.userId],
    kind: "booking_confirmed",
    body: `Your booking is confirmed for ${kwDateTime(scheduledAt)}`,
    payload: { sessionId: session.id, bookingRequestId: breq.id }
  });
  emitToUser(uo.userId, "booking:confirmed", { request: updated, session });

  return res.status(201).json({ request: updated, session });
});

const MarkPaidSchema = z.object({
  extraItems: z.array(z.object({ name: z.string(), priceKwd: z.string(), qty: z.number() })).optional(),
  cashbackToDeductKwd: z.string().optional()
});

// ── Clinic marks a booking request payment as paid ──────────────────────────
requestsRoutes.post("/requests/:id/mark-paid", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  const parsed = MarkPaidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  let breq = await bookingRequestsStore.get(req.params.id);
  if (!breq && mongoose.isValidObjectId(req.params.id)) {
    const sess = await BookingSessionModel.findById(req.params.id).lean();
    if (sess) {
      const linkedReqId = (sess as any).bookingRequestId ? String((sess as any).bookingRequestId) : null;
      if (linkedReqId) {
        breq = await bookingRequestsStore.get(linkedReqId);
      }
      if (!breq) {
        const reqBySess = await BookingRequestModel.findOne({ scheduledSessionId: (sess as any)._id }).lean();
        if (reqBySess) {
          breq = await bookingRequestsStore.get(String((reqBySess as any)._id));
        } else {
          await BookingSessionModel.findByIdAndUpdate((sess as any)._id, {
            $set: { clinicPaymentStatus: "paid", clinicPaymentMarkedAt: new Date(), clinicPaymentMarkedBy: req.auth!.userId }
          });
          return res.json({ success: true });
        }
      }
    }
  }
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (breq.clinicPaymentStatus === "paid") {
    if (breq.scheduledSessionId) {
      await BookingSessionModel.findByIdAndUpdate(breq.scheduledSessionId, {
        $set: { clinicPaymentStatus: "paid", clinicPaymentMarkedAt: new Date(), clinicPaymentMarkedBy: req.auth!.userId }
      });
    }
    return res.json({ success: true, alreadyPaid: true });
  }

  const bq = breq;
  const updated = await withTransaction(async () => {
    const breq = bq;
    if (breq.sessionPaymentId) {
      const oldPay = await PaymentModel.findByIdAndUpdate(breq.sessionPaymentId, {
        status: "paid",
        confirmedAt: new Date(),
        confirmedBy: req.auth!.userId,
        method: "cash" // or pos, we default to cash for clinic side payments
      }).lean();
    
      if (oldPay && (oldPay as any).status !== "paid") {
        const netKwd = parseFloat((oldPay as any).amountKwd) || 0;
        const cbKwd = parseFloat((oldPay as any).cashbackAppliedKwd) || 0;
        const grossKwdStr = (oldPay as any).grossAmountKwd;
        const grossKwd = grossKwdStr ? parseFloat(grossKwdStr) : netKwd + cbKwd;
      
        const netMils = Math.round(netKwd * 1000);
        const cbMils = Math.round(cbKwd * 1000);
        const grossMils = Math.round(grossKwd * 1000);
      
        await incrementMetric({
          totalRevenueMils: netMils,
          totalGrossRevenueMils: grossMils,
          totalCashbackAppliedMils: cbMils,
          totalStandaloneSessionsSold: 1,
          totalStandaloneSessionRevenueMils: netMils,
          totalGrossStandaloneSessionRevenueMils: grossMils,
        });
      }
    } else if (breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0) {
      // Fallback if no pending payment existed
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
        confirmedBy: req.auth!.userId
      });
    
      const netMils = Math.round(parseFloat(breq.sessionPriceKwd) * 1000);
      const cbMils = Math.round(cb * 1000);
      const grossMils = Math.round(gross * 1000);
      await incrementMetric({
        totalRevenueMils: netMils,
        totalGrossRevenueMils: grossMils,
        totalCashbackAppliedMils: cbMils,
        totalStandaloneSessionsSold: 1,
        totalStandaloneSessionRevenueMils: netMils,
        totalGrossStandaloneSessionRevenueMils: grossMils,
      });
    
      await bookingRequestsStore.update(breq.id, { sessionPaymentId: payDoc.id });
    }

    const cbToDeduct = parseFloat(parsed.data.cashbackToDeductKwd || "0");
    const alreadyDeducted = parseFloat(breq.cashbackDeductedKwd || "0");
    const diff = cbToDeduct - alreadyDeducted;

    if (diff > 0) {
      const resAdjust = await kycStore.deductUnlocked({
        userId: breq.userId,
        amountKwd: diff.toFixed(3),
        reference: { kind: "session", id: breq.id },
        createdBy: { kind: "admin", id: req.auth!.userId }
      });
      if ("error" in resAdjust) {
        // Rolls back the payment/status writes above too.
        throw new ApiError(400, resAdjust.error ?? "CASHBACK_DEDUCTION_FAILED");
      }
      if (breq.userOfferId) {
        await userOfferService.adjustCashbackBalance(breq.userOfferId, -kwdToMils(diff), { onlyIfSet: true });
      }
    } else if (diff < 0) {
      await kycStore.adjustUnlocked({
        userId: breq.userId,
        amountKwd: Math.abs(diff).toFixed(3),
        reason: "Cashback un-applied at clinic POS",
        createdById: req.auth!.userId
      });
      if (breq.userOfferId) {
        await userOfferService.adjustCashbackBalance(breq.userOfferId, kwdToMils(Math.abs(diff)), { onlyIfSet: true });
      }
    }

    let totalBillKwd: string | undefined;
    let finalPaidKwd: string | undefined;
  
    const extraSum = parsed.data.extraItems?.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0) || 0;
    const basePrice = parseFloat(breq.sessionPriceKwd || "0");
    totalBillKwd = (basePrice + extraSum).toFixed(3);
    finalPaidKwd = Math.max(0, basePrice + extraSum - cbToDeduct).toFixed(3);

    let finalStatus = breq.status;
    if (breq.scheduledSessionId) {
      const linkedSess = await BookingSessionModel.findById(breq.scheduledSessionId).select("status").lean();
      if ((linkedSess as any)?.status === "completed") {
        finalStatus = "completed";
      }
    }

    const result = await bookingRequestsStore.update(breq.id, {
      status: finalStatus,
      clinicPaymentStatus: "paid",
      clinicPaymentMarkedAt: new Date().toISOString(),
      clinicPaymentMarkedBy: req.auth!.userId,
      extraItems: parsed.data.extraItems,
      totalBillKwd,
      finalPaidKwd,
      cashbackDeductedKwd: cbToDeduct > 0 ? cbToDeduct.toFixed(3) : undefined
    });

    if (breq.scheduledSessionId) {
      await BookingSessionModel.findByIdAndUpdate(breq.scheduledSessionId, {
        $set: { clinicPaymentStatus: "paid", clinicPaymentMarkedAt: new Date(), clinicPaymentMarkedBy: req.auth!.userId }
      });
    }
    return result;
  });

  if (updated?.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_confirmed",
      `Clinic marked payment as paid${updated.sessionPriceKwd ? ` (${updated.sessionPriceKwd} KWD)` : ""}.`,
      { bookingRequestId: updated.id, clinicPaymentStatus: "paid" },
      req.auth!.userId
    );
  }

  const csIds = await findCsUserIds();
  const financeIds = await findFinanceUserIds();
  notifyChatRelatedUsers({
    userIds: Array.from(new Set([...csIds, ...financeIds, updated?.userId ?? breq.userId])),
    kind: "booking_confirmed",
    body: `Clinic marked booking ${breq.id} as paid${breq.sessionPriceKwd ? ` (${breq.sessionPriceKwd} KWD)` : ""}.`,
    payload: { bookingRequestId: breq.id, clinicPaymentStatus: "paid" }
  });

  return res.json({ request: updated });
});

// ── Admin marks booking as unpaid ──────────────────────────────────────────
requestsRoutes.post("/requests/:id/mark-unpaid", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    let breq = await bookingRequestsStore.get(req.params.id);
    if (!breq && mongoose.isValidObjectId(req.params.id)) {
      const sess = await BookingSessionModel.findById(req.params.id).lean();
      if (sess) {
        const linkedReqId = (sess as any).bookingRequestId ? String((sess as any).bookingRequestId) : null;
        if (linkedReqId) {
          breq = await bookingRequestsStore.get(linkedReqId);
        }
        if (!breq) {
          const reqBySess = await BookingRequestModel.findOne({ scheduledSessionId: (sess as any)._id }).lean();
          if (reqBySess) {
            breq = await bookingRequestsStore.get(String((reqBySess as any)._id));
          } else {
            await BookingSessionModel.findByIdAndUpdate((sess as any)._id, { $set: { clinicPaymentStatus: "pending" } });
            return res.json({ success: true });
          }
        }
      }
    }
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (breq.clinicPaymentStatus !== "paid") return res.status(409).json({ error: "NOT_PAID" });

    const bq = breq;
    const updated = await withTransaction(async () => {
      const result = await bookingRequestsStore.update(bq.id, {
        clinicPaymentStatus: "pending" as any,
        clinicPaymentMarkedAt: new Date().toISOString(),
        clinicPaymentMarkedBy: req.auth!.userId,
      });

      if (bq.scheduledSessionId) {
        await BookingSessionModel.findByIdAndUpdate(bq.scheduledSessionId, {
          $set: { clinicPaymentStatus: "pending" }
        });
      }
      return result;
    });

    return res.json({ request: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "INTERNAL_ERROR" });
  }
});

// ── Clinic staff / admin updates session price ─────────────────────────────
requestsRoutes.post("/requests/:id/update-price", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  try {
    const { sessionPriceKwd } = req.body;
    if (!sessionPriceKwd || isNaN(parseFloat(sessionPriceKwd)) || parseFloat(sessionPriceKwd) < 0) {
      return res.status(400).json({ error: "INVALID_PRICE" });
    }
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    const updated = await bookingRequestsStore.update(breq.id, {
      sessionPriceKwd: parseFloat(sessionPriceKwd).toFixed(3),
    });

    return res.json({ request: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "INTERNAL_ERROR" });
  }
});

// ── Clinic staff / CS rejects the booking ──────────────────────────────────
requestsRoutes.post("/requests/:id/reject", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const parsed = RejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (["confirmed", "cancelled", "rejected"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }
  const updated = await withTransaction(async () => {
    // Re-check inside the transaction so a concurrent reject/cancel can't refund twice.
    const current = await bookingRequestsStore.get(breq.id);
    if (!current || ["confirmed", "cancelled", "rejected"].includes(current.status)) return null;
    const result = await bookingRequestsStore.update(breq.id, {
      status: "cancelled",
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.auth!.userId,
      rejectionReason: parsed.data.reason
    });

    // Refund cashback if it was deducted
    if (result?.cashbackDeductedKwd && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
      const refund = parseFloat(result.cashbackDeductedKwd);
      if (refund > 0) {
        await userOfferService.adjustCashbackBalance(breq.userOfferId, kwdToMils(refund));
        await kycStore.adjustUnlocked({
          userId: breq.userId,
          amountKwd: refund.toFixed(3),
          reason: "Refund from cancelled booking",
          createdById: req.auth!.userId
        });
      }
    }
    return result;
  });
  if (!updated) return res.status(409).json({ error: "INVALID_STATE" });
  if (updated.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_rejected",
      `Booking rejected: ${parsed.data.reason}`,
      { bookingRequestId: updated.id },
      req.auth!.userId
    );
  }
  notifyBookingRejected(breq.userId, breq.id, parsed.data.reason);
  notifyChatRelatedUsers({
    userIds: [breq.userId],
    kind: "booking_rejected",
    body: `Your booking was rejected: ${parsed.data.reason}`,
    payload: { bookingRequestId: breq.id }
  });
  return res.json({ request: updated });
});

// ── CS direct-schedule (legacy / Mongo-aware) ─────────────────────────────
requestsRoutes.post("/cs/schedule", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = ScheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uo = await loadUserOffer(parsed.data.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    const user = await kycStore.getUser(uo.userId);
    if (user && user.verificationStatus !== "approved") return res.status(403).json({ error: "KYC_NOT_APPROVED" });

    const offer = await loadOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    if (offer.payPerSession) {
      return res.status(409).json({ error: "SESSION_PAYMENT_REQUIRED" });
    }

    const elErr = await eligibilityError(uo, offer);
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });

    const scheduledAtDate = new Date(parsed.data.scheduledAt);
    if (!isWithinOfferValidity(uo, scheduledAtDate)) return res.status(409).json({ error: "OFFER_OUT_OF_VALIDITY" });

    const check = await checkStaffIntervalConstraint({
      userOfferId: uo.id,
      userId: uo.userId,
      targetDate: scheduledAtDate,
      forceOverride: parsed.data.forceOverride,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      actionContext: "cs_schedule"
    });
    if (!check.allowed) {
      return res.status(409).json(check);
    }

    // if (await sessionsStore.isSlotTaken(uo.clinicId, parsed.data.scheduledAt)) {
    //   return res.status(409).json({ error: "SLOT_TAKEN" });
    // }

    const session = await sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      scheduledAt: parsed.data.scheduledAt,
      scheduledBy: req.auth!.userId,
      notes: parsed.data.notes
    });

    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    return res.status(201).json({ session });
  } catch (e) {
    next(e);
  }
});

// ── CS schedules from a specific request id ────────────────────────────────
requestsRoutes.post(
  "/cs/requests/:id/propose",
  authRequired,
  requireRole(["cs", "legal", "admin", "cs_director"]),
  async (req, res) => {
    const parsed = ProposeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (["confirmed", "cancelled", "rejected"].includes(breq.status)) {
      return res.status(409).json({ error: "INVALID_STATE" });
    }

    if (parsed.data.scheduledAt && breq.userOfferId) {
      const check = await checkStaffIntervalConstraint({
        userOfferId: breq.userOfferId,
        userId: breq.userId,
        targetDate: new Date(parsed.data.scheduledAt),
        forceOverride: parsed.data.forceOverride,
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        actionContext: "cs_requests_propose"
      });
      if (!check.allowed) {
        return res.status(409).json(check);
      }
    }

    const updated = await bookingRequestsStore.update(breq.id, {
      status: "slot_assigned",
      proposedAt: parsed.data.scheduledAt,
      proposedBy: req.auth!.userId,
      adminSuggestedAt: parsed.data.scheduledAt,
      notes: parsed.data.notes
    });

    if (updated?.conversationId) {
      postSystemMessage(
        updated.conversationId,
        "slot_proposed",
        `Date suggested for clinic: ${parsed.data.scheduledAt ? kwDateTime(parsed.data.scheduledAt) : "Not specified"}. Notes: ${parsed.data.notes || "None"}`,
        { bookingRequestId: updated.id }
      );
    }
    return res.status(200).json({ request: updated });
  }
);

requestsRoutes.post(
  "/clinic/requests/:id/confirm",
  authRequired,
  requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]),
  async (req, res) => {
    const parsed = ProposeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    if (!parsed.data.scheduledAt) return res.status(400).json({ error: "VALIDATION_ERROR", details: "scheduledAt is required" });
    const scheduledAt = parsed.data.scheduledAt;
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }
    if (["confirmed", "cancelled", "rejected"].includes(breq.status)) {
      return res.status(409).json({ error: "INVALID_STATE" });
    }
    
    // Standalone CS booking requests are confirmed without creating UserOffer/session.
    if (!breq.userOfferId) {
      const updated = await bookingRequestsStore.update(breq.id, {
        status: "scheduled",
        confirmedAt: new Date().toISOString(),
        confirmedBy: req.auth!.userId,
        proposedAt: scheduledAt,
        clinicScheduledAt: scheduledAt
      });
      if (updated?.conversationId) {
        postSystemMessage(
          updated.conversationId,
          "booking_confirmed",
          `Booking confirmed by clinic for ${kwDateTime(scheduledAt)}.`,
          { bookingRequestId: updated.id }
        );
      }
      notifyBookingConfirmed(breq.userId, breq.id, scheduledAt);
      notifyChatRelatedUsers({
        userIds: [breq.userId],
        kind: "booking_confirmed",
        body: `Your booking is confirmed for ${kwDateTime(scheduledAt)}`,
        payload: { bookingRequestId: breq.id }
      });
      return res.status(201).json({ session: null, request: updated });
    }

    const uo = await loadUserOffer(breq.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    const offer = await loadOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
    const elErr = await eligibilityError(uo, offer, { skipSessionCap: true });
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });

    const check = await checkStaffIntervalConstraint({
      userOfferId: breq.userOfferId,
      userId: breq.userId,
      targetDate: new Date(scheduledAt),
      forceOverride: parsed.data.forceOverride,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      actionContext: "clinic_requests_confirm"
    });
    if (!check.allowed) {
      return res.status(409).json(check);
    }

    const sessionClinicId = breq.clinicId || uo.clinicId;
    // if (await sessionsStore.isSlotTaken(sessionClinicId, scheduledAt)) {
    //   return res.status(409).json({ error: "SLOT_TAKEN" });
    // }
    const session = await sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: sessionClinicId,
      scheduledAt: scheduledAt,
      scheduledBy: req.auth!.userId,
      notes: parsed.data.notes
    });

    if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
      await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: 1 } });
    }

    const breqAfterCb = (await bookingRequestsStore.get(breq.id)) ?? breq;
    const finPreview = computeBookingRequestFinancials(breqAfterCb, offer);
    const isCsOrAdmin = req.auth!.role === "cs" || req.auth!.role === "legal" || req.auth!.role === "admin" || req.auth!.role === "cs_director";
    const clinicTake = breqAfterCb.sessionPriceKwd && parseFloat(breqAfterCb.sessionPriceKwd) > 0 ? breqAfterCb.sessionPriceKwd : finPreview.clinicTakeKwd;
    const cashbackUsed = breqAfterCb.cashbackDeductedKwd && parseFloat(breqAfterCb.cashbackDeductedKwd) > 0 ? breqAfterCb.cashbackDeductedKwd : finPreview.cashbackDeductedKwd;

    const updated = await bookingRequestsStore.update(breq.id, {
      status: "scheduled",
      confirmedAt: new Date().toISOString(),
      confirmedBy: req.auth!.userId,
      scheduledSessionId: session.id,
      proposedAt: scheduledAt,
      clinicScheduledAt: scheduledAt,
      sessionPriceKwd: clinicTake,
      cashbackDeductedKwd: cashbackUsed,
      clinicPaymentStatus: isCsOrAdmin ? "paid" : "payment_pending",
      ...(isCsOrAdmin
        ? { clinicPaymentMarkedAt: new Date().toISOString(), clinicPaymentMarkedBy: req.auth!.userId }
        : {}),
    });
    if (updated?.conversationId) {
      postSystemMessage(
        updated.conversationId,
        "booking_confirmed",
        `Booking confirmed by clinic for ${kwDateTime(scheduledAt)}.`,
        { bookingRequestId: updated.id, sessionId: session.id }
      );
    }
    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    notifyChatRelatedUsers({
      userIds: [uo.userId],
      kind: "booking_confirmed",
      body: `Your booking is confirmed for ${kwDateTime(scheduledAt)}`,
      payload: { sessionId: session.id }
    });
    return res.status(201).json({ session, request: updated });
  }
);
