import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { kycStore } from "../kyc/kyc.store.js";
import * as offerService from "../../services/offer.service.js";
import * as clinicService from "../../services/clinic.service.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { notifyOfferPendingPayment } from "../notifications/notifications.service.js";

const SelectOfferSchema = z.object({
  offerId: z.string().min(1)
});

function isWithinWindow(offer: { startDate?: string; endDate?: string }, now: Date) {
  const s = offer.startDate ? new Date(offer.startDate) : null;
  const e = offer.endDate ? new Date(offer.endDate) : null;
  if (s && now < s) return false;
  if (e && now > e) return false;
  return true;
}

export const commerceRouter = Router();

commerceRouter.post("/select-offer", authRequired, async (req, res, next) => {
  try {
    const parsed = SelectOfferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const user = kycStore.getUser(req.auth!.userId);
    if (!user || user.verificationStatus !== "approved") {
      return res.status(403).json({ error: "KYC_REQUIRED" });
    }

    const offer = await offerService.getOffer(parsed.data.offerId);
    if (!offer) return res.status(404).json({ error: "OFFER_NOT_FOUND" });
    if (!offer.active) return res.status(400).json({ error: "OFFER_INACTIVE" });
    if (!isWithinWindow(offer, new Date())) return res.status(400).json({ error: "OFFER_OUTSIDE_WINDOW" });

    const clinic = await clinicService.getClinic(offer.clinicId);
    if (!clinic || !clinic.active) return res.status(400).json({ error: "CLINIC_NOT_FOUND_OR_INACTIVE" });

    if (offer.enrollmentCap != null) {
      const reserved = await userOfferService.countActiveAndPendingForOffer(offer.id);
      if (reserved >= offer.enrollmentCap) return res.status(409).json({ error: "ENROLLMENT_CAP_REACHED" });
    }

    const userOffer = await userOfferService.createPending({
      userId: req.auth!.userId,
      offerId: offer.id,
      clinicId: offer.clinicId
    });
    notifyOfferPendingPayment(req.auth!.userId, userOffer.id, offer.subscriptionPriceKwd);
    return res.status(201).json({ userOffer });
  } catch (e) {
    next(e);
  }
});

commerceRouter.get("/me/offers", authRequired, async (req, res, next) => {
  try {
    const items = await userOfferService.listUserOffersByUser(req.auth!.userId);
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});
