// Customer-facing booking routes (/me/*).
import { Router } from "express";
import { kwDateTime } from "../../utils/kwDate.js";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore } from "./sessions.store.js";
import { bookingRequestsStore } from "./bookingRequests.store.js";
import { emitToUser } from "../chat/chat.socket.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { notifyBookingConfirmed, notifyBookingUnderReview } from "../notifications/notifications.service.js";
import { notifyChatRelatedUsers } from "../notifications/notifications.service.chat.js";
import { listRequiredFormsForUser } from "../eforms/eforms.router.js";
import { createSessionPayment, confirmSessionPayment } from "../../services/payment.service.js";
import { kwdToMils } from "../../utils/money.js";
import { withTransaction } from "../../db/transaction.js";
import * as bookingService from "./booking.service.js";
import { acquireLease } from "../../jobs/lease.js";
import { CancelSchema, RequestSchema, computeBookingRequestFinancials, eligibilityError, ensureConversationFor, findClinicStaffUserIds, findCsUserIds, findFinanceUserIds, loadOffer, loadUserOffer, maxAccessibleSessions, postSystemMessage, resolveSessionPrice } from "./scheduling.helpers.js";

export const customerRoutes = Router();


// ── Customer requests a session — creates booking request + conversation ───
customerRoutes.post("/me/request", authRequired, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    // One booking attempt per customer every 4 seconds — kept in the database so it holds
    // across every server instance (was an in-memory Map).
    if (!(await acquireLease(`booking:${userId}`, 4000))) {
      return res.status(429).json({ error: "TOO_MANY_REQUESTS", message: "A booking request is already being processed. Please wait a moment." });
    }

    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    let uoId = parsed.data.userOfferId;
    let overrideClinicId = parsed.data.clinicId;

    const globalBookingRoute: "clinic" | "cs" = "cs" as any;

    if (parsed.data.isStandalone && uoId.startsWith("temp_")) {
       if (!parsed.data.standaloneName) return res.status(400).json({ error: "MISSING_STANDALONE_NAME" });
       if (!overrideClinicId) return res.status(400).json({ error: "MISSING_CLINIC_ID" });

       const openStatuses = ["request_received", "slot_assigned", "scheduled"];
       const existingStandalone = await BookingRequestModel.findOne({
         userId: req.auth!.userId,
         isStandalone: true,
         status: { $in: openStatuses }
       });
       if (existingStandalone) {
         return res.status(409).json({ error: "ALREADY_HAVE_OPEN_REQUEST" });
       }

       // Standalone booking flow: create booking request only.
       // Do NOT create Offer/UserOffer records.
       const standalonePrice = String(parsed.data.standalonePrice ?? "0.000");
       const breq = await bookingRequestsStore.create({
         userId: req.auth!.userId,
         clinicId: overrideClinicId,
         isStandalone: true,
         bookingRoute: globalBookingRoute,
         standaloneName: parsed.data.standaloneName,
         membershipType: "none",
         hadCashback: false,
         sessionPriceKwd: standalonePrice,
         preferredAt: parsed.data.preferredAt,
         notes: parsed.data.notes
       });
       const { conv } = await ensureConversationFor(breq.id);
       if (conv) {
         await postSystemMessage(
           conv.id,
           "booking_requested",
           `Customer requested a CS booking for ${parsed.data.standaloneName}${parsed.data.preferredAt ? ` (preferred ${kwDateTime(parsed.data.preferredAt)})` : ""}.${parsed.data.notes ? ` Note: ${parsed.data.notes}` : ""}`,
           { bookingRequestId: breq.id, preferredAt: parsed.data.preferredAt }
         );
       }
       notifyBookingUnderReview(req.auth!.userId, breq.id);
       const [csIds, financeIds] = await Promise.all([findCsUserIds(), findFinanceUserIds()]);
       const additionalNotifyIds = globalBookingRoute === "clinic" ? await findClinicStaffUserIds(breq.clinicId) : csIds;
       notifyChatRelatedUsers({
         userIds: Array.from(new Set([...additionalNotifyIds, ...financeIds])),
         kind: "booking_under_review",
         body: `Booking request ${breq.id}: clinic=${breq.clinicId}, price=${breq.sessionPriceKwd ?? "0.000"} KWD, membership=none, cashback=0.000 KWD`,
         payload: {
           bookingRequestId: breq.id,
           clinicId: breq.clinicId,
           sessionPriceKwd: breq.sessionPriceKwd ?? "0.000",
           membershipType: "none",
           cashbackDeductedKwd: "0.000",
           isStandalone: true,
           bookingRoute: globalBookingRoute
         }
       });
       return res.status(201).json({ request: breq, conversationId: conv?.id ?? null });
    }

    const uo = await loadUserOffer(uoId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    // Ensure the customer is either the owner OR a group member
    const isOwner = uo.userId === req.auth!.userId;
    const isMember = (uo.membershipType === "group" || !!(uo as any).groupInviteCode) && uo.sharedWith?.includes(req.auth!.userId);
    if (!isOwner && !isMember) {
      return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    }
    
    if (overrideClinicId) {
       const dbUo = await UserOfferModel.findById(uo.id);
       if (dbUo && dbUo.clinicId) {
         // Force it back to the membership's existing clinic
         uo.clinicId = dbUo.clinicId.toString();
       } else {
         uo.clinicId = overrideClinicId; // Use selected clinic
         if (dbUo && !dbUo.clinicId) {
           dbUo.clinicId = new mongoose.Types.ObjectId(overrideClinicId);
           await dbUo.save();
         }
       }
    }

    // KYC + offer load + e-forms check — all independent, run in parallel
    const [user, offer, pendingForms] = await Promise.all([
      kycStore.getUser(req.auth!.userId),
      loadOffer(uo.offerId),
      listRequiredFormsForUser(req.auth!.userId, [{ kind: "offer", refId: String(uo.offerId) }], "booking")
    ]);

    if (user && user.verificationStatus !== "approved") {
      return res.status(403).json({ error: "KYC_REQUIRED" });
    }
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    const elErr = await eligibilityError(uo, offer);
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });

    // Gate: session interval cooling period (respects admin overrides)
    const uoDocForOverride = await UserOfferModel.findById(uo.id).lean();
    const isOverrideUnlocked = !!(uoDocForOverride as any)?.bookingOverrideUnlocked;
    const cooldownOverrideAt = (uoDocForOverride as any)?.bookingCooldownEndOverrideAt ? new Date((uoDocForOverride as any).bookingCooldownEndOverrideAt) : null;

    if (!isOverrideUnlocked) {
      if (cooldownOverrideAt) {
        if (new Date() < cooldownOverrideAt) {
          return res.status(409).json({ error: "INTERVAL_NOT_MET", nextEligibleAt: cooldownOverrideAt.toISOString() });
        }
      } else if (offer.sessionIntervalDays > 0) {
        const lastCompletedAt = await sessionsStore.lastCompletedAt(uo.id, req.auth!.userId);
        if (lastCompletedAt) {
          const nextEligible = new Date(new Date(lastCompletedAt).getTime() + offer.sessionIntervalDays * 24 * 60 * 60 * 1000);
          if (new Date() < nextEligible) {
            return res.status(409).json({ error: "INTERVAL_NOT_MET", nextEligibleAt: nextEligible.toISOString() });
          }
        }
      }
    }

    // Gate: required-before-booking e-forms
    if (pendingForms.length) {
      return res.status(409).json({ error: "EFORMS_REQUIRED", forms: pendingForms });
    }

    // Gate: prevent multiple open booking requests for the same membership
    const openStatuses = ["request_received", "slot_assigned", "scheduled"];
    const now = new Date();

    // Auto-clear stale requests (>24h old) so past appointments don't block new bookings.
    // A request keeps the status of its session: one whose session is still
    // "scheduled" (clinic hasn't marked it yet) is left as is — it was previously
    // cancelled here, leaving Request History and the Sessions Log disagreeing —
    // and is ignored by the open-request check below instead.
    const pastScheduledReqIds: unknown[] = [];
    const potentialStaleReqs = await BookingRequestModel.find({
      userOfferId: uo.id,
      userId: req.auth!.userId,
      status: { $in: openStatuses }
    });
    for (const r of potentialStaleReqs) {
      const rDate = (r as any).proposedAt || (r as any).preferredAt || (r as any).createdAt;
      if (rDate && new Date(rDate) < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
        let linkedSess: any = null;
        if ((r as any).scheduledSessionId) {
          linkedSess = await BookingSessionModel.findById((r as any).scheduledSessionId).lean();
        } else {
          linkedSess = await BookingSessionModel.findOne({ bookingRequestId: r._id }).lean();
        }
        if (linkedSess?.status === "scheduled") {
          pastScheduledReqIds.push(r._id);
          continue;
        }
        const newStatus = (linkedSess?.status === "completed" || linkedSess?.status === "no_show") ? linkedSess.status : "cancelled";
        await BookingRequestModel.findByIdAndUpdate(r._id, { $set: { status: newStatus } });
      }
    }

    const existingReq = await BookingRequestModel.findOne({
      userOfferId: uo.id,
      userId: req.auth!.userId,
      status: { $in: openStatuses },
      _id: { $nin: pastScheduledReqIds }
    });
    if (existingReq) {
      return res.status(409).json({ error: "ALREADY_HAVE_OPEN_REQUEST" });
    }

    // Calculate if this is an extra session
    const cap = maxAccessibleSessions(uo, offer.maxSessions);
    const committed = await sessionsStore.countCommitted(uo.id);
    const consumed = Math.max(uo.sessionsUsed ?? 0, committed);
    const isExtraSession = !!(offer.allowExtraPaidSessions && cap != null && consumed >= cap);

    // Gate: pay-per-session / cashback logic
    const resolvedPrice = resolveSessionPrice(offer, uo.clinicId, isExtraSession);
    let amountToPay = resolvedPrice;
    let cashbackDeducted = 0;

    if (!parsed.data.isStandalone && uo.membershipType === "cashback") {
      // Defer all cashback deductions to the POS checkout.
      // We will not deduct cashback during scheduling, as the user pays at the clinic.
      cashbackDeducted = 0;
      amountToPay = resolvedPrice;
    } else if (resolvedPrice && !parsed.data.isStandalone) {
      // Non-cashback membership with a pay-per-session price — no cashback deduction.
      amountToPay = resolvedPrice;
    }

    const isDirectClinic = (offer as any)?.bookingFlow === "direct_clinic";
    const effectiveBookingRoute: "clinic" | "cs" = isDirectClinic ? "clinic" : "cs";
    const effectiveInitialStatus = isDirectClinic ? "slot_assigned" : "request_received";

    if (amountToPay && parseFloat(amountToPay) > 0 && !parsed.data.isStandalone) {
      // Booking request + its session payment are written together: if the payment can't be
      // created, the request is rolled back too so the customer can simply retry.
      const gross = parseFloat(amountToPay) + cashbackDeducted;
      const { breq, sessionPayment, finalBreq } = await withTransaction(async () => {
        // Create the booking request first so we can link the payment to it
        const breq = await bookingRequestsStore.create({
          userOfferId: uo.id,
          userId: req.auth!.userId,
          offerId: uo.offerId,
          clinicId: uo.clinicId,
          isStandalone: !!parsed.data.isStandalone,
          bookingRoute: effectiveBookingRoute,
          status: effectiveInitialStatus,
          membershipType: uo.membershipType ?? "none",
          hadCashback: cashbackDeducted > 0,
          standaloneName: parsed.data.standaloneName,
          preferredAt: parsed.data.preferredAt,
          notes: parsed.data.notes
        });
        await bookingRequestsStore.update(breq.id, {
          status: effectiveInitialStatus,
          sessionPriceKwd: parsed.data.sessionGrossKwd ?? gross.toFixed(3)
          // We do not save cashbackDeductedKwd here. It will be handled entirely at POS checkout.
        });
        const sessionPayment = await createSessionPayment({
          userId: uo.userId,
          offerId: uo.offerId,
          userOfferId: uo.id,
          amountKwd: amountToPay,
          grossAmountKwd: gross.toFixed(3),
          cashbackAppliedKwd: cashbackDeducted > 0 ? cashbackDeducted.toFixed(3) : undefined,
          bookingRequestId: breq.id
        });
        const finalBreq = await bookingRequestsStore.update(breq.id, { sessionPaymentId: sessionPayment.id });
        return { breq, sessionPayment, finalBreq };
      });

      // Create conversation and notify clinic/CS so the request is visible
      const [{ conv: payConv, csIds: payCsIds }, payFinanceIds] = await Promise.all([
        ensureConversationFor(breq.id),
        findFinanceUserIds()
      ]);
      if (payConv) {
        await postSystemMessage(
          payConv.id,
          "booking_requested",
          `Customer requested a booking (payment pending: ${amountToPay} KWD).${parsed.data.preferredAt ? ` Preferred: ${kwDateTime(parsed.data.preferredAt)}` : ""}`,
          { bookingRequestId: breq.id, preferredAt: parsed.data.preferredAt }
        );
      }
      notifyBookingUnderReview(req.auth!.userId, breq.id);
      const payNotifyIds = effectiveBookingRoute === "clinic"
        ? await findClinicStaffUserIds(breq.clinicId)
        : (payCsIds.length ? payCsIds : await findCsUserIds());
      notifyChatRelatedUsers({
        userIds: Array.from(new Set([...payNotifyIds, ...payFinanceIds])),
        kind: "booking_under_review",
        body: `Booking request ${breq.id}: clinic=${breq.clinicId}, payment pending ${amountToPay} KWD`,
        payload: {
          bookingRequestId: breq.id,
          clinicId: breq.clinicId,
          sessionPriceKwd: amountToPay,
          membershipType: breq.membershipType ?? "none",
          isStandalone: false
        }
      });

      return res.status(201).json({
        request: finalBreq,
        sessionPaymentRequired: true,
        sessionPaymentId: sessionPayment.id,
        sessionPriceKwd: amountToPay,
        conversationId: payConv?.id ?? null
      });
    }
    // Compute session gross price for display on clinic/CS dashboards
    // Priority: client-provided session price > server-computed > offer config
    let sessionGross: string | undefined;
    if (parsed.data.sessionGrossKwd) {
      // Client sent the actual treatment price at the clinic
      sessionGross = parsed.data.sessionGrossKwd;
    } else if (parsed.data.isStandalone) {
      sessionGross = String(parsed.data.standalonePrice ?? "0.000");
    } else if (cashbackDeducted > 0) {
      const remaining = parseFloat(amountToPay ?? "0") || 0;
      sessionGross = (cashbackDeducted + remaining).toFixed(3);
    } else if (offer && uo.membershipType === "cashback") {
      const rate = parseFloat(offer.cashbackPerSessionKwd || "0") || 0;
      if (rate > 0) sessionGross = rate.toFixed(3);
    }

    // Cashback is entirely handled at the POS checkout. We don't save any initial deduction here.
    const finalCashbackDeducted = undefined;

    const breq = await bookingRequestsStore.create({
      userOfferId: uo.id,
      userId: req.auth!.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      isStandalone: !!parsed.data.isStandalone,
      bookingRoute: effectiveBookingRoute,
      status: effectiveInitialStatus,
      membershipType: uo.membershipType ?? "none",
      hadCashback: cashbackDeducted > 0 || !!parsed.data.cashbackAppliedKwd,
      sessionPriceKwd: sessionGross,
      cashbackDeductedKwd: finalCashbackDeducted,
      standaloneName: parsed.data.standaloneName,
      preferredAt: parsed.data.preferredAt,
      notes: parsed.data.notes
    });

    const [{ conv, csIds: convCsIds }, financeIds] = await Promise.all([
      ensureConversationFor(breq.id),
      findFinanceUserIds()
    ]);
    if (conv) {
      await postSystemMessage(
        conv.id,
        "booking_requested",
        `Customer requested a booking${parsed.data.preferredAt ? ` (preferred ${kwDateTime(parsed.data.preferredAt)})` : ""}.${parsed.data.notes ? ` Note: ${parsed.data.notes}` : ""}`,
        { bookingRequestId: breq.id, preferredAt: parsed.data.preferredAt }
      );
      const recipients = conv.participants.map((p) => p.userId).filter((u) => u !== req.auth!.userId);
      notifyChatRelatedUsers({
        userIds: recipients,
        kind: "booking_under_review",
        body: `New booking request from ${req.auth!.userId}`,
        payload: { bookingRequestId: breq.id }
      });
    }

    const additionalNotifyIds = breq.bookingRoute === "clinic" 
      ? await findClinicStaffUserIds(breq.clinicId)
      : (convCsIds.length ? convCsIds : await findCsUserIds());
      
    notifyBookingUnderReview(req.auth!.userId, breq.id);
    notifyChatRelatedUsers({
      userIds: Array.from(new Set([...additionalNotifyIds, ...financeIds])),
      kind: "booking_under_review",
      body: `Booking request ${breq.id}: clinic=${breq.clinicId}, price=${breq.sessionPriceKwd ?? "0.000"} KWD, membership=${breq.membershipType ?? "none"}, cashback=${breq.cashbackDeductedKwd ?? "0.000"} KWD`,
      payload: {
        bookingRequestId: breq.id,
        clinicId: breq.clinicId,
        sessionPriceKwd: breq.sessionPriceKwd ?? "0.000",
        membershipType: breq.membershipType ?? "none",
        cashbackDeductedKwd: breq.cashbackDeductedKwd ?? "0.000",
        isStandalone: !!breq.isStandalone
      }
    });

    return res.status(201).json({ request: breq, conversationId: conv?.id ?? null });
  } catch (e) {
    next(e);
  }
});

// ── Customer's own sessions ────────────────────────────────────────────────
customerRoutes.get("/me/sessions", authRequired, async (req, res) => {
  const sessions = Array.from(await sessionsStore.listByUser(req.auth!.userId));
  const enriched = await Promise.all(sessions.map(async (s) => {
    let offerName = null;
    const breq = await bookingRequestsStore.findBySessionId(s.id);
    if (breq?.standaloneName) {
      offerName = breq.standaloneName;
    } else if (s.offerId) {
      const offer = await loadOffer(s.offerId);
      offerName = offer?.name ?? null;
    }
    return { ...s, offerName };
  }));
  return res.json({ items: enriched });
});

customerRoutes.get("/me/requests", authRequired, async (req, res) => {
  const requests = await bookingRequestsStore.list({ userId: req.auth!.userId });
  const enriched = await Promise.all(requests.map(async (r) => {
    let offerName = r.standaloneName;
    if (!offerName && r.offerId) {
      const offer = await loadOffer(r.offerId);
      offerName = offer?.name ?? undefined;
    }
    return { ...r, offerName };
  }));
  return res.json({ items: enriched });
});

/** Pre-booking quote: session price, cashback, and cash due at clinic. */
customerRoutes.get("/me/booking-quote", authRequired, async (req, res) => {
  const userOfferId = typeof req.query.userOfferId === "string" ? req.query.userOfferId : "";
  const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  if (!userOfferId) return res.status(400).json({ error: "VALIDATION_ERROR" });

  const uo = await loadUserOffer(userOfferId);
  if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
  const isOwner = uo.userId === req.auth!.userId;
  const isMember = (uo.membershipType === "group" || !!(uo as any).groupInviteCode) && uo.sharedWith?.includes(req.auth!.userId);
  if (!isOwner && !isMember) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

  const offer = await loadOffer(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

  const cap = maxAccessibleSessions(uo, offer.maxSessions);
  const committed = await sessionsStore.countCommitted(uo.id);
  const consumed = Math.max(uo.sessionsUsed ?? 0, committed);
  const isExtraSession = !!(offer.allowExtraPaidSessions && cap != null && consumed >= cap);

  const targetClinic = clinicId || uo.clinicId;
  const listPrice = resolveSessionPrice(offer, targetClinic, isExtraSession);
  const listNum = parseFloat(listPrice ?? "0") || 0;
  const rate = listNum > 0 ? listNum : parseFloat(offer.cashbackPerSessionKwd || "0");

  let cashbackApplied = 0;
  let clinicPay = rate;
  if (uo.membershipType === "cashback") {
    const balance = parseFloat(uo.cashbackBalanceKwd || "0");
    cashbackApplied = Math.min(balance, rate);
    clinicPay = Math.max(0, rate - cashbackApplied);
  } else if (listNum > 0) {
    clinicPay = listNum;
  }

  const elErr = await eligibilityError(uo, offer);

  return res.json({
    canBook: !elErr,
    blockCode: elErr?.code ?? null,
    sessionGrossKwd: (rate || clinicPay + cashbackApplied).toFixed(3),
    cashbackAppliedKwd: cashbackApplied.toFixed(3),
    clinicPayKwd: clinicPay.toFixed(3),
    sessionsUsed: consumed,
    sessionsCap: cap,
    installmentsPaid: uo.installmentsPaid ?? null,
    installmentCount: uo.installmentCount ?? null,
    isExtraSession,
  });
});

// ── Customer pays the session fee (mock) ────────────────────────────────────
customerRoutes.post("/me/requests/:id/pay-session", authRequired, async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (breq.userId !== req.auth!.userId) return res.status(403).json({ error: "FORBIDDEN" });
    if (breq.status !== "request_received") return res.status(409).json({ error: "INVALID_STATE" });
    if (!breq.sessionPaymentId) return res.status(400).json({ error: "NO_SESSION_PAYMENT" });

    const sessionPaymentId = breq.sessionPaymentId;
    const updated = await withTransaction(async () => {
      await confirmSessionPayment(sessionPaymentId);
      return bookingRequestsStore.update(breq.id, { status: "request_received" });
    });

    const [{ conv, csIds: convCsIds2 }, financeIds] = await Promise.all([
      ensureConversationFor(breq.id),
      findFinanceUserIds()
    ]);
    if (conv) {
      await postSystemMessage(
        conv.id,
        "booking_requested",
        `Customer paid session fee (${breq.sessionPriceKwd ?? ""} KWD) and submitted booking request${breq.preferredAt ? ` (preferred ${kwDateTime(breq.preferredAt)})` : ""}.${breq.notes ? ` Note: ${breq.notes}` : ""}`,
        { bookingRequestId: breq.id, preferredAt: breq.preferredAt }
      );
      const recipients = conv.participants.map((p: any) => p.userId).filter((u: any) => u !== req.auth!.userId);
      notifyChatRelatedUsers({
        userIds: recipients,
        kind: "booking_under_review",
        body: `New session booking (paid) from ${req.auth!.userId}`,
        payload: { bookingRequestId: breq.id }
      });
    }

    const additionalNotifyIds = breq.bookingRoute === "clinic"
      ? await findClinicStaffUserIds(breq.clinicId)
      : (convCsIds2.length ? convCsIds2 : await findCsUserIds());

    notifyBookingUnderReview(req.auth!.userId, breq.id);
    notifyChatRelatedUsers({
      userIds: Array.from(new Set([...additionalNotifyIds, ...financeIds])),
      kind: "booking_under_review",
      body: `Paid booking request ${breq.id}: clinic=${breq.clinicId}, price=${breq.sessionPriceKwd ?? "0.000"} KWD, membership=${breq.membershipType ?? "none"}, cashback=${breq.cashbackDeductedKwd ?? "0.000"} KWD`,
      payload: {
        bookingRequestId: breq.id,
        clinicId: breq.clinicId,
        sessionPriceKwd: breq.sessionPriceKwd ?? "0.000",
        membershipType: breq.membershipType ?? "none",
        cashbackDeductedKwd: breq.cashbackDeductedKwd ?? "0.000"
      }
    });

    return res.json({ request: updated, conversationId: conv?.id ?? null });
  } catch (e) {
    next(e);
  }
});

// ── Customer accepts a proposed slot and automatically schedules it ──────────
customerRoutes.post("/me/requests/:id/accept", authRequired, async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (breq.userId !== req.auth!.userId) return res.status(403).json({ error: "FORBIDDEN" });
    if (breq.status !== "slot_assigned") { return res.status(409).json({ error: "INVALID_STATE" }); }

    const scheduledAt = breq.proposedAt;
    if (!scheduledAt) return res.status(400).json({ error: "NO_SCHEDULED_TIME" });

    if (!breq.userOfferId) {
      return res.status(400).json({ error: "STANDALONE_USE_SCHEDULE_ENDPOINT" });
    }

    const uo = await loadUserOffer(breq.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    const offer = await loadOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
    const elErr = await eligibilityError(uo, offer, { skipSessionCap: true, scheduledAt });
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });

    const sessionClinicId = breq.clinicId || uo.clinicId;

    const { session, updated } = await withTransaction(async () => {
      // Re-check inside the transaction so a double-click can't create two sessions.
      const current = await bookingRequestsStore.get(breq.id);
      if (current?.status !== "slot_assigned") return { session: null, updated: null };

      const session = await sessionsStore.create({
        userOfferId: uo.id,
        userId: uo.userId,
        offerId: uo.offerId,
        clinicId: sessionClinicId,
        scheduledAt,
        scheduledBy: req.auth!.userId
      });

      if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
        await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: 1 } });
      }

      const finPreview = computeBookingRequestFinancials(breq, offer);
      await bookingRequestsStore.update(breq.id, {
        sessionPriceKwd: breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0 ? breq.sessionPriceKwd : finPreview.clinicTakeKwd,
        cashbackDeductedKwd: breq.cashbackDeductedKwd && parseFloat(breq.cashbackDeductedKwd) > 0 ? breq.cashbackDeductedKwd : finPreview.cashbackDeductedKwd,
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
        acceptedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
        confirmedBy: req.auth!.userId,
        scheduledSessionId: session.id,
        ...(sessionPaymentId ? { sessionPaymentId } : {})
      });
      return { session, updated };
    });
    if (!session) return res.status(409).json({ error: "INVALID_STATE" });

    if (updated?.conversationId) {
      await postSystemMessage(
        updated.conversationId,
        "booking_confirmed",
        `Customer accepted the proposed time. Booking is confirmed for ${kwDateTime(scheduledAt)}.`,
        { bookingRequestId: updated.id, sessionId: session.id, scheduledAt },
        req.auth!.userId
      );
    }

    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    
    // Notify customer
    notifyChatRelatedUsers({
      userIds: [uo.userId],
      kind: "booking_confirmed",
      body: `Your booking is confirmed for ${kwDateTime(scheduledAt)}`,
      payload: { sessionId: session.id, bookingRequestId: breq.id }
    });

    // Notify clinic & CS
    const clinicStaff = await findClinicStaffUserIds(breq.clinicId);
    const csIds = await findCsUserIds();
    notifyChatRelatedUsers({
      userIds: Array.from(new Set([...clinicStaff, ...csIds])),
      kind: "booking_confirmed",
      body: `Customer accepted and confirmed the booking for ${kwDateTime(scheduledAt)}`,
      payload: { sessionId: session.id, bookingRequestId: breq.id }
    });

    emitToUser(uo.userId, "booking:confirmed", { request: updated, session });

    return res.json({ request: updated, session });
  } catch (err: any) {
    next(err);
  }
});

// ── Customer cancels their request ─────────────────────────────────────────
customerRoutes.post("/me/requests/:id/cancel", authRequired, async (req, res) => {
  const parsed = CancelSchema.safeParse(req.body ?? {});
  // Same order of checks as before: request/ownership/state are verified before the body.
  const pre = await bookingRequestsStore.get(req.params.id);
  if (pre && pre.userId === req.auth!.userId && ["request_received", "slot_assigned"].includes(pre.status) && !parsed.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR" });
  }
  const { breq, updated } = await bookingService.cancelByCustomer({ userId: req.auth!.userId, role: req.auth!.role }, req.params.id);
  const reason = parsed.success ? parsed.data.reason : undefined;
  if (updated.conversationId) {
    await postSystemMessage(
      updated.conversationId,
      "booking_cancelled",
      `Customer cancelled the request${reason ? `: ${reason}` : ""}.`,
      { bookingRequestId: updated.id }
    );
  }
  const staffIds = await findClinicStaffUserIds(breq.clinicId);
  const csIds = await findCsUserIds();
  const financeIds = await findFinanceUserIds();
  notifyChatRelatedUsers({
    userIds: Array.from(new Set([...staffIds, ...csIds, ...financeIds])),
    kind: "booking_cancelled",
    body: `Customer cancelled booking request ${breq.id}${reason ? `: ${reason}` : ""}`,
    payload: { bookingRequestId: breq.id }
  });
  return res.json({ request: updated });
});
