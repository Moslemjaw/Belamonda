import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { commerceStore } from "../commerce/commerce.store.js";
import { offersStore } from "../offers/offers.store.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore } from "./sessions.store.js";
import { notifyBookingConfirmed, notifySessionCompletedCashback } from "../notifications/notifications.service.js";

const RequestSchema = z.object({
  userOfferId: z.string().min(1),
  preferredAt: z.string().datetime().optional()
});

const ScheduleSchema = z.object({
  userOfferId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional()
});

const MarkSchema = z.object({
  status: z.enum(["completed", "no_show", "cancelled"]),
  notes: z.string().optional()
});

function isWithinOfferValidity(userOffer: { activatedAt?: string; expiresAt?: string }, scheduledAt: Date) {
  if (!userOffer.activatedAt || !userOffer.expiresAt) return false;
  return scheduledAt >= new Date(userOffer.activatedAt) && scheduledAt <= new Date(userOffer.expiresAt);
}

export const schedulingRouter = Router();

// Customer requests a session (SRS §4.5.2)
schedulingRouter.post("/me/request", authRequired, (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  // For v1 we just validate eligibility and return earliest eligible date.
  const uo = commerceStore.get(parsed.data.userOfferId);
  if (!uo || uo.userId !== req.auth!.userId) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

  const user = kycStore.getUser(req.auth!.userId);
  if (!user || user.verificationStatus !== "approved") return res.status(403).json({ error: "KYC_REQUIRED" });
  if (uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

  const offer = offersStore.get(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

  if (offer.maxSessions != null && uo.sessionsUsed >= offer.maxSessions) {
    return res.status(409).json({ error: "MAX_SESSIONS_REACHED" });
  }

  const lastCompletedAt = sessionsStore.lastCompletedAt(uo.id);
  const intervalDays = offer.sessionIntervalDays ?? 0;
  const nextEligibleAt =
    !lastCompletedAt || intervalDays === 0
      ? new Date().toISOString()
      : new Date(new Date(lastCompletedAt).getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  return res.json({
    ok: true,
    lastCompletedAt,
    nextEligibleAt
  });
});

// CS schedules a session (SRS FR-18 + eligibility checks FR-17)
schedulingRouter.post("/cs/schedule", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const parsed = ScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const uo = commerceStore.get(parsed.data.userOfferId);
  if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

  const user = kycStore.getUser(uo.userId);
  if (!user || user.verificationStatus !== "approved") return res.status(403).json({ error: "KYC_NOT_APPROVED" });
  if (uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

  const offer = offersStore.get(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

  // validity must include the scheduled date
  const scheduledAtDate = new Date(parsed.data.scheduledAt);
  if (!isWithinOfferValidity(uo, scheduledAtDate)) return res.status(409).json({ error: "OFFER_OUT_OF_VALIDITY" });

  if (offer.maxSessions != null && uo.sessionsUsed >= offer.maxSessions) {
    return res.status(409).json({ error: "MAX_SESSIONS_REACHED" });
  }

  const lastCompletedAt = sessionsStore.lastCompletedAt(uo.id);
  if (lastCompletedAt && offer.sessionIntervalDays > 0) {
    const nextEligible = new Date(new Date(lastCompletedAt).getTime() + offer.sessionIntervalDays * 24 * 60 * 60 * 1000);
    if (scheduledAtDate < nextEligible) {
      return res.status(409).json({ error: "INTERVAL_NOT_MET", nextEligibleAt: nextEligible.toISOString() });
    }
  }

  if (sessionsStore.isSlotTaken(uo.clinicId, parsed.data.scheduledAt)) {
    return res.status(409).json({ error: "SLOT_TAKEN" });
  }

  const session = sessionsStore.create({
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
});

// Clinic schedule view (SRS FR-26 badges)
schedulingRouter.get("/clinic/:clinicId/schedule", authRequired, requireRole(["clinicStaff", "admin", "cs"]), (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = typeof req.query.to === "string" ? req.query.to : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const items = sessionsStore.listByClinic(req.params.clinicId, from, to).map((s) => {
    const uo = commerceStore.get(s.userOfferId);
    const offer = uo ? offersStore.get(uo.offerId) : null;
    const lastCompletedAt = uo ? sessionsStore.lastCompletedAt(uo.id) : null;
    const intervalDays = offer?.sessionIntervalDays ?? 0;
    const intervalMet =
      !lastCompletedAt || intervalDays === 0
        ? true
        : new Date(s.scheduledAt) >= new Date(new Date(lastCompletedAt).getTime() + intervalDays * 24 * 60 * 60 * 1000);

    return {
      ...s,
      eligibility: {
        offerActive: uo?.status === "active",
        paymentConfirmed: uo?.status === "active",
        intervalMet
      }
    };
  });

  return res.json({ items });
});

// Clinic marks a session status (SRS FR-19/20)
schedulingRouter.post("/clinic/sessions/:sessionId/mark", authRequired, requireRole(["clinicStaff", "admin"]), (req, res) => {
  const parsed = MarkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const session = sessionsStore.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "NOT_FOUND" });

  const uo = commerceStore.get(session.userOfferId);
  if (!uo || uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

  const offer = offersStore.get(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

  let cashbackUnlocked = "0.000";
  if (parsed.data.status === "completed") {
    // Increment sessions used (SRS)
    commerceStore.incrementSessionsUsed(uo.id);

    // Unlock cashback immediately upon completion (SRS §13)
    cashbackUnlocked = offer.cashbackPerSessionKwd ?? "0.000";
    kycStore.unlockCashbackFromLocked({
      userId: uo.userId,
      amountKwd: cashbackUnlocked,
      sessionId: session.id,
      createdById: "system"
    });
  }

  const updated = sessionsStore.mark({
    sessionId: session.id,
    status: parsed.data.status,
    markedBy: req.auth!.userId,
    notes: parsed.data.notes,
    cashbackUnlockedKwd: parsed.data.status === "completed" ? cashbackUnlocked : undefined
  });

  if (updated?.status === "completed") {
    notifySessionCompletedCashback(uo.userId, updated.id, cashbackUnlocked);
  }
  return res.json({ session: updated });
});

