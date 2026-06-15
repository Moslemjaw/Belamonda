import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";

const customerOnly = [authRequired, requireRole(["customer"])] as const;
import {
  checkoutFull,
  checkoutInstallments,
  checkoutEnet4,
  reserveWithDeposit,
  payNextInstallment,
  convertReservation
} from "../../services/checkout.service.js";
import {
  listDepositReservationsByUser,
  listAllDepositReservations
} from "../../services/userOffer.service.js";
import { handleFirstPurchaseReferral } from "../referral/referral.service.js";

const KwdString = z.string().regex(/^\d+(\.\d{3})$/);

export const checkoutRouter = Router();

const FullSchema = z.object({
  offerId: z.string().min(1),
  userOfferId: z.string().optional(),
  applyCashbackKwd: KwdString.optional(),
  groupInviteCode: z.string().optional(),
  clinicId: z.string().optional()
});

const InstallmentsSchema = z.object({
  offerId: z.string().min(1),
  userOfferId: z.string().optional(),
  count: z.number().int().min(2),
  applyCashbackKwd: KwdString.optional(),
  groupInviteCode: z.string().optional(),
  clinicId: z.string().optional()
});

const Enet4Schema = z.object({
  offerId: z.string().min(1),
  userOfferId: z.string().optional(),
  applyCashbackKwd: KwdString.optional(),
  groupInviteCode: z.string().optional(),
  clinicId: z.string().optional()
});

const DepositSchema = z.object({
  offerId: z.string().min(1),
  userOfferId: z.string().optional(),
  expectedCompletionDate: z.string().datetime().optional(),
  preferredPlan: z.enum(["full", "installments_2", "installments_3", "installments_4_enet"]).optional(),
  reservationDays: z.number().int().min(1).max(60).optional(),
  applyCashbackKwd: KwdString.optional(),
  groupInviteCode: z.string().optional(),
  clinicId: z.string().optional()
});

const PayNextSchema = z.object({ 
  userOfferId: z.string().min(1),
  method: z.string().optional(),
  proofRef: z.string().optional()
});

const ConvertSchema = z
  .object({
    userOfferId: z.string().min(1),
    plan: z.enum(["full", "installments_2", "installments_3", "installments_4_enet"]).optional(),
    payMode: z.enum(["full", "installments_2", "installments_3", "installments_4_enet"]).optional(),
    applyCashbackKwd: KwdString.optional()
  })
  .refine((d) => !!(d.plan || d.payMode), { message: "plan_required" });

type HttpErr = { status: number; code: string };
function isHttpErr(e: unknown): e is HttpErr {
  return typeof e === "object" && e !== null
    && typeof (e as { status?: unknown }).status === "number"
    && typeof (e as { code?: unknown }).code === "string";
}

interface EnetResult { approved: boolean; [k: string]: unknown }
interface CheckoutWithEnet { enet?: EnetResult; [k: string]: unknown }

function handleErr(e: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (isHttpErr(e)) return res.status(e.status).json({ error: e.code, ...(e as any).data });
  next(e);
}

checkoutRouter.post("/full", ...customerOnly, (req, res, next) => {
  const parsed = FullSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const uid = req.auth!.userId;
  checkoutFull({ userId: uid, ...parsed.data })
    .then((out) => { res.json(out); void handleFirstPurchaseReferral(uid); })
    .catch((e: unknown) => handleErr(e, res, next));
});

checkoutRouter.post("/installments", ...customerOnly, (req, res, next) => {
  const parsed = InstallmentsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const uid = req.auth!.userId;
  checkoutInstallments({
    userId: uid,
    offerId: parsed.data.offerId,
    count: parsed.data.count,
    applyCashbackKwd: parsed.data.applyCashbackKwd,
    groupInviteCode: parsed.data.groupInviteCode,
    clinicId: parsed.data.clinicId
  })
    .then((out) => { res.json(out); void handleFirstPurchaseReferral(uid); })
    .catch((e: unknown) => handleErr(e, res, next));
});

checkoutRouter.post("/installments/pay-next", ...customerOnly, (req, res, next) => {
  const parsed = PayNextSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  payNextInstallment({ userId: req.auth!.userId, userOfferId: parsed.data.userOfferId, method: parsed.data.method, proofRef: parsed.data.proofRef })
    .then((out) => res.json(out))
    .catch((e: unknown) => handleErr(e, res, next));
});

checkoutRouter.post("/enet4", ...customerOnly, (req, res, next) => {
  const parsed = Enet4Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const uid = req.auth!.userId;
  checkoutEnet4({ userId: uid, ...parsed.data })
    .then((out) => {
      res.json(out);
      if ((out as CheckoutWithEnet).enet?.approved) void handleFirstPurchaseReferral(uid);
    })
    .catch((e: unknown) => handleErr(e, res, next));
});

checkoutRouter.post("/deposit", ...customerOnly, (req, res, next) => {
  const parsed = DepositSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const uid = req.auth!.userId;
  reserveWithDeposit({ userId: uid, ...parsed.data })
    .then((out) => { res.json(out); void handleFirstPurchaseReferral(uid); })
    .catch((e: unknown) => handleErr(e, res, next));
});

checkoutRouter.post("/deposit/convert", ...customerOnly, (req, res, next) => {
  const parsed = ConvertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const { userOfferId, plan, payMode, applyCashbackKwd } = parsed.data;
  const uid = req.auth!.userId;
  convertReservation({
    userId: uid,
    userOfferId,
    payMode: (plan ?? payMode)!,
    applyCashbackKwd
  })
    .then((out) => {
      res.json(out);
      const typed = out as CheckoutWithEnet;
      if (!typed.enet || typed.enet.approved) void handleFirstPurchaseReferral(uid);
    })
    .catch((e: unknown) => handleErr(e, res, next));
});

checkoutRouter.get("/me/reservations", ...customerOnly, (req, res, next) => {
  listDepositReservationsByUser(req.auth!.userId)
    .then((items) => res.json({ items }))
    .catch(next);
});

checkoutRouter.get("/reservations/all", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), (req, res, next) => {
  listAllDepositReservations()
    .then((items) => res.json({ items }))
    .catch(next);
});

checkoutRouter.get("/group-invite/:code", authRequired, async (req, res, next) => {
  try {
    const uo = await UserOfferModel.findOne({
      groupInviteCode: req.params.code,
      membershipType: "group"
    }).lean();
    if (!uo) return res.status(404).json({ error: "INVALID_INVITE_CODE" });
    const offer = await OfferModel.findById((uo as any).offerId).lean();
    if (!offer) return res.status(404).json({ error: "OFFER_NOT_FOUND" });
    const o = offer as any;
    return res.json({
      offerId: String(o._id),
      name: o.name,
      nameAr: o.nameAr,
      subscriptionPriceKwd: o.subscriptionPriceKwd,
      allowFullPayment: o.allowFullPayment,
      allowInstallments: o.allowInstallments,
      maxInstallments: o.maxInstallments,
      allowDeposit: o.allowDeposit,
      depositAmountKwd: o.depositAmountKwd,
      clinicId: o.clinicId ? String(o.clinicId) : undefined,
      clinicIds: (o.clinicIds || []).map(String),
      clinicLocked: o.clinicLocked,
      requireBranchSelection: o.requireBranchSelection,
      membershipType: o.membershipType,
      clinicTransferFeeKwd: o.clinicTransferFeeKwd,
      validityDays: o.validityDays,
      isGroupOffer: o.isGroupOffer,
      groupRewardType: o.groupRewardType,
      groupSizeRequired: o.groupSizeRequired,
      groupRewardValue: o.groupRewardValue,
      cashbackEligible: o.cashbackEligible,
      maxCashbackPerPurchaseKwd: o.maxCashbackPerPurchaseKwd,
    });
  } catch (e) {
    next(e);
  }
});
