import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { createOffer, getOffer, listOffersAdmin, listOffersPublic, updateOffer, deleteOffer } from "../../services/offer.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { notifyNewOfferAlert } from "../notifications/notifications.service.js";
import { logAuditAction } from "../../services/audit.service.js";

const KwdString = z.string().regex(/^\d+(\.\d{3})$/);

const OfferBaseSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  subtitle: z.string().optional(),

  // Classification
  type: z.enum(["A", "B"]).default("A"),
  offerKind: z.enum(["laser", "treatment", "membership", "cashback", "bundle", "subscription"]).optional(),
  category: z.enum(["all", "laser", "injectables", "skincare", "beauty", "body", "dental", "medical", "other"]).optional(),
  categoryIds: z.array(z.string()).default([]),

  // Status & Visibility
  status: z.enum(["active", "draft", "hidden", "expired"]).default("active"),
  visibility: z.enum(["public", "members_only", "referral_only", "vip_only", "hidden_link"]).default("public"),
  featured: z.boolean().default(false),
  active: z.boolean().optional(),

  // Clinic & Doctor
  clinicId: z.string().optional().or(z.literal("")),
  clinicIds: z.array(z.string()).default([]),
  clinicLocked: z.boolean().default(false),
  requireBranchSelection: z.boolean().default(true),
  clinicTransferFeeKwd: KwdString.default("0.000"),
  doctorIds: z.array(z.string()).default([]),

  // Pricing
  subscriptionPriceKwd: KwdString,
  perVisitPriceKwd: KwdString.optional(),
  originalClinicPriceKwd: KwdString.optional(),
  branchSessionPrices: z.array(z.object({
    clinicId: z.string().min(1),
    sessionPriceKwd: KwdString
  })).optional(),

  // Sessions & Booking
  validityDays: z.number().int().positive(),
  maxSessions: z.number().int().positive().optional(),
  sessionIntervalDays: z.number().int().min(0).default(0),
  sessionExpiryMonths: z.number().int().min(0).default(0),
  maxBookingsPerWeek: z.number().int().positive().optional(),
  maxActiveSessions: z.number().int().positive().optional(),
  bookingMode: z.enum(["instant", "review", "doctor_approval", "manual_confirmation"]).default("instant"),

  // Capacity & Window
  enrollmentCap: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Content
  description: z.string().optional(),
  terms: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  tagsEn: z.array(z.string()).default([]),
  tagsAr: z.array(z.string()).default([]),

  // Payment
  allowFullPayment: z.boolean().default(true),
  allowInstallments: z.boolean().default(false),
  maxInstallments: z.number().int().positive().default(1),
  allowDeposit: z.boolean().default(false),
  depositAmountKwd: KwdString.default("0.000"),

  // Pay-per-session
  payPerSession: z.boolean().default(false),
  sessionPriceKwd: KwdString.optional(),
  // branchSessionPrices is already declared in the Pricing section above (line 38)

  // Cashback
  signupCashbackKwd: KwdString.default("0.000"),
  cashbackActivationFeeKwd: KwdString.default("0.000"),
  cashbackPerSessionKwd: KwdString.default("0.000"),
  isCashbackOnly: z.boolean().default(false),
  cashbackEligible: z.boolean().default(true),
  maxCashbackPerPurchaseKwd: KwdString.optional(),

  // Membership behaviour (laser packages vs cashback vs group)
  membershipType: z.enum(["cashback", "free_sessions", "group"]).optional(),

  // Offer window / expiry (admin "Offer Expiration Date" — ISO or yyyy-mm-dd)
  offerExpirationDate: z.string().optional(),

  // Group offer
  isGroupOffer: z.boolean().default(false),
  groupSizeRequired: z.number().int().min(2).optional(),
  groupRewardType: z.enum(["free_session", "discount", "cashback_bonus"]).optional(),
  groupRewardValue: z.string().optional(),

  // E-forms + eNet
  fullPaymentEFormId: z.string().optional(),
  installmentsEFormId: z.string().optional(),
  depositEFormId: z.string().optional(),
  allowENet: z.boolean().default(false),
  enetEFormId: z.string().optional(),

  // Display ordering
  sortOrder: z.number().int().min(0).default(0)
});

const OfferCreateSchema = OfferBaseSchema;
const OfferUpdateSchema = OfferBaseSchema.partial();

export const offersRouter = Router();

// Public catalog browse
offersRouter.get("/", async (req, res, next) => {
  try {
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const type = req.query.type === "A" || req.query.type === "B" ? req.query.type : undefined;
    const offerKindQ = typeof req.query.offerKind === "string" ? req.query.offerKind : undefined;
    const offerKind = ["laser", "treatment", "membership", "cashback", "bundle", "subscription"].includes(offerKindQ ?? "")
      ? (offerKindQ as any)
      : undefined;
    const featured =
      req.query.featured === "true" ? true : req.query.featured === "false" ? false : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const numQ = (k: string) => {
      const v = req.query[k];
      if (typeof v !== "string") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const minPriceKwd = numQ("minPriceKwd");
    const maxPriceKwd = numQ("maxPriceKwd");
    const minDurationDays = numQ("minDurationDays");
    const maxDurationDays = numQ("maxDurationDays");
    const sortQ = typeof req.query.sort === "string" ? req.query.sort : undefined;
    const sort = (["newest", "price_asc", "price_desc", "duration_asc", "duration_desc"].includes(sortQ ?? "")
      ? sortQ
      : undefined) as any;

    const cashbackOnly = req.query.cashback === "1" || req.query.cashback === "true";

    const out = await listOffersPublic({
      clinicId, category, type, offerKind, featured, cashbackOnly, search,
      minPriceKwd, maxPriceKwd, minDurationDays, maxDurationDays, sort
    });
    return res.json({ items: out.items, page: out.page, limit: out.limit });
  } catch (error) {
    return next(error);
  }
});

// Admin list
offersRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const items = await listOffersAdmin();
    return res.json({ items });
  } catch (error) {
    return next(error);
  }
});

offersRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = OfferCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const offer = await createOffer(parsed.data as any);
    await logAuditAction({
      actorId: (req as any).user?._id || "system",
      actorRole: (req as any).user?.role || "system",
      actionType: "create_offer",
      targetEntityType: "Offer",
      targetEntityId: (offer as any).id,
      afterState: parsed.data
    });

    const isPubliclyActive =
      (offer as { status?: string; active?: boolean }).status === "active" &&
      (offer as { active?: boolean }).active !== false;
    if (isPubliclyActive) {
      const approvedUsers = await kycStore.listApprovedUserIds();
      for (const uid of approvedUsers) {
        notifyNewOfferAlert(uid, (offer as { id: string }).id, (offer as { name: string }).name);
      }
    }

    return res.status(201).json({ offer });
  } catch (error) {
    return next(error);
  }
});

// Duplicate offer
offersRouter.post("/admin/:offerId/duplicate", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const source = await getOffer(req.params.offerId);
    if (!source) return res.status(404).json({ error: "NOT_FOUND" });
    const { id, createdAt, enrolledCount, ...rest } = source as any;
    const duplicate = await createOffer({
      ...rest,
      name: `${rest.name} (copy)`,
      status: "draft",
      active: false
    });
    return res.status(201).json({ offer: duplicate });
  } catch (error) {
    return next(error);
  }
});

offersRouter.patch("/admin/:offerId", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = OfferUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const offer = await updateOffer(req.params.offerId, parsed.data as any);
    if (!offer) return res.status(404).json({ error: "NOT_FOUND" });
    await logAuditAction({
      actorId: (req as any).user?._id || "system",
      actorRole: (req as any).user?.role || "system",
      actionType: "update_offer",
      targetEntityType: "Offer",
      targetEntityId: req.params.offerId,
      afterState: parsed.data
    });
    return res.json({ offer });
  } catch (error) {
    return next(error);
  }
});

// Delete offer
offersRouter.delete("/admin/:offerId", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const success = await deleteOffer(req.params.offerId);
    if (!success) return res.status(404).json({ error: "NOT_FOUND" });
    await logAuditAction({
      actorId: (req as any).user?._id || "system",
      actorRole: (req as any).user?.role || "system",
      actionType: "delete_offer",
      targetEntityType: "Offer",
      targetEntityId: req.params.offerId
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// Bulk reorder offers
offersRouter.post("/admin/reorder", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items)) return res.status(400).json({ error: "VALIDATION_ERROR", message: "items must be an array of { id, sortOrder }" });
    const { updateOffer: updateOfferFn } = await import("../../services/offer.service.js");
    for (const item of items) {
      if (typeof item.id === "string" && typeof item.sortOrder === "number") {
        await updateOfferFn(item.id, { sortOrder: item.sortOrder });
      }
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// Public single offer detail
offersRouter.get("/:offerId", async (req, res, next) => {
  try {
    const offer = await getOffer(req.params.offerId);
    if (!offer) return res.status(404).json({ error: "NOT_FOUND" });

    // Only active + public offers are accessible anonymously
    const s = (offer as any).status;
    const v = (offer as any).visibility;
    if (s && s !== "active") return res.status(404).json({ error: "NOT_FOUND" });
    if (!s && !(offer as any).active) return res.status(404).json({ error: "NOT_FOUND" });
    if (v && v !== "public" && v !== "hidden_link") return res.status(404).json({ error: "NOT_FOUND" });

    const now = Date.now();
    const startsAt = (offer as any).startDate ? Date.parse((offer as any).startDate) : null;
    const endsAt = (offer as any).endDate ? Date.parse((offer as any).endDate) : null;
    const offerExpAt = (offer as any).offerExpirationDate ? Date.parse((offer as any).offerExpirationDate) : null;
    if (startsAt !== null && !Number.isNaN(startsAt) && startsAt > now) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (endsAt !== null && !Number.isNaN(endsAt) && endsAt < now) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (offerExpAt !== null && !Number.isNaN(offerExpAt) && offerExpAt < now) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    return res.json({ offer });
  } catch (error) {
    return next(error);
  }
});
