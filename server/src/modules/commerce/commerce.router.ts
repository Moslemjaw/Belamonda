import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { kycStore } from "../kyc/kyc.store.js";
import * as offerService from "../../services/offer.service.js";
import * as clinicService from "../../services/clinic.service.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { notifyOfferPendingPayment } from "../notifications/notifications.service.js";
import { listRequiredFormsForUser } from "../eforms/eforms.router.js";
import { UserOfferModel, type UserOfferDoc } from "../../models/userOffer.model.js";
import { OfferModel, type OfferDoc } from "../../models/offer.model.js";
import { ClinicModel, type ClinicDoc } from "../../models/clinic.model.js";
import { UserModel } from "../../models/user.model.js";
import { ClinicChangeRequestModel } from "../../models/clinicChangeRequest.model.js";
import { getProviderForMethod } from "../../services/paymentProvider.service.js";
import { allowedPurchaseClinicIds, resolvePurchaseClinicObjectId } from "../../services/checkout.service.js";

function transferFeeMils(s: string | undefined): number {
  if (!s) return 0;
  const [a, b = "000"] = String(s).split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

function escalatingFeeKwd(approvedCount: number): string {
  if (approvedCount === 0) return "10.000";
  if (approvedCount === 1) return "20.000";
  return "30.000";
}

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

const JoinGroupSchema = z.object({ inviteCode: z.string().min(1) });
commerceRouter.post("/me/offers/join", authRequired, async (req, res, next) => {
  try {
    const parsed = JoinGroupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const { UserOfferModel } = await import("../../models/userOffer.model.js");
    const uo = await UserOfferModel.findOne({ groupInviteCode: parsed.data.inviteCode, membershipType: "group" });
    if (!uo) return res.status(404).json({ error: "INVALID_INVITE_CODE" });

    const uid = req.auth!.userId;
    if (uo.userId === uid) return res.status(409).json({ error: "CANNOT_JOIN_OWN_GROUP" });
    if (uo.sharedWith && uo.sharedWith.includes(uid)) return res.json({ ok: true, message: "ALREADY_JOINED" });

    await UserOfferModel.findByIdAndUpdate(uo._id, { $addToSet: { sharedWith: uid } });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

commerceRouter.post("/select-offer", authRequired, async (req, res, next) => {
  try {
    const parsed = SelectOfferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const user = await kycStore.getUser(req.auth!.userId);
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

    const targets = [{ kind: "offer", refId: offer.id }];
    const pendingForms = await listRequiredFormsForUser(req.auth!.userId, targets, "first_payment");
    if (pendingForms.length) {
      return res.status(409).json({ error: "EFORMS_REQUIRED", forms: pendingForms });
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

/** List current user's memberships, enriched with offer details (clinicLocked, branchSessionPrices, name). */
commerceRouter.get("/me/offers", authRequired, async (req, res, next) => {
  try {
    const items = await userOfferService.listUserOffersByUser(req.auth!.userId);

    const offerIds = [...new Set(items.map((i) => i.offerId).filter(Boolean))].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const offers = await OfferModel.find({ _id: { $in: offerIds } })
      .select("name nameAr clinicLocked branchSessionPrices")
      .lean();
    const offerMap = Object.fromEntries(offers.map((o: any) => [o._id.toString(), o]));

    const enriched = items.map((item) => {
      const offer: any = offerMap[item.offerId] || {};
      return {
        ...item,
        offerName: offer.name || undefined,
        offerNameAr: offer.nameAr || undefined,
        clinicLocked: offer.clinicLocked ?? undefined,
        branchSessionPrices: offer.branchSessionPrices || [],
      };
    });

    return res.json({ items: enriched });
  } catch (e) {
    next(e);
  }
});

const ChangeClinicSchema = z.object({
  newClinicId: z.string().min(1),
  confirmPayTransferFee: z.boolean().optional()
});

/** Move an active membership to another branch allowed by the offer; may charge clinicTransferFeeKwd. */
commerceRouter.post("/me/user-offers/:uoId/change-clinic", authRequired, requireRole(["customer"]), async (req, res, next) => {
  try {
    const parsed = ChangeClinicSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const uid = req.auth!.userId;
    if (!mongoose.isValidObjectId(req.params.uoId)) return res.status(400).json({ error: "INVALID_ID" });

    const uo = await UserOfferModel.findOne({ _id: req.params.uoId, userId: uid }).lean<UserOfferDoc | null>();
    if (!uo) return res.status(404).json({ error: "NOT_FOUND" });
    if (uo.status !== "active") return res.status(409).json({ error: "MEMBERSHIP_NOT_ACTIVE" });

    const offer = await OfferModel.findById(uo.offerId).lean<OfferDoc | null>();
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    // clinicLocked offers require a CS-approved change request, not a direct switch
    if ((offer as any).clinicLocked === true) {
      return res.status(403).json({ error: "CLINIC_LOCKED_USE_CHANGE_REQUEST" });
    }

    const newOid = resolvePurchaseClinicObjectId(offer, parsed.data.newClinicId);
    if (String(uo.clinicId) === String(newOid)) {
      return res.status(400).json({ error: "SAME_CLINIC" });
    }

    const fee = (offer as { clinicTransferFeeKwd?: string }).clinicTransferFeeKwd ?? "0.000";
    if (transferFeeMils(fee) > 0 && !parsed.data.confirmPayTransferFee) {
      return res.status(402).json({ error: "CLINIC_TRANSFER_FEE_REQUIRED", amountKwd: fee });
    }
    if (transferFeeMils(fee) > 0) {
      const provider = getProviderForMethod("card_mock");
      const result = await provider.charge({
        userId: uid,
        amountKwd: fee,
        description: `Clinic transfer fee (${allowedPurchaseClinicIds(offer).length} branches)`
      });
      if (!result.success) {
        return res.status(402).json({ error: "TRANSFER_FEE_PAYMENT_FAILED", reason: result.failureReason });
      }
    }

    await UserOfferModel.findByIdAndUpdate(uo._id, { $set: { clinicId: newOid } });
    return res.json({ ok: true, clinicId: String(newOid) });
  } catch (e) {
    next(e);
  }
});

// ─── Clinic Change Requests (clinicLocked offers) ─────────────────────────────

const ClinicChangeRequestSchema = z.object({
  toClinicId: z.string().min(1),
});

/**
 * Customer submits a clinic change request for a clinicLocked membership.
 * Fee escalates: 1st request = 10 KWD, 2nd = 20 KWD, 3rd+ = 30 KWD.
 */
commerceRouter.post("/me/user-offers/:uoId/clinic-change-request", authRequired, requireRole(["customer"]), async (req, res, next) => {
  try {
    const parsed = ClinicChangeRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uid = req.auth!.userId;
    if (!mongoose.isValidObjectId(req.params.uoId)) return res.status(400).json({ error: "INVALID_ID" });

    const uo = await UserOfferModel.findOne({ _id: req.params.uoId, userId: uid }).lean<UserOfferDoc | null>();
    if (!uo) return res.status(404).json({ error: "NOT_FOUND" });
    if (uo.status !== "active") return res.status(409).json({ error: "MEMBERSHIP_NOT_ACTIVE" });

    const offer = await OfferModel.findById(uo.offerId).lean<OfferDoc | null>();
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
    if ((offer as any).clinicLocked !== true) {
      return res.status(400).json({ error: "OFFER_NOT_CLINIC_LOCKED" });
    }

    if (String(uo.clinicId) === parsed.data.toClinicId) {
      return res.status(400).json({ error: "SAME_CLINIC" });
    }

    if (!mongoose.isValidObjectId(parsed.data.toClinicId)) {
      return res.status(400).json({ error: "INVALID_CLINIC_ID" });
    }

    const toClinic = await ClinicModel.findById(parsed.data.toClinicId).lean<ClinicDoc | null>();
    if (!toClinic || !(toClinic as any).active) {
      return res.status(400).json({ error: "CLINIC_NOT_FOUND_OR_INACTIVE" });
    }

    // Block if there's already a pending request for this membership
    const existing = await ClinicChangeRequestModel.findOne({
      userOfferId: uo._id,
      status: "pending",
    }).lean();
    if (existing) {
      return res.status(409).json({ error: "CHANGE_REQUEST_ALREADY_PENDING" });
    }

    // Count previously approved changes to determine escalating fee
    const approvedCount = await ClinicChangeRequestModel.countDocuments({
      userOfferId: uo._id,
      status: "approved",
    });
    const changeNumber = approvedCount + 1;
    const feeKwd = escalatingFeeKwd(approvedCount);

    const request = await ClinicChangeRequestModel.create({
      userId: uid,
      userOfferId: uo._id,
      offerId: uo.offerId,
      fromClinicId: uo.clinicId,
      toClinicId: new mongoose.Types.ObjectId(parsed.data.toClinicId),
      changeNumber,
      feeKwd,
      status: "pending",
    });

    return res.status(201).json({
      ok: true,
      requestId: request._id.toString(),
      feeKwd,
      changeNumber,
    });
  } catch (e) {
    next(e);
  }
});

/** Customer views their own clinic change requests. */
commerceRouter.get("/me/clinic-change-requests", authRequired, async (req, res, next) => {
  try {
    const uid = req.auth!.userId;
    const requests = await ClinicChangeRequestModel.find({ userId: uid })
      .sort({ createdAt: -1 })
      .lean();

    const clinicIds = [...new Set([
      ...requests.map((r: any) => r.fromClinicId?.toString()),
      ...requests.map((r: any) => r.toClinicId?.toString()),
    ].filter(Boolean))].filter((id) => mongoose.isValidObjectId(id));

    const clinics = await ClinicModel.find({ _id: { $in: clinicIds } })
      .select("nameEn nameAr")
      .lean();
    const clinicMap = Object.fromEntries(clinics.map((c: any) => [c._id.toString(), c]));

    const items = requests.map((r: any) => {
      const from: any = clinicMap[r.fromClinicId?.toString()] || {};
      const to: any = clinicMap[r.toClinicId?.toString()] || {};
      return {
        id: r._id.toString(),
        userOfferId: r.userOfferId?.toString(),
        fromClinicId: r.fromClinicId?.toString(),
        toClinicId: r.toClinicId?.toString(),
        fromClinicNameEn: from.nameEn,
        fromClinicNameAr: from.nameAr,
        toClinicNameEn: to.nameEn,
        toClinicNameAr: to.nameAr,
        changeNumber: r.changeNumber,
        feeKwd: r.feeKwd,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : undefined,
      };
    });

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

/** CS/Admin: list all pending clinic change requests, enriched with user, clinic, and offer names. */
commerceRouter.get("/cs/clinic-change-requests", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    const statusFilter = typeof req.query.status === "string" ? req.query.status : "pending";
    const requests = await ClinicChangeRequestModel.find({ status: statusFilter })
      .sort({ createdAt: 1 })
      .lean();

    const userIds = [...new Set(requests.map((r: any) => r.userId).filter(Boolean))].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const offerIds = [...new Set(requests.map((r: any) => r.offerId?.toString()).filter(Boolean))].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const clinicIds = [...new Set([
      ...requests.map((r: any) => r.fromClinicId?.toString()),
      ...requests.map((r: any) => r.toClinicId?.toString()),
    ].filter(Boolean))].filter((id) => mongoose.isValidObjectId(id));

    const [users, offers, clinics] = await Promise.all([
      UserModel.find({ _id: { $in: userIds } }).select("fullName username email phone").lean(),
      OfferModel.find({ _id: { $in: offerIds } }).select("name nameAr").lean(),
      ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn nameAr").lean(),
    ]);

    const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), u]));
    const offerMap = Object.fromEntries(offers.map((o: any) => [o._id.toString(), o]));
    const clinicMap = Object.fromEntries(clinics.map((c: any) => [c._id.toString(), c]));

    const items = requests.map((r: any) => {
      const user: any = userMap[r.userId] || {};
      const offer: any = offerMap[r.offerId?.toString()] || {};
      const from: any = clinicMap[r.fromClinicId?.toString()] || {};
      const to: any = clinicMap[r.toClinicId?.toString()] || {};
      return {
        id: r._id.toString(),
        userOfferId: r.userOfferId?.toString(),
        userId: r.userId,
        userName: user.fullName || user.username || r.userId,
        userPhone: user.phone || undefined,
        userEmail: user.email || undefined,
        offerName: offer.name || undefined,
        offerNameAr: offer.nameAr || undefined,
        fromClinicId: r.fromClinicId?.toString(),
        toClinicId: r.toClinicId?.toString(),
        fromClinicNameEn: from.nameEn,
        fromClinicNameAr: from.nameAr,
        toClinicNameEn: to.nameEn,
        toClinicNameAr: to.nameAr,
        changeNumber: r.changeNumber,
        feeKwd: r.feeKwd,
        status: r.status,
        reason: r.reason,
        approvedBy: r.approvedBy,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : undefined,
      };
    });

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

/** CS/Admin: approve a clinic change request — updates the membership's clinicId. */
commerceRouter.post("/cs/clinic-change-requests/:id/approve", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });

    const request = await ClinicChangeRequestModel.findOne({ _id: req.params.id, status: "pending" }).lean();
    if (!request) return res.status(404).json({ error: "REQUEST_NOT_FOUND_OR_RESOLVED" });

    await Promise.all([
      UserOfferModel.findByIdAndUpdate(
        (request as any).userOfferId,
        { $set: { clinicId: (request as any).toClinicId } }
      ),
      ClinicChangeRequestModel.findByIdAndUpdate(req.params.id, {
        $set: {
          status: "approved",
          approvedBy: req.auth!.userId,
          resolvedAt: new Date(),
        },
      }),
    ]);

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** CS/Admin: reject a clinic change request. */
commerceRouter.post("/cs/clinic-change-requests/:id/reject", authRequired, requireRole(["cs", "admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });

    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const request = await ClinicChangeRequestModel.findOne({ _id: req.params.id, status: "pending" }).lean();
    if (!request) return res.status(404).json({ error: "REQUEST_NOT_FOUND_OR_RESOLVED" });

    await ClinicChangeRequestModel.findByIdAndUpdate(req.params.id, {
      $set: {
        status: "rejected",
        reason: reason,
        approvedBy: req.auth!.userId,
        resolvedAt: new Date(),
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

commerceRouter.get("/admin/user-offers", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
  try {
    const items = await userOfferService.listAllUserOffers();
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

commerceRouter.delete("/admin/user-offers/:id", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
  try {
    const result = await userOfferService.cancelUserOffer(req.params.id);
    if (result === "not_found") return res.status(404).json({ error: "Membership not found" });
    if (result === "already_cancelled") return res.status(409).json({ error: "Already cancelled" });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
