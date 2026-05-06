import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as userOfferService from "../../services/userOffer.service.js";
import * as offerService from "../../services/offer.service.js";
import * as paymentService from "../../services/payment.service.js";
import { notifyPaymentConfirmed } from "../notifications/notifications.service.js";

const KwdString = z.string().regex(/^\d+(\.\d{3})$/);

const ConfirmPaymentSchema = z.object({
  userOfferId: z.string().min(1),
  proofRef: z.string().min(1),
  method: z.enum(["bank_transfer", "cash", "pos", "other"]),
  amountKwd: KwdString
});

export const paymentsRouter = Router();

paymentsRouter.get("/cs/pending", authRequired, requireRole(["cs", "admin"]), async (_req, res, next) => {
  try {
    const items = await userOfferService.listPendingPaymentsQueue();
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

paymentsRouter.get("/", authRequired, requireRole(["admin", "finance"]), async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const result = await paymentService.listPaymentsAdmin({ status, page, limit, userId });
    return res.json(result);
  } catch (e) {
    next(e);
  }
});

paymentsRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const items = await paymentService.listPaymentsByUser(req.auth!.userId);
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

paymentsRouter.post("/cs/confirm", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    const parsed = ConfirmPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uo = await userOfferService.getUserOffer(parsed.data.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    if (uo.status !== "pending_payment") return res.status(409).json({ error: "NOT_PENDING_PAYMENT" });

    const offer = await offerService.getOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    const activatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + offer.validityDays * 24 * 60 * 60 * 1000).toISOString();

    const payment = await paymentService.createCompletedEnrollmentPayment({
      userId: uo.userId,
      offerId: uo.offerId,
      userOfferId: uo.id,
      amountKwd: parsed.data.amountKwd,
      method: parsed.data.method,
      proofRef: parsed.data.proofRef,
      confirmedBy: req.auth!.userId
    });

    const updated = await userOfferService.confirmPaymentAndActivate({
      userOfferId: uo.id,
      confirmedBy: req.auth!.userId,
      proofRef: parsed.data.proofRef,
      method: parsed.data.method,
      amountKwd: parsed.data.amountKwd,
      activatedAt,
      expiresAt,
      paymentId: payment.id
    });

    if (!updated) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    if (typeof updated === "object" && "error" in updated) return res.status(409).json({ error: updated.error });

    notifyPaymentConfirmed(updated.userId, updated.id);
    return res.json({ userOffer: updated, payment });
  } catch (e) {
    next(e);
  }
});
