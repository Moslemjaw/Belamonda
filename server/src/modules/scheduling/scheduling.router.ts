import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as userOfferService from "../../services/userOffer.service.js";
import * as offerService from "../../services/offer.service.js";
import * as bookingSessionService from "../../services/bookingSession.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { notifyBookingConfirmed, notifySessionCompletedCashback } from "../notifications/notifications.service.js";
import { findPaymentByUserOffer } from "../../services/payment.service.js";
import mongoose from "mongoose";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { OfferModel } from "../../models/offer.model.js";

const RequestSchema = z.object({
  userOfferId: z.string().min(1),
  preferredAt: z.string().datetime().optional(),
  notes: z.string().optional()
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

schedulingRouter.get("/me/sessions", authRequired, async (req, res, next) => {
  try {
    const items = await bookingSessionService.listByUser(req.auth!.userId);
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.post("/me/request", authRequired, async (req, res, next) => {
  try {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uo = await userOfferService.getUserOffer(parsed.data.userOfferId);
    if (!uo || uo.userId !== req.auth!.userId) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    const user = kycStore.getUser(req.auth!.userId);
    if (!user || user.verificationStatus !== "approved") return res.status(403).json({ error: "KYC_REQUIRED" });
    if (uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

    const offer = await offerService.getOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    if (offer.maxSessions != null && uo.sessionsUsed >= offer.maxSessions) {
      return res.status(409).json({ error: "MAX_SESSIONS_REACHED" });
    }

    const lastCompletedAt = await bookingSessionService.lastCompletedAt(uo.id);
    const intervalDays = offer.sessionIntervalDays ?? 0;
    const nextEligibleAt =
      !lastCompletedAt || intervalDays === 0
        ? new Date().toISOString()
        : new Date(new Date(lastCompletedAt).getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

    // Upsert a pending booking request so CS can schedule it.
    const requestDoc = await BookingRequestModel.findOneAndUpdate(
      {
        userOfferId: new mongoose.Types.ObjectId(uo.id),
        status: "pending"
      },
      {
        $set: {
          userId: uo.userId,
          offerId: new mongoose.Types.ObjectId(uo.offerId),
          clinicId: new mongoose.Types.ObjectId(uo.clinicId),
          preferredAt: parsed.data.preferredAt ? new Date(parsed.data.preferredAt) : undefined,
          notes: parsed.data.notes
        },
        $setOnInsert: { status: "pending" }
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({
      ok: true,
      lastCompletedAt,
      nextEligibleAt,
      request: requestDoc
        ? {
            id: String((requestDoc as any)._id),
            userOfferId: uo.id,
            clinicId: uo.clinicId,
            status: (requestDoc as any).status,
            preferredAt: (requestDoc as any).preferredAt ? new Date((requestDoc as any).preferredAt).toISOString() : undefined
          }
        : null
    });
  } catch (e) {
    next(e);
  }
});

// CS: view pending booking requests
schedulingRouter.get("/cs/requests", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const q: any = status === "all" ? {} : { status };
    const rows = await BookingRequestModel.find(q).sort({ createdAt: -1 }).limit(200).lean();
    const clinicIds = Array.from(new Set(rows.map((r: any) => String(r.clinicId))));
    const clinicRows = clinicIds.length
      ? await ClinicModel.find({ _id: { $in: clinicIds.map((id) => new mongoose.Types.ObjectId(id)) } }).lean()
      : [];
    const clinicById = new Map(clinicRows.map((c: any) => [String(c._id), c]));

    const items = rows.map((r: any) => {
      const clinic = clinicById.get(String(r.clinicId));
      return {
        id: String(r._id),
        userId: r.userId,
        userOfferId: String(r.userOfferId),
        offerId: String(r.offerId),
        clinicId: String(r.clinicId),
        clinicNameEn: clinic?.nameEn,
        clinicNameAr: clinic?.nameAr,
        status: r.status,
        preferredAt: r.preferredAt ? new Date(r.preferredAt).toISOString() : undefined,
        notes: r.notes,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined
      };
    });
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Clinic: view pending booking requests for its clinic
schedulingRouter.get(
  "/clinic/:clinicId/requests",
  authRequired,
  requireRole(["clinicStaff", "admin", "cs"]),
  async (req, res, next) => {
    try {
      const clinicId = req.params.clinicId;
      if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });
      const rows = await BookingRequestModel.find({ clinicId, status: "pending" }).sort({ createdAt: -1 }).limit(200).lean();
      const offerIds = Array.from(new Set(rows.map((r: any) => String(r.offerId))));
      const offers = offerIds.length
        ? await OfferModel.find({ _id: { $in: offerIds.map((id) => new mongoose.Types.ObjectId(id)) } })
            .select("_id name")
            .lean()
        : [];
      const offerById = new Map(offers.map((o: any) => [String(o._id), o]));
      const items = rows.map((r: any) => ({
        id: String(r._id),
        userId: r.userId,
        userOfferId: String(r.userOfferId),
        offerId: String(r.offerId),
        offerName: offerById.get(String(r.offerId))?.name,
        clinicId: String(r.clinicId),
        preferredAt: r.preferredAt ? new Date(r.preferredAt).toISOString() : undefined,
        notes: r.notes,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined
      }));
      return res.json({ items });
    } catch (e) {
      next(e);
    }
  }
);

// Clinic: schedule its own pending request
schedulingRouter.post(
  "/clinic/requests/:requestId/schedule",
  authRequired,
  requireRole(["clinicStaff", "admin"]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ error: "INVALID_ID" });
      const parsed = z
        .object({ scheduledAt: z.string().datetime(), notes: z.string().optional() })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

      const request = await BookingRequestModel.findById(req.params.requestId);
      if (!request) return res.status(404).json({ error: "NOT_FOUND" });
      if (request.status !== "pending") return res.status(409).json({ error: "NOT_PENDING" });

      const uo = await userOfferService.getUserOffer(String(request.userOfferId));
      if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

      const session = await bookingSessionService.createSession({
        userOfferId: uo.id,
        userId: uo.userId,
        offerId: uo.offerId,
        clinicId: uo.clinicId,
        scheduledAt: parsed.data.scheduledAt,
        scheduledBy: req.auth!.userId,
        notes: parsed.data.notes ?? request.notes,
        paymentId: uo.paymentId
      });
      request.status = "scheduled";
      request.scheduledSessionId = new mongoose.Types.ObjectId(session.id);
      await request.save();
      notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
      return res.status(201).json({ session, request: { id: String(request._id), status: request.status } });
    } catch (e) {
      next(e);
    }
  }
);

// CS: schedule a request (creates BookingSession and marks request as scheduled)
schedulingRouter.post("/cs/requests/:requestId/schedule", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(400).json({ error: "INVALID_ID" });
    const parsed = z
      .object({ scheduledAt: z.string().datetime(), notes: z.string().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const request = await BookingRequestModel.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: "NOT_FOUND" });
    if (request.status !== "pending") return res.status(409).json({ error: "NOT_PENDING" });

    const uo = await userOfferService.getUserOffer(String(request.userOfferId));
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    // Reuse same scheduling rules via existing cs schedule endpoint logic by calling service directly.
    const session = await bookingSessionService.createSession({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      scheduledAt: parsed.data.scheduledAt,
      scheduledBy: req.auth!.userId,
      notes: parsed.data.notes ?? request.notes,
      paymentId: uo.paymentId
    });
    request.status = "scheduled";
    request.scheduledSessionId = new mongoose.Types.ObjectId(session.id);
    await request.save();
    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    return res.status(201).json({ session, request: { id: String(request._id), status: request.status } });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.post("/cs/schedule", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    const parsed = ScheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uo = await userOfferService.getUserOffer(parsed.data.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    const user = kycStore.getUser(uo.userId);
    if (!user || user.verificationStatus !== "approved") return res.status(403).json({ error: "KYC_NOT_APPROVED" });
    if (uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

    const offer = await offerService.getOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    const scheduledAtDate = new Date(parsed.data.scheduledAt);
    if (!isWithinOfferValidity(uo, scheduledAtDate)) return res.status(409).json({ error: "OFFER_OUT_OF_VALIDITY" });

    if (offer.maxSessions != null && uo.sessionsUsed >= offer.maxSessions) {
      return res.status(409).json({ error: "MAX_SESSIONS_REACHED" });
    }

    const lastCompletedAt = await bookingSessionService.lastCompletedAt(uo.id);
    if (lastCompletedAt && offer.sessionIntervalDays > 0) {
      const nextEligible = new Date(new Date(lastCompletedAt).getTime() + offer.sessionIntervalDays * 24 * 60 * 60 * 1000);
      if (scheduledAtDate < nextEligible) {
        return res.status(409).json({ error: "INTERVAL_NOT_MET", nextEligibleAt: nextEligible.toISOString() });
      }
    }

    if (await bookingSessionService.isSlotTaken(uo.clinicId, parsed.data.scheduledAt)) {
      return res.status(409).json({ error: "SLOT_TAKEN" });
    }

    const session = await bookingSessionService.createSession({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      scheduledAt: parsed.data.scheduledAt,
      scheduledBy: req.auth!.userId,
      notes: parsed.data.notes,
      paymentId: uo.paymentId
    });

    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    return res.status(201).json({ session });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.get("/clinic/:clinicId/schedule", authRequired, requireRole(["clinicStaff", "admin", "cs"]), async (req, res, next) => {
  try {
    const from =
      typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to =
      typeof req.query.to === "string" ? req.query.to : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const itemsRaw = await bookingSessionService.listByClinic(req.params.clinicId, from, to);

    const items = await Promise.all(
      itemsRaw.map(async (s) => {
        const uo = await userOfferService.getUserOffer(s.userOfferId);
        const offer = uo ? await offerService.getOffer(uo.offerId) : null;
        const lastCompletedAt = uo ? await bookingSessionService.lastCompletedAt(uo.id) : null;
        const intervalDays = offer?.sessionIntervalDays ?? 0;
        const intervalMet =
          !lastCompletedAt || intervalDays === 0
            ? true
            : new Date(s.scheduledAt) >= new Date(new Date(lastCompletedAt).getTime() + intervalDays * 24 * 60 * 60 * 1000);

        const payment = uo ? await findPaymentByUserOffer(uo.id) : null;

        return {
          ...s,
          eligibility: {
            offerActive: uo?.status === "active",
            paymentConfirmed: uo?.status === "active",
            intervalMet
          },
          payment
        };
      })
    );

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.post("/clinic/sessions/:sessionId/mark", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const parsed = MarkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const session = await bookingSessionService.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });

    const uo = await userOfferService.getUserOffer(session.userOfferId);
    if (!uo || uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

    const offer = await offerService.getOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    let cashbackUnlocked = "0.000";
    if (parsed.data.status === "completed") {
      await userOfferService.incrementSessionsUsed(uo.id);
      cashbackUnlocked = offer.cashbackPerSessionKwd ?? "0.000";
      kycStore.unlockCashbackFromLocked({
        userId: uo.userId,
        amountKwd: cashbackUnlocked,
        sessionId: session.id,
        createdById: "system"
      });
    }

    const updated = await bookingSessionService.markSession({
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
  } catch (e) {
    next(e);
  }
});
