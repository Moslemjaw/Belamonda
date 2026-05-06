import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { kycStore } from "../kyc/kyc.store.js";
import * as offerService from "../../services/offer.service.js";
import * as clinicService from "../../services/clinic.service.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { notifyOfferPendingPayment } from "../notifications/notifications.service.js";
import mongoose from "mongoose";
import { OfferModel } from "../../models/offer.model.js";
import { ClinicModel } from "../../models/clinic.model.js";

const SelectOfferSchema = z.object({
  offerId: z.string().min(1),
  paymentOption: z.enum(["full", "installments", "deposit"]).optional(),
  installments: z.number().int().min(1).optional()
});

function toKwd3(n: number): string {
  const v = Math.max(0, n);
  return v.toFixed(3);
}

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

    const payOpt = parsed.data.paymentOption ?? "full";
    const allowFull = (offer as any).allowFullPayment !== false;
    const allowInst = (offer as any).allowInstallments === true;
    const allowDep = (offer as any).allowDeposit === true;
    const maxInst = Number((offer as any).maxInstallments ?? 1);
    const depositAmount = Number((offer as any).depositAmountKwd ?? "0.000");
    const price = Number(offer.subscriptionPriceKwd);

    if (payOpt === "full" && !allowFull) return res.status(400).json({ error: "PAYMENT_OPTION_NOT_ALLOWED" });
    if (payOpt === "installments" && !allowInst) return res.status(400).json({ error: "PAYMENT_OPTION_NOT_ALLOWED" });
    if (payOpt === "deposit" && !allowDep) return res.status(400).json({ error: "PAYMENT_OPTION_NOT_ALLOWED" });

    let amountKwd = offer.subscriptionPriceKwd;
    if (payOpt === "installments") {
      const inst = Math.min(maxInst, Math.max(1, parsed.data.installments ?? maxInst));
      amountKwd = toKwd3(price / inst);
    } else if (payOpt === "deposit") {
      amountKwd = toKwd3(depositAmount);
    }

    const userOffer = await userOfferService.createPending({
      userId: req.auth!.userId,
      offerId: offer.id,
      clinicId: offer.clinicId,
      paymentMethod: payOpt,
      paymentAmountKwd: amountKwd
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

    const offerIds = Array.from(new Set(items.map((i) => i.offerId).filter((id) => mongoose.isValidObjectId(id))));
    const clinicIds = Array.from(new Set(items.map((i) => i.clinicId).filter((id) => mongoose.isValidObjectId(id))));

    const offers = offerIds.length
      ? await OfferModel.find({ _id: { $in: offerIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select("_id name")
          .lean()
      : [];
    const clinics = clinicIds.length
      ? await ClinicModel.find({ _id: { $in: clinicIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select("_id nameEn nameAr")
          .lean()
      : [];

    const offerById = new Map(offers.map((o: any) => [String(o._id), o]));
    const clinicById = new Map(clinics.map((c: any) => [String(c._id), c]));

    const enriched = items.map((i: any) => ({
      ...i,
      offerName: offerById.get(String(i.offerId))?.name,
      clinicNameEn: clinicById.get(String(i.clinicId))?.nameEn,
      clinicNameAr: clinicById.get(String(i.clinicId))?.nameAr
    }));

    return res.json({ items: enriched });
  } catch (e) {
    next(e);
  }
});
