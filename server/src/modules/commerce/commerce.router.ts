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
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
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

// ─── Group Team Endpoints ──────────────────────────────────────────────────────

const CreateGroupSchema = z.object({ offerId: z.string().min(1), clinicId: z.string().optional() });

/** Create a group team — generates an invite code without requiring payment yet. */
commerceRouter.post("/me/offers/create-group", authRequired, async (req, res, next) => {
  try {
    const parsed = CreateGroupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const uid = req.auth!.userId;

    const offer = await OfferModel.findById(parsed.data.offerId).lean() as any;
    if (!offer) return res.status(404).json({ error: "OFFER_NOT_FOUND" });
    if (!offer.isGroupOffer) return res.status(400).json({ error: "NOT_A_GROUP_OFFER" });

    // Check if user already has a group for this offer
    const existing = await UserOfferModel.findOne({
      userId: uid,
      offerId: new mongoose.Types.ObjectId(parsed.data.offerId),
      membershipType: "group",
      status: { $in: ["pending_payment", "active", "reserved", "enet_pending"] }
    }).lean();
    if (existing) {
      // Return existing group info
      return res.json({
        userOfferId: (existing as any)._id.toString(),
        groupInviteCode: (existing as any).groupInviteCode,
        sharedWith: (existing as any).sharedWith || [],
        groupSizeRequired: offer.groupSizeRequired || 2,
        groupRewardType: offer.groupRewardType,
        alreadyExists: true
      });
    }

    // Resolve clinic
    let clinicId: mongoose.Types.ObjectId;
    if (parsed.data.clinicId && mongoose.isValidObjectId(parsed.data.clinicId)) {
      clinicId = new mongoose.Types.ObjectId(parsed.data.clinicId);
    } else if (offer.clinicId) {
      clinicId = offer.clinicId;
    } else {
      const firstClinic = offer.clinicIds?.[0];
      if (!firstClinic) return res.status(400).json({ error: "NO_CLINIC_AVAILABLE" });
      clinicId = firstClinic;
    }

    const crypto = await import("crypto");
    const groupInviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    const uo = await UserOfferModel.create({
      userId: uid,
      offerId: new mongoose.Types.ObjectId(parsed.data.offerId),
      clinicId,
      status: "pending_payment",
      membershipType: "group",
      groupInviteCode,
      sharedWith: [],
      purchaseMode: "full",
      pendingExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days to fill group
    });

    return res.status(201).json({
      userOfferId: uo._id.toString(),
      groupInviteCode,
      sharedWith: [],
      groupSizeRequired: offer.groupSizeRequired || 2,
      groupRewardType: offer.groupRewardType,
    });
  } catch (e) {
    next(e);
  }
});

/** Check group team status — how many people have joined. */
commerceRouter.get("/me/offers/group-status/:userOfferId", authRequired, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userOfferId)) return res.status(400).json({ error: "INVALID_ID" });
    const uo = await UserOfferModel.findById(req.params.userOfferId).lean() as any;
    if (!uo) return res.status(404).json({ error: "NOT_FOUND" });
    if (uo.userId !== req.auth!.userId) return res.status(403).json({ error: "FORBIDDEN" });

    // The group progress is tracked on the creator's UserOffer (the first one created with this code)
    const creatorUo = uo.groupInviteCode ? await UserOfferModel.findOne({ groupInviteCode: uo.groupInviteCode, membershipType: "group" }).sort({ createdAt: 1 }).lean() as any : uo;

    const offer = await OfferModel.findById(uo.offerId).lean() as any;
    const groupSizeRequired = offer?.groupSizeRequired || 2;
    const membersJoined = (creatorUo.sharedWith || []).length;
    // For unlock_membership, the owner counts as 1 person, so need (groupSizeRequired - 1) others
    const membersNeeded = groupSizeRequired - 1;
    const isUnlocked = membersJoined >= membersNeeded;

    return res.json({
      userOfferId: uo._id.toString(),
      groupInviteCode: uo.groupInviteCode,
      sharedWith: creatorUo.sharedWith || [],
      membersJoined,
      membersNeeded,
      groupSizeRequired,
      isUnlocked,
      groupRewardType: offer?.groupRewardType,
      groupRewardValue: offer?.groupRewardValue,
      offerName: offer?.name,
      offerNameAr: offer?.nameAr,
      subscriptionPriceKwd: offer?.subscriptionPriceKwd,
      status: uo.status,
    });
  } catch (e) {
    next(e);
  }
});

const JoinGroupSchema = z.object({ inviteCode: z.string().min(1) });
commerceRouter.post("/me/offers/join", authRequired, async (req, res, next) => {
  try {
    const parsed = JoinGroupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uo = await UserOfferModel.findOne({ groupInviteCode: parsed.data.inviteCode, membershipType: "group" }).sort({ createdAt: 1 });
    if (!uo) return res.status(404).json({ error: "INVALID_INVITE_CODE" });

    const uid = req.auth!.userId;
    if (uo.userId === uid) return res.status(409).json({ error: "CANNOT_JOIN_OWN_GROUP" });

    // Add joiner to creator's sharedWith array
    await UserOfferModel.findByIdAndUpdate(uo._id, { $addToSet: { sharedWith: uid } });

    // For group offers, the joiner ALSO needs a pending UserOffer so they can buy it when the group fills up
    const offer = await OfferModel.findById(uo.offerId).lean() as any;
    if (offer && offer.isGroupOffer) {
      // Use updateOne with upsert to prevent race conditions creating duplicates
      await UserOfferModel.updateOne(
        { userId: uid, groupInviteCode: parsed.data.inviteCode, membershipType: "group", offerId: uo.offerId },
        {
          $setOnInsert: {
            clinicId: uo.clinicId,
            status: "pending_payment",
            sharedWith: [], // joiner's sharedWith doesn't track progress
            purchaseMode: "full",
            pendingExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days to fill group
          }
        },
        { upsert: true }
      );
    }

    // Return updated group count info
    const updatedUo = await UserOfferModel.findById(uo._id).lean() as any;
    const membersJoined = (updatedUo.sharedWith || []).length;
    const membersNeeded = (offer?.groupSizeRequired || 2) - 1;

    return res.json({
      ok: true,
      membersJoined,
      membersNeeded,
      isUnlocked: membersJoined >= membersNeeded,
      offerName: offer?.name,
      offerNameAr: offer?.nameAr,
      message: uo.sharedWith && uo.sharedWith.includes(uid) ? "ALREADY_JOINED" : undefined
    });
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
    const clinicIdsForLookup = [...new Set(items.map((i) => String(i.clinicId || "")).filter(Boolean))].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const [offers, clinicsForNames] = await Promise.all([
      OfferModel.find({ _id: { $in: offerIds } })
        .select("name nameAr clinicLocked branchSessionPrices sessionIntervalDays isGroupOffer groupSizeRequired groupRewardType groupRewardValue maxSessions allowExtraPaidSessions extraSessionPriceKwd")
        .lean(),
      ClinicModel.find({ _id: { $in: clinicIdsForLookup } }).select("nameEn nameAr").lean(),
    ]);
    const offerMap = Object.fromEntries(offers.map((o: any) => [o._id.toString(), o]));
    const clinicNameMap = Object.fromEntries(clinicsForNames.map((c: any) => [c._id.toString(), c]));

    const userOfferIdsStr = items.map((i: any) => i.id);
    const userOfferObjectIds = items.map((i: any) => new mongoose.Types.ObjectId(i.id));

    const [pendingRequests, scheduledSessions, lastCompletedSessions] = await Promise.all([
      BookingRequestModel.find({
        userOfferId: { $in: userOfferIdsStr },
        status: { $in: ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted"] }
      }).select("userOfferId").lean(),
      BookingSessionModel.find({
        userOfferId: { $in: userOfferObjectIds },
        status: "scheduled"
      }).select("userOfferId").lean(),
      BookingSessionModel.aggregate([
        { $match: { userOfferId: { $in: userOfferObjectIds }, status: "completed" } },
        { $sort: { completedAt: -1 } },
        { $group: { _id: "$userOfferId", lastCompletedAt: { $first: "$completedAt" } } }
      ])
    ]);

    const activeBookingsSet = new Set([
      ...pendingRequests.map(r => r.userOfferId),
      ...scheduledSessions.map(s => s.userOfferId.toString())
    ]);
    const lastCompletedMap = Object.fromEntries(lastCompletedSessions.map(s => [s._id.toString(), s.lastCompletedAt]));

    const groupInviteCodes = [...new Set(items.map((i: any) => i.groupInviteCode).filter(Boolean))];
    const groupProgressMap: Record<string, string[]> = {};
    if (groupInviteCodes.length > 0) {
      const creators = await UserOfferModel.aggregate([
        { $match: { groupInviteCode: { $in: groupInviteCodes }, membershipType: "group" } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: "$groupInviteCode", sharedWith: { $first: "$sharedWith" } } }
      ]);
      for (const creator of creators) {
        groupProgressMap[creator._id] = creator.sharedWith || [];
      }
    }

    const enriched = items.map((item) => {
      const offer: any = offerMap[item.offerId] || {};
      const clinicInfo: any = clinicNameMap[item.clinicId] || {};
      const uoId = item.id;
      return {
        ...item,
        sharedWith: item.groupInviteCode ? (groupProgressMap[item.groupInviteCode] || []) : item.sharedWith,
        offerName: offer.name || undefined,
        offerNameAr: offer.nameAr || undefined,
        clinicNameEn: clinicInfo.nameEn || undefined,
        clinicNameAr: clinicInfo.nameAr || undefined,
        clinicLocked: offer.clinicLocked ?? undefined,
        branchSessionPrices: offer.branchSessionPrices || [],
        sessionIntervalDays: offer.sessionIntervalDays || 0,
        hasActiveBooking: activeBookingsSet.has(uoId),
        lastCompletedSessionAt: lastCompletedMap[uoId] ? new Date(lastCompletedMap[uoId]).toISOString() : undefined,
        groupSizeRequired: offer.groupSizeRequired || undefined,
        groupRewardType: offer.groupRewardType || undefined,
        groupRewardValue: offer.groupRewardValue || undefined,
        isGroupOffer: offer.isGroupOffer || false,
        maxSessions: offer.maxSessions,
        allowExtraPaidSessions: offer.allowExtraPaidSessions || false,
        extraSessionPriceKwd: offer.extraSessionPriceKwd || undefined,
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

/** Customer cancels their own active membership. */
commerceRouter.delete("/me/user-offers/:id", authRequired, async (req, res, next) => {
  try {
    const uo = await UserOfferModel.findOne({ _id: req.params.id, userId: req.auth!.userId }).lean();
    if (!uo) return res.status(404).json({ error: "Not found" });
    const result = await userOfferService.deleteUserOffer(req.params.id);
    if (result === "not_found") return res.status(404).json({ error: "Not found" });
    if (result === "already_cancelled") return res.status(409).json({ error: "Already cancelled" });
    return res.json({ ok: true });
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
commerceRouter.get("/cs/clinic-change-requests", authRequired, requireRole(["cs", "admin", "legal", "cs_director"]), async (req, res, next) => {
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

commerceRouter.post("/admin/user-offers/:uoId/adjust-installments", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const delta = typeof req.body?.delta === "number" ? Math.round(req.body.delta) : 0;
    const method = typeof req.body?.method === "string" ? req.body.method : undefined;
    if (delta === 0 || Math.abs(delta) > 1) return res.status(400).json({ error: "INVALID_DELTA" });
    if (delta > 0 && !method) return res.status(400).json({ error: "METHOD_REQUIRED" });
    if (!mongoose.isValidObjectId(req.params.uoId)) return res.status(400).json({ error: "INVALID_ID" });

    const uo = await UserOfferModel.findById(req.params.uoId).lean() as any;
    if (!uo) return res.status(404).json({ error: "NOT_FOUND" });

    const current = uo.installmentsPaid ?? 0;
    const nextVal = Math.max(0, current + delta);
    if (nextVal === current) return res.json({ ok: true, installmentsPaid: current });

    // Update the installment schedule entry
    const schedule = uo.installmentSchedule || [];
    if (delta > 0 && schedule.length > 0) {
      // Find the next unpaid installment and mark it as paid with the method
      const idx = schedule.findIndex((s: any) => !s.paid);
      if (idx !== -1) {
        schedule[idx].paid = true;
        schedule[idx].paidAt = new Date();
        schedule[idx].method = method;

        // Create a Payment record so it shows in Finance
        const { PaymentModel } = await import("../../models/payment.model.js");
        const payment = await PaymentModel.create({
          userId: uo.userId,
          offerId: uo.offerId,
          userOfferId: uo._id,
          amountKwd: schedule[idx].amountKwd,
          grossAmountKwd: schedule[idx].amountKwd,
          cashbackAppliedKwd: "0.000",
          status: "completed",
          method: method,
          purpose: "installment",
          provider: "manual",
          isManual: true,
          manualLabel: "Admin Installment Payment",
          installmentNumber: schedule[idx].number,
          createdAt: new Date(),
        });
        schedule[idx].paymentId = payment._id;

        // Update the next installment due date
        const nextUnpaid = schedule.find((s: any) => !s.paid);
        await UserOfferModel.findByIdAndUpdate(req.params.uoId, {
          $set: {
            installmentsPaid: nextVal,
            installmentSchedule: schedule,
            nextInstallmentDueAt: nextUnpaid?.dueDate || undefined,
          }
        });
      } else {
        await UserOfferModel.findByIdAndUpdate(req.params.uoId, { $set: { installmentsPaid: nextVal } });
      }
    } else if (delta < 0 && schedule.length > 0) {
      // Find the last paid installment and mark it as unpaid
      const lastPaidIdx = [...schedule].reverse().findIndex((s: any) => s.paid);
      if (lastPaidIdx !== -1) {
        const idx = schedule.length - 1 - lastPaidIdx;
        schedule[idx].paid = false;
        schedule[idx].paidAt = undefined;
        schedule[idx].method = undefined;
        schedule[idx].paymentId = undefined;
        const nextUnpaid = schedule.find((s: any) => !s.paid);
        await UserOfferModel.findByIdAndUpdate(req.params.uoId, {
          $set: {
            installmentsPaid: nextVal,
            installmentSchedule: schedule,
            nextInstallmentDueAt: nextUnpaid?.dueDate || undefined,
          }
        });
      } else {
        await UserOfferModel.findByIdAndUpdate(req.params.uoId, { $set: { installmentsPaid: nextVal } });
      }
    } else {
      await UserOfferModel.findByIdAndUpdate(req.params.uoId, { $set: { installmentsPaid: nextVal } });
    }

    return res.json({ ok: true, installmentsPaid: nextVal, method });
  } catch (e) {
    next(e);
  }
});

/** CS/Admin: approve a clinic change request — updates the membership's clinicId. */
commerceRouter.post("/cs/clinic-change-requests/:id/approve", authRequired, requireRole(["cs", "admin", "legal", "cs_director"]), async (req, res, next) => {
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
commerceRouter.post("/cs/clinic-change-requests/:id/reject", authRequired, requireRole(["cs", "admin", "legal", "cs_director"]), async (req, res, next) => {
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

commerceRouter.post("/admin/grant-membership", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      offerId: z.string().min(1),
      clinicId: z.string().min(1),
      sessionsUsed: z.number().int().min(0).default(0),
      customName: z.string().optional(),
      customSessions: z.number().optional(),
      customPrice: z.string().optional(),
      membershipType: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { userId, offerId, clinicId, sessionsUsed, customName, customSessions, customPrice, membershipType } = parsed.data;

    if (!mongoose.isValidObjectId(clinicId))
      return res.status(400).json({ error: "INVALID_CLINIC_ID" });

    const user = await UserModel.findById(userId).lean();
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const clinic = await ClinicModel.findById(clinicId).lean();
    if (!clinic) return res.status(404).json({ error: "CLINIC_NOT_FOUND" });

    let finalOfferId = offerId;
    let validityDays = 365;

    if (offerId === "custom") {
      const createdOffer = await OfferModel.create({
        name: customName || "Custom Package",
        type: "A",
        offerKind: membershipType === "cashback" ? "cashback" : "treatment",
        membershipType: membershipType || "free_sessions",
        status: "hidden",
        active: true,
        maxSessions: customSessions || 10,
        subscriptionPriceKwd: customPrice || "0.000",
        category: "all"
      });
      finalOfferId = String(createdOffer._id);
    } else {
      if (!mongoose.isValidObjectId(offerId))
        return res.status(400).json({ error: "INVALID_OFFER_ID" });
      const offer = await OfferModel.findById(offerId).lean();
      if (!offer) return res.status(404).json({ error: "OFFER_NOT_FOUND" });
      validityDays = (offer as any).validityDays ?? 365;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const uo = await UserOfferModel.create({
      userId: String(userId),
      offerId: new mongoose.Types.ObjectId(finalOfferId),
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
      purchaseMode: "full",
      sessionsUsed,
      activatedAt: now,
      expiresAt,
    });

    return res.status(201).json({ ok: true, id: String(uo._id) });
  } catch (e) {
    next(e);
  }
});

commerceRouter.post("/admin/user-offers/:uoId/change-clinic", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      clinicId: z.string().min(1),
      isPaid: z.boolean().default(false),
      feeAmount: z.string().default("10.000")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { clinicId, isPaid, feeAmount } = parsed.data;
    if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });

    const uo = await UserOfferModel.findById(req.params.uoId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    if (isPaid) {
      const resAdjust = await kycStore.adjustUnlocked({
        userId: uo.userId,
        amountKwd: `-${feeAmount}`,
        reason: `Clinic change fee for membership: ${uo.shortId || uo._id}`,
        createdById: req.auth!.userId
      });
      if (resAdjust && "error" in resAdjust) {
        if (resAdjust.error === "UNLOCKED_BELOW_ZERO") {
          return res.status(400).json({ error: "INSUFFICIENT_FUNDS" });
        }
        return res.status(400).json({ error: resAdjust.error });
      }
    }

    const pendingReqs = await BookingRequestModel.find({ userOfferId: uo._id, status: "pending" });
    if (pendingReqs.length > 0) {
      await BookingRequestModel.deleteMany({ _id: { $in: pendingReqs.map((r) => r._id) } });
    }

    const scheduledSessions = await BookingSessionModel.find({ userOfferId: uo._id, status: "scheduled" });
    if (scheduledSessions.length > 0) {
      await BookingSessionModel.deleteMany({ _id: { $in: scheduledSessions.map((s) => s._id) } });
      const decrementAmount = scheduledSessions.length;
      if ((uo.sessionsUsed ?? 0) >= decrementAmount) {
        uo.sessionsUsed = (uo.sessionsUsed ?? 0) - decrementAmount;
      } else {
        uo.sessionsUsed = 0;
      }
    }

    uo.clinicId = new mongoose.Types.ObjectId(clinicId);
    await uo.save();

    return res.json({ ok: true, clinicId: String(uo.clinicId), deletedSessions: scheduledSessions.length });
  } catch (e) {
    next(e);
  }
});

commerceRouter.get("/admin/user-offers", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const items = await userOfferService.listAllUserOffers();

    const userIds = [...new Set(items.map((i) => String(i.userId || "")).filter(Boolean))];
    const clinicIds = [...new Set(items.map((i) => String(i.clinicId || "")).filter(Boolean))];

    const [users, clinics] = await Promise.all([
      UserModel.find({ _id: { $in: userIds } }).select("fullName username email phone").lean(),
      ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn nameAr").lean(),
    ]);

    const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), u]));
    const clinicMap = Object.fromEntries(clinics.map((c: any) => [c._id.toString(), c]));

    const enriched = items.map((item) => {
      const user: any = userMap[item.userId] || {};
      const clinic: any = clinicMap[item.clinicId] || {};

      return {
        ...item,
        userName: user.fullName || user.username || item.userId,
        userPhone: user.phone || undefined,
        userEmail: user.email || undefined,
        clinicNameEn: clinic.nameEn || undefined,
        clinicNameAr: clinic.nameAr || undefined,
      };
    });

    return res.json({ items: enriched });
  } catch (e) {
    next(e);
  }
});

commerceRouter.patch("/admin/user-offers/:id", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      activatedAt: z.string().optional(),
      expiresAt: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const updates: any = {};
    if (parsed.data.activatedAt) updates.activatedAt = new Date(parsed.data.activatedAt);
    if (parsed.data.expiresAt) updates.expiresAt = new Date(parsed.data.expiresAt);

    if (Object.keys(updates).length === 0) return res.json({ ok: true });

    const uo = await UserOfferModel.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!uo) return res.status(404).json({ error: "Membership not found" });

    return res.json({ ok: true, uo });
  } catch (e) {
    next(e);
  }
});

commerceRouter.delete("/admin/user-offers/:id", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const result = await userOfferService.deleteUserOffer(req.params.id);
    if (result === "not_found") return res.status(404).json({ error: "Membership not found" });
    if (result === "already_cancelled") return res.status(409).json({ error: "Already cancelled" });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
