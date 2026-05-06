import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import mongoose from "mongoose";
import { OfferModel } from "../../models/offer.model.js";
import { SessionTypeModel } from "../../models/sessionType.model.js";
import {
  createCategory,
  deleteCategory,
  listCategoriesAdmin,
  listCategoriesPublic,
  setCategoryActivation,
  updateCategory
} from "../../services/category.service.js";

const CreateSchema = z.object({
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  slug: z.string().min(1),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional()
});

const PatchSchema = CreateSchema.partial();

export const categoriesRouter = Router();

categoriesRouter.get("/", async (_req, res, next) => {
  try {
    const items = await listCategoriesPublic();
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

categoriesRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const items = await listCategoriesAdmin();
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

categoriesRouter.get("/admin/:id/relations", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const categoryId = new mongoose.Types.ObjectId(req.params.id);
    const offersRaw = await OfferModel.find({
      $or: [{ categoryIds: categoryId }, { category: undefined }]
    })
      .sort({ createdAt: -1 })
      .lean();
    const offers = offersRaw
      .filter((o: any) => (o.categoryIds || []).some((id: any) => String(id) === String(categoryId)))
      .map((o: any) => ({
        id: String(o._id),
        name: o.name,
        clinicId: String(o.clinicId),
        active: !!o.active,
        subscriptionPriceKwd: o.subscriptionPriceKwd
      }));
    const sessionTypesRaw = await SessionTypeModel.find({ categoryId }).sort({ nameEn: 1 }).lean();
    const sessionTypes = sessionTypesRaw.map((s: any) => ({
      id: String(s._id),
      slug: s.slug,
      nameEn: s.nameEn,
      nameAr: s.nameAr,
      isActive: !!s.isActive
    }));
    return res.json({ offers, sessionTypes });
  } catch (e) {
    next(e);
  }
});

categoriesRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const category = await createCategory(parsed.data);
    return res.status(201).json({ category });
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) {
      return res.status(409).json({ error: "DUPLICATE_SLUG" });
    }
    next(e);
  }
});

categoriesRouter.patch("/admin/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const category = await updateCategory(req.params.id, parsed.data);
    if (!category) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ category });
  } catch (e) {
    next(e);
  }
});

categoriesRouter.patch("/admin/:id/activation", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const category = await setCategoryActivation(req.params.id, parsed.data.isActive);
    if (!category) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ category });
  } catch (e) {
    next(e);
  }
});

categoriesRouter.delete("/admin/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const ok = await deleteCategory(req.params.id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});
