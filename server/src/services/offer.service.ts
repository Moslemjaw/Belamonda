import type { BookingMode, OfferCategory, OfferKind, OfferStatus, OfferType, OfferVisibility } from "@belamonda/shared";
import mongoose from "mongoose";
import { OfferModel } from "../models/offer.model.js";
import { CategoryModel } from "../models/category.model.js";
import { findCategoryIdBySlug } from "./category.service.js";
import { serializeOffer } from "../utils/serialize.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function windowMatch(now: Date) {
  return {
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
      {
        $or: [
          { offerExpirationDate: { $exists: false } },
          { offerExpirationDate: null },
          { offerExpirationDate: { $gte: now } }
        ]
      }
    ]
  };
}

/** Derive the `active` boolean from the canonical `status` field. */
function activeFromStatus(status: OfferStatus): boolean {
  return status === "active";
}

function kwdMils(s: string | undefined): number {
  if (!s) return 0;
  const [a, b = "000"] = String(s).split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

/** Derive offer.membershipType when admin omits it — matches booking/checkout behaviour. */
export function deriveMembershipType(input: {
  isGroupOffer?: boolean;
  isCashbackOnly?: boolean;
  signupCashbackKwd?: string;
  cashbackPerSessionKwd?: string;
  payPerSession?: boolean;
  branchSessionPrices?: { clinicId: string; sessionPriceKwd: string }[];
  maxSessions?: number;
}): "cashback" | "free_sessions" | "group" | undefined {
  if (input.isGroupOffer) return "group";
  const hasCb = kwdMils(input.signupCashbackKwd) > 0 || kwdMils(input.cashbackPerSessionKwd) > 0;
  const hasBranchFees = (input.branchSessionPrices?.length ?? 0) > 0;
  const hasPerSession = !!input.payPerSession;
  const hasSessionCap = input.maxSessions != null && input.maxSessions > 0;

  if (input.isCashbackOnly) return "cashback";
  if (hasPerSession || hasBranchFees || hasSessionCap) return "free_sessions";
  if (hasCb) return "cashback";
  return undefined;
}

function optObjectId(id?: string): mongoose.Types.ObjectId | undefined {
  if (!id || !mongoose.isValidObjectId(id)) return undefined;
  return new mongoose.Types.ObjectId(id);
}

async function resolveCategoryIdList(ids: string[]): Promise<mongoose.Types.ObjectId[]> {
  const out: mongoose.Types.ObjectId[] = [];
  for (const raw of ids) {
    const id = String(raw).trim();
    if (!id) continue;
    if (mongoose.isValidObjectId(id)) out.push(new mongoose.Types.ObjectId(id));
    else {
      const cid = await findCategoryIdBySlug(id);
      if (cid) out.push(cid);
    }
  }
  return out;
}

async function primaryCategorySlugForOffer(doc: {
  categoryIds?: mongoose.Types.ObjectId[];
  category?: OfferCategory;
}): Promise<string | null> {
  if (doc.categoryIds?.length) {
    const cat = (await CategoryModel.findById(doc.categoryIds[0]).select("slug").lean()) as { slug?: string } | null;
    return cat?.slug ? String(cat.slug) : null;
  }
  return doc.category ?? null;
}

// ─── Public queries ───────────────────────────────────────────────────────────

export async function getOffer(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await OfferModel.findById(id).lean();
  if (!doc) return null;
  const slug = await primaryCategorySlugForOffer(doc as any);
  return serializeOffer(doc as any, slug);
}

export async function listOffersAdmin() {
  const rows = await OfferModel.find({}).sort({ createdAt: -1 }).lean();
  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as any);
    out.push(serializeOffer(doc as any, slug));
  }
  return out;
}

export async function listOffersPublic(filters: {
  clinicId?: string;
  category?: string;
  type?: OfferType;
  offerKind?: OfferKind;
  featured?: boolean;
  cashbackOnly?: boolean;
  search?: string;
  minPriceKwd?: number;
  maxPriceKwd?: number;
  minDurationDays?: number;
  maxDurationDays?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "duration_asc" | "duration_desc";
  page?: number;
  limit?: number;
}) {
  const now = new Date();

  // Prefer status-based filter; fall back to active boolean for docs without status.
  const q: mongoose.FilterQuery<typeof OfferModel> = {
    $or: [{ status: "active" }, { status: { $exists: false }, active: true }],
    visibility: { $in: ["public", null, undefined] as any },
    ...windowMatch(now)
  };

  if (filters.clinicId && mongoose.isValidObjectId(filters.clinicId)) {
    const cid = new mongoose.Types.ObjectId(filters.clinicId);
    (q as any).$and = [...((q as any).$and ?? []), {
      $or: [{ clinicId: cid }, { clinicIds: cid }]
    }];
  }

  if (filters.type) q.type = filters.type;
  if (filters.offerKind) q.offerKind = filters.offerKind;
  if (filters.featured != null) q.featured = filters.featured;

  if (filters.category) {
    const cat = filters.category.trim();
    if (mongoose.isValidObjectId(cat)) {
      q.categoryIds = new mongoose.Types.ObjectId(cat);
    } else {
      const cid = await findCategoryIdBySlug(cat);
      if (cid) {
        q.$or = [{ categoryIds: cid }, { category: cat }];
      } else {
        q.category = cat as OfferCategory;
      }
    }
  }

  if (filters.search?.trim()) {
    const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    q.name = { $regex: rx };
  }

  if (filters.cashbackOnly) {
    (q as any).$and = [...((q as any).$and ?? []), {
      $expr: {
        $or: [
          { $gt: [{ $toDouble: { $ifNull: ["$signupCashbackKwd", "0"] } }, 0] },
          { $gt: [{ $toDouble: { $ifNull: ["$cashbackPerSessionKwd", "0"] } }, 0] },
        ]
      }
    }];
  }

  if (filters.minPriceKwd != null || filters.maxPriceKwd != null) {
    const exprAnd: any[] = [];
    const priceExpr = { $toDouble: "$subscriptionPriceKwd" };
    if (filters.minPriceKwd != null) exprAnd.push({ $gte: [priceExpr, filters.minPriceKwd] });
    if (filters.maxPriceKwd != null) exprAnd.push({ $lte: [priceExpr, filters.maxPriceKwd] });
    (q as any).$expr = exprAnd.length === 1 ? exprAnd[0] : { $and: exprAnd };
  }

  if (filters.minDurationDays != null || filters.maxDurationDays != null) {
    const dQ: Record<string, number> = {};
    if (filters.minDurationDays != null) dQ.$gte = filters.minDurationDays;
    if (filters.maxDurationDays != null) dQ.$lte = filters.maxDurationDays;
    q.validityDays = dQ as any;
  }

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  let rows: any[];
  if (filters.sort === "price_asc" || filters.sort === "price_desc") {
    const dir = filters.sort === "price_asc" ? 1 : -1;
    rows = await OfferModel.aggregate([
      { $match: q },
      { $addFields: { _priceNum: { $toDouble: "$subscriptionPriceKwd" } } },
      { $sort: { _priceNum: dir } },
      { $skip: skip },
      { $limit: limit }
    ]);
  } else {
    let sortSpec: Record<string, 1 | -1> = { featured: -1, createdAt: -1 };
    if (filters.sort === "duration_asc") sortSpec = { validityDays: 1 };
    else if (filters.sort === "duration_desc") sortSpec = { validityDays: -1 };
    rows = await OfferModel.find(q).sort(sortSpec).skip(skip).limit(limit).lean();
  }

  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as any);
    out.push(serializeOffer(doc as any, slug));
  }
  return { items: out, page, limit };
}

export async function listFeaturedOffers(limit = 8) {
  const now = new Date();
  const rows = await OfferModel.find({
    $or: [{ status: "active" }, { status: { $exists: false }, active: true }],
    featured: true,
    ...windowMatch(now)
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as any);
    out.push(serializeOffer(doc as any, slug));
  }
  return out;
}

export async function listMembershipOffers(limit = 6) {
  const now = new Date();
  const rows = await OfferModel.aggregate([
    {
      $match: {
        $and: [
          { $or: [{ status: "active" }, { status: { $exists: false }, active: true }] },
          { visibility: { $in: ["public", null] } },
          ...windowMatch(now).$and,
          {
            $or: [
              { offerKind: { $in: ["membership", "subscription", "bundle"] } },
              { $expr: { $gt: [{ $toDouble: { $ifNull: ["$signupCashbackKwd", "0"] } }, 0] } },
            ]
          }
        ]
      }
    },
    { $sort: { featured: -1, createdAt: -1 } },
    { $limit: limit },
  ]);
  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as any);
    out.push(serializeOffer(doc as any, slug));
  }
  return out;
}

export async function listCashbackOffers(limit = 6) {
  const now = new Date();
  const rows = await OfferModel.aggregate([
    {
      $match: {
        $or: [{ status: "active" }, { status: { $exists: false }, active: true }],
        visibility: { $in: ["public", null] },
        ...windowMatch(now),
      }
    },
    {
      $match: {
        $expr: {
          $or: [
            { $gt: [{ $toDouble: { $ifNull: ["$signupCashbackKwd", "0"] } }, 0] },
            { $gt: [{ $toDouble: { $ifNull: ["$cashbackPerSessionKwd", "0"] } }, 0] },
          ]
        }
      }
    },
    { $sort: { featured: -1, createdAt: -1 } },
    { $limit: limit },
  ]);
  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as any);
    out.push(serializeOffer(doc as any, slug));
  }
  return out;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type OfferInput = {
  name: string;
  nameAr?: string;
  subtitle?: string;
  type: OfferType;
  offerKind?: OfferKind;
  category?: OfferCategory;
  categoryIds?: string[];
  status?: OfferStatus;
  visibility?: OfferVisibility;
  clinicId: string;
  clinicIds?: string[];
  clinicTransferFeeKwd?: string;
  doctorIds?: string[];
  subscriptionPriceKwd: string;
  perVisitPriceKwd?: string;
  originalClinicPriceKwd?: string;
  validityDays: number;
  maxSessions?: number;
  sessionIntervalDays?: number;
  sessionExpiryMonths?: number;
  maxBookingsPerWeek?: number;
  maxActiveSessions?: number;
  bookingMode?: BookingMode;
  active?: boolean;
  featured?: boolean;
  enrollmentCap?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  terms?: string;
  imageUrl?: string;
  bannerUrl?: string;
  tagsEn?: string[];
  tagsAr?: string[];
  allowFullPayment?: boolean;
  allowInstallments?: boolean;
  maxInstallments?: number;
  allowDeposit?: boolean;
  depositAmountKwd?: string;
  payPerSession?: boolean;
  sessionPriceKwd?: string;
  branchSessionPrices?: { clinicId: string; sessionPriceKwd: string }[];
  signupCashbackKwd?: string;
  cashbackActivationFeeKwd?: string;
  cashbackPerSessionKwd?: string;
  isCashbackOnly?: boolean;
  cashbackEligible?: boolean;
  maxCashbackPerPurchaseKwd?: string;
  membershipType?: "cashback" | "free_sessions" | "group";
  offerExpirationDate?: string;
  isGroupOffer?: boolean;
  groupSizeRequired?: number;
  groupRewardType?: "free_session" | "discount" | "cashback_bonus";
  groupRewardValue?: string;
  fullPaymentEFormId?: string;
  installmentsEFormId?: string;
  depositEFormId?: string;
  allowENet?: boolean;
  enetEFormId?: string;
};

export async function createOffer(input: OfferInput) {
  if (input.clinicId && !mongoose.isValidObjectId(input.clinicId)) throw new Error("INVALID_CLINIC_ID");

  const categoryIds: mongoose.Types.ObjectId[] = input.categoryIds?.length
    ? await resolveCategoryIdList(input.categoryIds)
    : [];
  if (!categoryIds.length && input.category && input.category !== "all") {
    const cid = await findCategoryIdBySlug(input.category);
    if (cid) categoryIds.push(cid);
  }

  const branchSessionPrices = (input.branchSessionPrices ?? []).filter((b) => b.clinicId && b.sessionPriceKwd);
  const membershipType =
    input.membershipType ??
    deriveMembershipType({
      isGroupOffer: input.isGroupOffer,
      isCashbackOnly: input.isCashbackOnly,
      signupCashbackKwd: input.signupCashbackKwd,
      cashbackPerSessionKwd: input.cashbackPerSessionKwd,
      payPerSession: input.payPerSession,
      branchSessionPrices,
      maxSessions: input.maxSessions
    });

  const clinicIds: mongoose.Types.ObjectId[] = [];
  for (const id of input.clinicIds ?? []) {
    if (mongoose.isValidObjectId(id)) clinicIds.push(new mongoose.Types.ObjectId(id));
  }

  const status: OfferStatus = input.status ?? "active";

  const doc = await OfferModel.create({
    name: input.name,
    nameAr: input.nameAr,
    subtitle: input.subtitle,
    type: input.type,
    offerKind: input.offerKind,
    category: input.category,
    categoryIds,
    membershipType,
    status,
    active: activeFromStatus(status),
    visibility: input.visibility ?? "public",
    featured: input.featured ?? false,
    clinicId: input.clinicId ? new mongoose.Types.ObjectId(input.clinicId) : undefined,
    clinicIds,
    clinicTransferFeeKwd: input.clinicTransferFeeKwd ?? "0.000",
    doctorIds: input.doctorIds ?? [],
    subscriptionPriceKwd: input.subscriptionPriceKwd,
    perVisitPriceKwd: input.perVisitPriceKwd,
    originalClinicPriceKwd: input.originalClinicPriceKwd,
    validityDays: input.validityDays,
    maxSessions: input.maxSessions,
    sessionIntervalDays: input.sessionIntervalDays ?? 0,
    sessionExpiryMonths: input.sessionExpiryMonths ?? 0,
    maxBookingsPerWeek: input.maxBookingsPerWeek,
    maxActiveSessions: input.maxActiveSessions,
    bookingMode: input.bookingMode ?? "instant",
    enrollmentCap: input.enrollmentCap,
    enrolledCount: 0,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    offerExpirationDate: input.offerExpirationDate ? new Date(input.offerExpirationDate) : undefined,
    isGroupOffer: input.isGroupOffer ?? false,
    groupSizeRequired: input.groupSizeRequired,
    groupRewardType: input.groupRewardType,
    groupRewardValue: input.groupRewardValue,
    fullPaymentEFormId: optObjectId(input.fullPaymentEFormId),
    installmentsEFormId: optObjectId(input.installmentsEFormId),
    depositEFormId: optObjectId(input.depositEFormId),
    allowENet: input.allowENet ?? false,
    enetEFormId: optObjectId(input.enetEFormId),
    description: input.description,
    terms: input.terms,
    imageUrl: input.imageUrl || undefined,
    bannerUrl: input.bannerUrl || undefined,
    tagsEn: input.tagsEn ?? [],
    tagsAr: input.tagsAr ?? [],
    allowFullPayment: input.allowFullPayment ?? true,
    allowInstallments: input.allowInstallments ?? false,
    maxInstallments: input.maxInstallments ?? 1,
    allowDeposit: input.allowDeposit ?? false,
    depositAmountKwd: input.depositAmountKwd ?? "0.000",
    payPerSession: input.payPerSession ?? false,
    sessionPriceKwd: input.sessionPriceKwd,
    branchSessionPrices,
    signupCashbackKwd: input.signupCashbackKwd ?? "0.000",
    cashbackActivationFeeKwd: input.cashbackActivationFeeKwd ?? "0.000",
    cashbackPerSessionKwd: input.cashbackPerSessionKwd ?? "0.000",
    isCashbackOnly: input.isCashbackOnly ?? false,
    cashbackEligible: input.cashbackEligible ?? true,
    maxCashbackPerPurchaseKwd: input.maxCashbackPerPurchaseKwd
  });

  const lean = doc.toObject();
  const slug = await primaryCategorySlugForOffer(lean as any);
  return serializeOffer(lean as any, slug);
}

export async function updateOffer(id: string, patch: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const update: Record<string, unknown> = { ...patch };

  if (typeof patch.clinicId === "string" && mongoose.isValidObjectId(patch.clinicId)) {
    update.clinicId = new mongoose.Types.ObjectId(patch.clinicId);
  }
  if (Array.isArray(patch.clinicIds)) {
    update.clinicIds = (patch.clinicIds as string[])
      .filter((x) => mongoose.isValidObjectId(x))
      .map((x) => new mongoose.Types.ObjectId(x));
  }
  if (Array.isArray(patch.categoryIds)) {
    update.categoryIds = await resolveCategoryIdList(patch.categoryIds as string[]);
  }
  if (typeof patch.startDate === "string") update.startDate = new Date(patch.startDate);
  if (typeof patch.endDate === "string") update.endDate = new Date(patch.endDate);
  if (typeof patch.offerExpirationDate === "string" && patch.offerExpirationDate) {
    update.offerExpirationDate = new Date(patch.offerExpirationDate);
  }

  const refKeys = ["fullPaymentEFormId", "installmentsEFormId", "depositEFormId", "enetEFormId"] as const;
  for (const k of refKeys) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (typeof v === "string" && mongoose.isValidObjectId(v)) update[k] = new mongoose.Types.ObjectId(v);
    else if (v === "" || v == null) update[k] = null;
  }

  if (Array.isArray(patch.branchSessionPrices)) {
    update.branchSessionPrices = (patch.branchSessionPrices as { clinicId: string; sessionPriceKwd: string }[]).filter(
      (b) => b.clinicId && b.sessionPriceKwd
    );
  }

  // Re-derive membership when relevant fields change (omit explicit membershipType in patch).
  if (
    patch.membershipType == null &&
    (patch.isGroupOffer != null ||
      patch.isCashbackOnly != null ||
      patch.signupCashbackKwd != null ||
      patch.cashbackPerSessionKwd != null ||
      patch.payPerSession != null ||
      patch.branchSessionPrices != null ||
      patch.maxSessions != null)
  ) {
    const cur = await OfferModel.findById(id).lean();
    if (cur) {
      const merged = { ...cur, ...patch } as any;
      const branch = (merged.branchSessionPrices ?? []) as { clinicId: string; sessionPriceKwd: string }[];
      update.membershipType =
        deriveMembershipType({
          isGroupOffer: merged.isGroupOffer,
          isCashbackOnly: merged.isCashbackOnly,
          signupCashbackKwd: merged.signupCashbackKwd,
          cashbackPerSessionKwd: merged.cashbackPerSessionKwd,
          payPerSession: merged.payPerSession,
          branchSessionPrices: branch,
          maxSessions: merged.maxSessions
        }) ?? merged.membershipType;
    }
  }

  // Keep active boolean in sync with status.
  if (typeof patch.status === "string") {
    update.active = activeFromStatus(patch.status as OfferStatus);
  }

  const doc = await OfferModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return null;
  const slug = await primaryCategorySlugForOffer(doc as any);
  return serializeOffer(doc as any, slug);
}

export async function deleteOffer(id: string) {
  if (!mongoose.isValidObjectId(id)) return false;
  const result = await OfferModel.findByIdAndDelete(id);
  return !!result;
}
