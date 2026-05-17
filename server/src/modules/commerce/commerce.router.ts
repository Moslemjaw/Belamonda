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

    // If it's an unlock_membership, the joiner ALSO needs a pending UserOffer so they can buy it when the group fills up
    const offer = await OfferModel.findById(uo.offerId).lean() as any;
    if (offer && offer.groupRewardType === "unlock_membership") {
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
    const offers = await OfferModel.find({ _id: { $in: offerIds } })
      .select("name nameAr clinicLocked branchSessionPrices sessionIntervalDays isGroupOffer groupSizeRequired groupRewardType groupRewardValue")
      .lean();
    const offerMap = Object.fromEntries(offers.map((o: any) => [o._id.toString(), o]));

    const userOfferIdsStr = items.map((i: any) => i.id);
    const userOfferObjectIds = items.map((i: any) => new mongoose.Types.ObjectId(i.id));

    const [pendingRequests, scheduledSessions, lastCompletedSessions] = await Promise.all([
      BookingRequestModel.find({
        userOfferId: { $in: userOfferIdsStr },
        status: { $in: ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted", "confirmed"] }
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

    const enriched = items.map((item) => {
      const offer: any = offerMap[item.offerId] || {};
      const uoId = item.id;
      return {
        ...item,
        offerName: offer.name || undefined,
        offerNameAr: offer.nameAr || undefined,
        clinicLocked: offer.clinicLocked ?? undefined,
        branchSessionPrices: offer.branchSessionPrices || [],
        sessionIntervalDays: offer.sessionIntervalDays || 0,
        hasActiveBooking: activeBookingsSet.has(uoId),
        lastCompletedSessionAt: lastCompletedMap[uoId] ? new Date(lastCompletedMap[uoId]).toISOString() : undefined,
        groupSizeRequired: offer.groupSizeRequired || undefined,
        groupRewardType: offer.groupRewardType || undefined,
        groupRewardValue: offer.groupRewardValue || undefined,
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

commerceRouter.post("/admin/grant-membership", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      offerId: z.string().min(1),
      clinicId: z.string().min(1),
      sessionsUsed: z.number().int().min(0).default(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { userId, offerId, clinicId, sessionsUsed } = parsed.data;

    if (!mongoose.isValidObjectId(offerId) || !mongoose.isValidObjectId(clinicId))
      return res.status(400).json({ error: "INVALID_ID" });

    const [user, offer, clinic] = await Promise.all([
      UserModel.findById(userId).lean(),
      OfferModel.findById(offerId).lean() as Promise<InstanceType<typeof OfferModel> | null>,
      ClinicModel.findById(clinicId).lean(),
    ]);

    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!offer) return res.status(404).json({ error: "OFFER_NOT_FOUND" });
    if (!clinic) return res.status(404).json({ error: "CLINIC_NOT_FOUND" });

    const now = new Date();
    const validityDays = (offer as any).validityDays ?? 365;
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const uo = await UserOfferModel.create({
      userId: String(userId),
      offerId: new mongoose.Types.ObjectId(offerId),
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
