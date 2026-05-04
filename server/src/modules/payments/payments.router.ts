import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { commerceStore } from "../commerce/commerce.store.js";
import { offersStore } from "../offers/offers.store.js";
import { notifyPaymentConfirmed } from "../notifications/notifications.service.js";

const KwdString = z.string().regex(/^\d+(\.\d{3})$/);

const ConfirmPaymentSchema = z.object({
  userOfferId: z.string().min(1),
  proofRef: z.string().min(1),
  method: z.enum(["bank_transfer", "cash", "pos", "other"]),
  amountKwd: KwdString
});

export const paymentsRouter = Router();

// CS pending payment queue (derived from userOffers)
paymentsRouter.get("/cs/pending", authRequired, requireRole(["cs", "admin"]), (_req, res) => {
  const items = commerceStore.listPendingPayments();
  return res.json({ items });
});

// CS confirms payment and activates the offer
paymentsRouter.post("/cs/confirm", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const parsed = ConfirmPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const uo = commerceStore.get(parsed.data.userOfferId);
  if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
  if (uo.status !== "pending_payment") return res.status(409).json({ error: "NOT_PENDING_PAYMENT" });

  const offer = offersStore.get(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

  const activatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + offer.validityDays * 24 * 60 * 60 * 1000).toISOString();

  const updated = commerceStore.confirmPaymentAndActivate({
    userOfferId: uo.id,
    confirmedBy: req.auth!.userId,
    proofRef: parsed.data.proofRef,
    method: parsed.data.method,
    amountKwd: parsed.data.amountKwd,
    activatedAt,
    expiresAt
  });

  if (!updated) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
  if ("error" in updated) return res.status(409).json({ error: updated.error });

  notifyPaymentConfirmed(updated.userId, updated.id);
  return res.json({ userOffer: updated });
});

