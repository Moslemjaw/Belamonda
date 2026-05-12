import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as userOfferService from "../../services/userOffer.service.js";
import * as offerService from "../../services/offer.service.js";
import * as paymentService from "../../services/payment.service.js";
import { notifyPaymentConfirmed, notifyMembershipActivated } from "../notifications/notifications.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { PaymentModel } from "../../models/payment.model.js";
import { UserModel } from "../../models/user.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { ClinicModel } from "../../models/clinic.model.js";

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

    const offerIds = [...new Set(items.map((i) => i.offerId).filter(Boolean))].filter((id) => mongoose.isValidObjectId(id));
    const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean))].filter((id) => mongoose.isValidObjectId(id));
    const clinicIds = [...new Set(items.map((i) => i.clinicId).filter(Boolean))].filter((id) => mongoose.isValidObjectId(id));

    const [offers, users, clinics] = await Promise.all([
      OfferModel.find({ _id: { $in: offerIds } }).select("name nameAr subscriptionPriceKwd depositAmountKwd").lean(),
      UserModel.find({ _id: { $in: userIds } }).select("fullName username email phone").lean(),
      ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn nameAr").lean(),
    ]);

    const offerMap = Object.fromEntries(offers.map((o: any) => [o._id.toString(), o]));
    const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), u]));
    const clinicMap = Object.fromEntries(clinics.map((c: any) => [c._id.toString(), c]));

    const enriched = items.map((item) => {
      const offer: any = offerMap[item.offerId] || {};
      const user: any = userMap[item.userId] || {};
      const clinic: any = clinicMap[item.clinicId] || {};

      let amount = item.paymentAmountKwd;
      if (!amount && item.purchaseMode === "installments") {
        const firstUnpaid = (item.installmentSchedule || []).find((s) => !s.paid);
        amount = firstUnpaid?.amountKwd || (item.installmentSchedule?.[0] as any)?.amountKwd;
      }
      if (!amount && item.purchaseMode === "deposit") {
        amount = item.depositAmountKwd || offer.depositAmountKwd;
      }
      if (!amount) {
        amount = offer.subscriptionPriceKwd;
      }

      return {
        ...item,
        offerName: offer.name || item.offerId,
        offerNameAr: offer.nameAr || undefined,
        offerPriceKwd: offer.subscriptionPriceKwd || undefined,
        userName: user.fullName || user.username || item.userId,
        userPhone: user.phone || undefined,
        userEmail: user.email || undefined,
        clinicNameEn: clinic.nameEn || undefined,
        clinicNameAr: clinic.nameAr || undefined,
        amount: amount || undefined,
      };
    });

    return res.json({ items: enriched });
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

    const cbKwd = (uo as any).cashbackAppliedKwd;
    if (cbKwd && cbKwd !== "0.000") {
      await kycStore.deductUnlocked({
        userId: uo.userId,
        amountKwd: cbKwd,
        reference: { kind: "userOffer", id: uo.id },
        createdBy: { kind: "cs", id: req.auth!.userId }
      });
    }

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

    await userOfferService.applyOfferMembershipToUserOffer(updated.id, uo.offerId);
    const refreshedUo = await userOfferService.getUserOffer(updated.id);

    notifyPaymentConfirmed(refreshedUo?.userId ?? updated.userId, refreshedUo?.id ?? updated.id);
    notifyMembershipActivated(
      refreshedUo?.userId ?? updated.userId,
      refreshedUo?.id ?? updated.id,
      (offer as { name?: string }).name ?? "Offer",
      expiresAt
    );

    // Grant signup cashback if the offer awards one (attributed to the CS operator)
    const signupBonus = (offer as { signupCashbackKwd?: string }).signupCashbackKwd ?? "0.000";
    const [ia, ib = "000"] = signupBonus.split(".");
    if (Number(ia) * 1000 + Number(ib.padEnd(3, "0").slice(0, 3)) > 0) {
      await kycStore.grantSignupCashback({
        userId: refreshedUo?.userId ?? updated.userId,
        amountKwd: signupBonus,
        userOfferId: refreshedUo?.id ?? updated.id,
        createdById: req.auth!.userId,
        createdByKind: "cs"
      });
    }
    // Always snapshot wallet balance after payment for accurate historical per-transaction balance
    const wallet = await kycStore.getWallet(updated.userId);
    let freshPayment = payment;
    if (wallet && mongoose.isValidObjectId(payment.id)) {
      const refreshed = await PaymentModel.findByIdAndUpdate(
        payment.id,
        { $set: { customerWalletBalanceAfterKwd: wallet.unlockedKwd } },
        { new: true }
      ).lean();
      if (refreshed) {
        const { serializePayment } = await import("../../utils/serialize.js");
        freshPayment = serializePayment(refreshed as any);
      }
    }

    return res.json({ userOffer: refreshedUo ?? updated, payment: freshPayment });
  } catch (e) {
    next(e);
  }
});
