import type { OfferCategory, OfferType } from "@belamonda/shared";
import mongoose from "mongoose";
import { OfferModel } from "../models/offer.model.js";
import { CategoryModel } from "../models/category.model.js";
import { findCategoryIdBySlug } from "./category.service.js";
import { serializeOffer } from "../utils/serialize.js";

function windowMatch(now: Date) {
  return {
    $and: [
      {
        $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }]
      },
      {
        $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }]
      }
    ]
  };
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

export async function getOffer(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await OfferModel.findById(id).lean();
  if (!doc) return null;
  const slug = await primaryCategorySlugForOffer(doc as { categoryIds?: mongoose.Types.ObjectId[]; category?: OfferCategory });
  return serializeOffer(doc as any, slug);
}

export async function listOffersAdmin() {
  const rows = await OfferModel.find({}).sort({ createdAt: -1 }).lean();
  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as { categoryIds?: mongoose.Types.ObjectId[]; category?: OfferCategory });
    out.push(serializeOffer(doc as any, slug));
  }
  return out;
}

export async function listOffersPublic(filters: {
  clinicId?: string;
  category?: string;
  type?: OfferType;
  featured?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const now = new Date();
  const q: mongoose.FilterQuery<typeof OfferModel> = { active: true, ...windowMatch(now) };

  if (filters.clinicId && mongoose.isValidObjectId(filters.clinicId)) {
    q.clinicId = new mongoose.Types.ObjectId(filters.clinicId);
  }

  if (filters.type) q.type = filters.type;
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

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const rows = await OfferModel.find(q)
    .sort({ featured: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as { categoryIds?: mongoose.Types.ObjectId[]; category?: OfferCategory });
    out.push(serializeOffer(doc as any, slug));
  }
  return { items: out, page, limit };
}

export async function createOffer(input: {
  name: string;
  type: OfferType;
  category?: OfferCategory;
  categoryIds?: string[];
  clinicId: string;
  subscriptionPriceKwd: string;
  validityDays: number;
  cashbackPerSessionKwd?: string;
  sessionIntervalDays?: number;
  maxSessions?: number;
  active?: boolean;
  featured?: boolean;
  enrollmentCap?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  terms?: string;
  perVisitPriceKwd?: string;
  originalClinicPriceKwd?: string;
}) {
  if (!mongoose.isValidObjectId(input.clinicId)) throw new Error("INVALID_CLINIC_ID");
  const categoryIds: mongoose.Types.ObjectId[] = [];
  if (input.categoryIds?.length) {
    for (const id of input.categoryIds) {
      if (mongoose.isValidObjectId(id)) categoryIds.push(new mongoose.Types.ObjectId(id));
    }
  }
  if (!categoryIds.length && input.category) {
    const cid = await findCategoryIdBySlug(input.category);
    if (cid) categoryIds.push(cid);
  }

  const doc = await OfferModel.create({
    name: input.name,
    type: input.type,
    category: input.category,
    categoryIds,
    clinicId: new mongoose.Types.ObjectId(input.clinicId),
    subscriptionPriceKwd: input.subscriptionPriceKwd,
    validityDays: input.validityDays,
    cashbackPerSessionKwd: input.cashbackPerSessionKwd ?? "0.000",
    sessionIntervalDays: input.sessionIntervalDays ?? 0,
    maxSessions: input.maxSessions,
    active: input.active ?? true,
    featured: input.featured ?? false,
    enrollmentCap: input.enrollmentCap,
    enrolledCount: 0,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    description: input.description,
    terms: input.terms,
    perVisitPriceKwd: input.perVisitPriceKwd,
    originalClinicPriceKwd: input.originalClinicPriceKwd
  });

  const lean = doc.toObject();
  const slug = await primaryCategorySlugForOffer(lean as { categoryIds?: mongoose.Types.ObjectId[]; category?: OfferCategory });
  return serializeOffer(lean as any, slug);
}

export async function updateOffer(id: string, patch: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) return null;
  const update: Record<string, unknown> = { ...patch };
  if (typeof patch.clinicId === "string" && mongoose.isValidObjectId(patch.clinicId)) {
    update.clinicId = new mongoose.Types.ObjectId(patch.clinicId);
  }
  if (Array.isArray(patch.categoryIds)) {
    update.categoryIds = (patch.categoryIds as string[])
      .filter((x) => mongoose.isValidObjectId(x))
      .map((x) => new mongoose.Types.ObjectId(x));
  }
  if (typeof patch.startDate === "string") update.startDate = new Date(patch.startDate);
  if (typeof patch.endDate === "string") update.endDate = new Date(patch.endDate);

  const doc = await OfferModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return null;
  const slug = await primaryCategorySlugForOffer(doc as { categoryIds?: mongoose.Types.ObjectId[]; category?: OfferCategory });
  return serializeOffer(doc as any, slug);
}

export async function listFeaturedOffers(limit = 8) {
  const now = new Date();
  const rows = await OfferModel.find({
    active: true,
    featured: true,
    ...windowMatch(now)
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const out = [];
  for (const doc of rows) {
    const slug = await primaryCategorySlugForOffer(doc as { categoryIds?: mongoose.Types.ObjectId[]; category?: OfferCategory });
    out.push(serializeOffer(doc as any, slug));
  }
  return out;
}
