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
  method: z.enum(["bank_transfer", "cash", "pos", "free_package", "other"]),
  amountKwd: KwdString
});

export const paymentsRouter = Router();

paymentsRouter.get("/cs/pending", authRequired, requireRole(["cs", "admin", "legal", "cs_director"]), async (_req, res, next) => {
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

paymentsRouter.post("/cs/confirm", authRequired, requireRole(["cs", "admin", "legal", "cs_director"]), async (req, res, next) => {
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

    const { logAuditAction } = await import("../../services/audit.service.js");
    await logAuditAction({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role as any,
      actionType: "confirm_payment",
      targetEntityType: "Payment",
      targetEntityId: payment.id,
      afterState: { amountKwd: parsed.data.amountKwd, method: parsed.data.method, status: "completed" },
      metadata: { userId: uo.userId, offerId: uo.offerId, userOfferId: uo.id },
    });

    await userOfferService.applyOfferMembershipToUserOffer(updated.id, uo.offerId);
    const refreshedUo = await userOfferService.getUserOffer(updated.id);

    notifyPaymentConfirmed(refreshedUo?.userId ?? updated.userId, refreshedUo?.id ?? updated.id);
    notifyMembershipActivated(
      refreshedUo?.userId ?? updated.userId,
      refreshedUo?.id ?? updated.id,
      (offer as { name?: string }).name ?? "Offer",
      expiresAt
    );

    // Grant signup cashback — per-installment aware
    // Rules:
    //   Full / ENET → 100% cashback unlocked immediately
    //   Installments → even split (e.g. 50/50 for 2, 33/33/33 for 3)
    //   Deposit → NO cashback until converted to full/installments
    const signupBonus = (offer as { signupCashbackKwd?: string }).signupCashbackKwd ?? "0.000";
    const [ia, ib = "000"] = signupBonus.split(".");
    const signupBonusMils = Number(ia) * 1000 + Number(ib.padEnd(3, "0").slice(0, 3));
    const isCashbackOnly = !!(offer as { isCashbackOnly?: boolean }).isCashbackOnly;
    const isDeposit = (uo as any).purchaseMode === "deposit";
    if (signupBonusMils > 0 && !isDeposit) {
      const userId = refreshedUo?.userId ?? updated.userId;
      const uoId = refreshedUo?.id ?? updated.id;
      const isInstallments = (uo as any).purchaseMode === "installments";
      const totalInstallments = isInstallments ? ((uo as any).installmentCount ?? 1) : 1;

      // Step 1: Credit full amount to wallet locked pool on FIRST installment only
      // creditOfferCashback has built-in dedup (only credits once per userOffer).
      const currentInstallment = isInstallments ? (refreshedUo?.installmentsPaid ?? 1) : 1;
      if (currentInstallment === 1) {
        await kycStore.creditOfferCashback({
          userId,
          amountKwd: signupBonus,
          userOfferId: uoId,
          createdById: req.auth!.userId
        });
      }

      // Step 2: Unlock proportional share — even split across installments
      let thisAmountMils = signupBonusMils;
      if (isInstallments && totalInstallments > 1) {
        const perInstallment = Math.floor(signupBonusMils / totalInstallments);
        const remainder = signupBonusMils - perInstallment * totalInstallments;
        // First installment absorbs rounding remainder
        thisAmountMils = perInstallment + (currentInstallment === 1 ? remainder : 0);
      }

      const fmtKwd = (m: number) => `${Math.floor(m / 1000)}.${String(m % 1000).padStart(3, "0")}`;

      await kycStore.grantSignupCashback({
        userId,
        amountKwd: fmtKwd(thisAmountMils),
        userOfferId: uoId,
        createdById: req.auth!.userId,
        createdByKind: "cs",
        installmentNumber: totalInstallments > 1 ? currentInstallment : undefined
      });

      // Update userOffer tracking + set spendable cashback balance
      const { UserOfferModel } = await import("../../models/userOffer.model.js");
      const currentUo = await UserOfferModel.findById(uoId).select("cashbackGrantedKwd cashbackBalanceKwd").lean() as any;
      const previousGranted = currentUo?.cashbackGrantedKwd ? (Number(currentUo.cashbackGrantedKwd.split(".")[0]) * 1000 + Number(currentUo.cashbackGrantedKwd.split(".")[1].padEnd(3, "0").slice(0, 3))) : 0;
      const previousBalance = currentUo?.cashbackBalanceKwd ? (Number(currentUo.cashbackBalanceKwd.split(".")[0]) * 1000 + Number(currentUo.cashbackBalanceKwd.split(".")[1].padEnd(3, "0").slice(0, 3))) : 0;
      
      await UserOfferModel.findByIdAndUpdate(uoId, {
        $set: {
          totalSignupCashbackKwd: signupBonus,
          cashbackGrantedKwd: fmtKwd(previousGranted + thisAmountMils),
          cashbackBalanceKwd: fmtKwd(previousBalance + thisAmountMils)
        }
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
