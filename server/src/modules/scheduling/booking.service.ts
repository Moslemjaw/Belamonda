// Booking-request life cycle: the business rules and database writes behind the
// scheduling routes. Routes handle HTTP and notifications; these functions decide
// and persist. Every multi-write operation runs in a transaction, and a refusal is
// thrown as ApiError with the same status/code the routes always returned.
import mongoose from "mongoose";
import * as userOfferService from "../../services/userOffer.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore, type SessionRecord } from "./sessions.store.js";
import { bookingRequestsStore, type BookingRequestRecord } from "./bookingRequests.store.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { kwdToMils } from "../../utils/money.js";
import { withTransaction, lockKey } from "../../db/transaction.js";
import { ApiError } from "../../utils/apiError.js";
import {
  canActOnClinic,
  checkStaffIntervalConstraint,
  computeBookingRequestFinancials,
  eligibilityError,
  isWithinOfferValidity,
  loadOffer,
  loadUserOffer,
  type SchedUO
} from "./scheduling.helpers.js";

type Actor = { userId: string; role: string };

const STAFF_ROLES = ["cs", "legal", "admin", "cs_director"];

async function getRequestOr404(id: string) {
  const breq = await bookingRequestsStore.get(id);
  if (!breq) throw new ApiError(404, "NOT_FOUND");
  return breq;
}

/** Return the cashback deducted for a request to the membership balance and the wallet. */
async function refundDeductedCashback(breq: BookingRequestRecord, deductedKwd: string | undefined, actorId: string, reason: string) {
  if (!deductedKwd || !breq.userOfferId || !mongoose.isValidObjectId(breq.userOfferId)) return;
  const refund = parseFloat(deductedKwd);
  if (!(refund > 0)) return;
  await userOfferService.adjustCashbackBalance(breq.userOfferId, kwdToMils(refund));
  await kycStore.adjustUnlocked({ userId: breq.userId, amountKwd: refund.toFixed(3), reason, createdById: actorId });
}

// ── Customer cancels their own open request ────────────────────────────────
export async function cancelByCustomer(actor: Actor, requestId: string) {
  const breq = await getRequestOr404(requestId);
  if (breq.userId !== actor.userId) throw new ApiError(403, "FORBIDDEN");
  const open = ["request_received", "slot_assigned"];
  if (!open.includes(breq.status)) throw new ApiError(409, "INVALID_STATE");

  const updated = await withTransaction(async () => {
    // Re-check inside the transaction so two concurrent cancels can't both refund.
    const current = await bookingRequestsStore.get(breq.id);
    if (!current || !open.includes(current.status)) return null;
    const result = await bookingRequestsStore.update(breq.id, { status: "cancelled" });
    await refundDeductedCashback(breq, result?.cashbackDeductedKwd, actor.userId, "Refund from cancelled booking");
    return result;
  });
  if (!updated) throw new ApiError(409, "INVALID_STATE");
  return { breq, updated };
}

// ── Clinic staff / CS rejects a booking ────────────────────────────────────
export async function rejectByStaff(actor: Actor, requestId: string, reason: string) {
  const breq = await getRequestOr404(requestId);
  if (!(await canActOnClinic(actor, breq.clinicId))) throw new ApiError(403, "FORBIDDEN_CLINIC");
  const closed = ["confirmed", "cancelled", "rejected"];
  if (closed.includes(breq.status)) throw new ApiError(409, "INVALID_STATE");

  const updated = await withTransaction(async () => {
    // Re-check inside the transaction so a concurrent reject/cancel can't refund twice.
    const current = await bookingRequestsStore.get(breq.id);
    if (!current || closed.includes(current.status)) return null;
    const result = await bookingRequestsStore.update(breq.id, {
      status: "cancelled",
      rejectedAt: new Date().toISOString(),
      rejectedBy: actor.userId,
      rejectionReason: reason
    });
    await refundDeductedCashback(breq, result?.cashbackDeductedKwd, actor.userId, "Refund from cancelled booking");
    return result;
  });
  if (!updated) throw new ApiError(409, "INVALID_STATE");
  return { breq, updated };
}

// ── Admin / CS forwards a request to the clinic with a suggested date ──────
export async function forwardToClinic(
  actor: Actor,
  requestId: string,
  input: { scheduledAt?: string; notes?: string; forceOverride?: boolean }
) {
  const breq = await getRequestOr404(requestId);
  if (["confirmed", "cancelled", "rejected"].includes(breq.status)) throw new ApiError(409, "INVALID_STATE");
  if (input.scheduledAt && breq.userOfferId) {
    const check = await checkStaffIntervalConstraint({
      userOfferId: breq.userOfferId,
      userId: breq.userId,
      targetDate: new Date(input.scheduledAt),
      forceOverride: input.forceOverride,
      actorId: actor.userId,
      actorRole: actor.role,
      actionContext: "cs_requests_propose"
    });
    if (!check.allowed) throw new ApiError(409, check.code ?? check.error ?? "INTERVAL_NOT_MET", check as Record<string, unknown>, true);
  }
  const updated = await bookingRequestsStore.update(breq.id, {
    status: "slot_assigned",
    proposedAt: input.scheduledAt,
    proposedBy: actor.userId,
    adminSuggestedAt: input.scheduledAt,
    notes: input.notes
  });
  return { breq, updated };
}

// ── Clinic (or CS/admin on its behalf) confirms the date ───────────────────
export async function confirmByClinic(
  actor: Actor,
  requestId: string,
  input: { scheduledAt: string; notes?: string; forceOverride?: boolean }
): Promise<{ breq: BookingRequestRecord; updated: BookingRequestRecord | null; session: SessionRecord | null; uo: SchedUO | null }> {
  const { scheduledAt } = input;
  const breq = await getRequestOr404(requestId);
  if (!(await canActOnClinic(actor, breq.clinicId))) throw new ApiError(403, "FORBIDDEN_CLINIC");
  if (["confirmed", "cancelled", "rejected"].includes(breq.status)) throw new ApiError(409, "INVALID_STATE");

  // Standalone CS booking requests are confirmed without creating UserOffer/session.
  if (!breq.userOfferId) {
    const updated = await bookingRequestsStore.update(breq.id, {
      status: "scheduled",
      confirmedAt: new Date().toISOString(),
      confirmedBy: actor.userId,
      proposedAt: scheduledAt,
      clinicScheduledAt: scheduledAt
    });
    return { breq, updated, session: null, uo: null };
  }

  const uo = await loadUserOffer(breq.userOfferId);
  if (!uo) throw new ApiError(404, "USER_OFFER_NOT_FOUND");
  const offer = await loadOffer(uo.offerId);
  if (!offer) throw new ApiError(400, "OFFER_NOT_FOUND");
  const elErr = await eligibilityError(uo, offer, { skipSessionCap: true, scheduledAt });
  if (elErr) throw new ApiError(elErr.status, elErr.code);

  const check = await checkStaffIntervalConstraint({
    userOfferId: breq.userOfferId,
    userId: breq.userId,
    targetDate: new Date(scheduledAt),
    forceOverride: input.forceOverride,
    actorId: actor.userId,
    actorRole: actor.role,
    actionContext: "clinic_requests_confirm"
  });
  // The route has always answered this refusal with the check object itself.
  if (!check.allowed) throw new ApiError(409, check.code ?? check.error ?? "INTERVAL_NOT_MET", check as Record<string, unknown>, true);

  const isCsOrAdmin = STAFF_ROLES.includes(actor.role);
  const sessionClinicId = breq.clinicId || uo.clinicId;

  const { session, updated } = await withTransaction(async () => {
    // A double-clicked confirm: the other click already scheduled this request.
    const current = await bookingRequestsStore.get(breq.id);
    if (!current || current.status !== breq.status || current.scheduledSessionId !== breq.scheduledSessionId) {
      throw new ApiError(409, "INVALID_STATE");
    }

    const session = await sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: sessionClinicId,
      scheduledAt,
      scheduledBy: actor.userId,
      notes: input.notes
    });

    if (!breq.isStandalone && mongoose.isValidObjectId(breq.userOfferId)) {
      await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: 1 } });
    }

    const finPreview = computeBookingRequestFinancials(current, offer);
    const clinicTake = current.sessionPriceKwd && parseFloat(current.sessionPriceKwd) > 0 ? current.sessionPriceKwd : finPreview.clinicTakeKwd;
    const cashbackUsed = current.cashbackDeductedKwd && parseFloat(current.cashbackDeductedKwd) > 0 ? current.cashbackDeductedKwd : finPreview.cashbackDeductedKwd;

    const updated = await bookingRequestsStore.update(breq.id, {
      status: "scheduled",
      confirmedAt: new Date().toISOString(),
      confirmedBy: actor.userId,
      scheduledSessionId: session.id,
      proposedAt: scheduledAt,
      clinicScheduledAt: scheduledAt,
      sessionPriceKwd: clinicTake,
      cashbackDeductedKwd: cashbackUsed,
      clinicPaymentStatus: isCsOrAdmin ? "paid" : "payment_pending",
      ...(isCsOrAdmin ? { clinicPaymentMarkedAt: new Date().toISOString(), clinicPaymentMarkedBy: actor.userId } : {})
    });
    return { session, updated };
  });
  return { breq, updated, session, uo };
}

// ── CS schedules a session directly from a membership (no booking request) ──
export async function scheduleByCs(
  actor: Actor,
  input: { userOfferId: string; scheduledAt: string; notes?: string; forceOverride?: boolean }
) {
  const uo = await loadUserOffer(input.userOfferId);
  if (!uo) throw new ApiError(404, "USER_OFFER_NOT_FOUND");
  const user = await kycStore.getUser(uo.userId);
  if (user && user.verificationStatus !== "approved") throw new ApiError(403, "KYC_NOT_APPROVED");
  const offer = await loadOffer(uo.offerId);
  if (!offer) throw new ApiError(400, "OFFER_NOT_FOUND");
  if (offer.payPerSession) throw new ApiError(409, "SESSION_PAYMENT_REQUIRED");
  const elErr = await eligibilityError(uo, offer);
  if (elErr) throw new ApiError(elErr.status, elErr.code);

  const scheduledAtDate = new Date(input.scheduledAt);
  if (!isWithinOfferValidity(uo, scheduledAtDate)) throw new ApiError(409, "OFFER_OUT_OF_VALIDITY");

  const check = await checkStaffIntervalConstraint({
    userOfferId: uo.id,
    userId: uo.userId,
    targetDate: scheduledAtDate,
    forceOverride: input.forceOverride,
    actorId: actor.userId,
    actorRole: actor.role,
    actionContext: "cs_schedule"
  });
  if (!check.allowed) throw new ApiError(409, check.code ?? check.error ?? "INTERVAL_NOT_MET", check as Record<string, unknown>, true);

  const session = await withTransaction(async () => {
    // One schedule per membership at a time; a double click finds the first click's session.
    await lockKey(`schedule:${uo.id}`);
    const duplicate = await BookingSessionModel.exists({
      userOfferId: uo.id,
      scheduledAt: scheduledAtDate,
      status: "scheduled"
    });
    if (duplicate) throw new ApiError(409, "DUPLICATE_SESSION");
    return sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      scheduledAt: input.scheduledAt,
      scheduledBy: actor.userId,
      notes: input.notes
    });
  });
  return { uo, session };
}
