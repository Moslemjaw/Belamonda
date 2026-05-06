import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { SessionTypeModel } from "../../models/sessionType.model.js";
import { ClinicSessionOfferingModel } from "../../models/clinicSessionOffering.model.js";
import { CategoryModel } from "../../models/category.model.js";

const CreateSchema = z.object({
  categoryId: z.string().min(1),
  slug: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional()
});

const PatchSchema = CreateSchema.partial();

export const sessionTypesRouter = Router();

// Public list (active only)
sessionTypesRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await SessionTypeModel.find({ isActive: true }).sort({ nameEn: 1 }).lean();
    const items = rows.map((r: any) => ({
      id: String(r._id),
      categoryId: String(r.categoryId),
      slug: r.slug,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      description: r.description,
      tags: r.tags ?? []
    }));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Admin CRUD
sessionTypesRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const rows = await SessionTypeModel.find({}).sort({ nameEn: 1 }).lean();
    const catIds = Array.from(new Set(rows.map((r: any) => String(r.categoryId))));
    const cats = catIds.length ? await CategoryModel.find({ _id: { $in: catIds } }).lean() : [];
    const catById = new Map(cats.map((c: any) => [String(c._id), c]));
    const items = rows.map((r: any) => ({
      id: String(r._id),
      categoryId: String(r.categoryId),
      categorySlug: catById.get(String(r.categoryId))?.slug,
      categoryNameEn: catById.get(String(r.categoryId))?.nameEn,
      categoryNameAr: catById.get(String(r.categoryId))?.nameAr,
      slug: r.slug,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      isActive: !!r.isActive,
      tags: r.tags ?? []
    }));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

sessionTypesRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    if (!mongoose.isValidObjectId(parsed.data.categoryId)) return res.status(400).json({ error: "INVALID_CATEGORY_ID" });
    const doc = await SessionTypeModel.create({
      ...parsed.data,
      categoryId: new mongoose.Types.ObjectId(parsed.data.categoryId),
      slug: parsed.data.slug.toLowerCase().trim(),
      isActive: parsed.data.isActive ?? true
    });
    return res.status(201).json({ sessionType: { id: String(doc._id) } });
  } catch (e: any) {
    if (e?.code === 11000) return res.status(409).json({ error: "DUPLICATE_SLUG" });
    next(e);
  }
});

sessionTypesRouter.patch("/admin/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    if (parsed.data.categoryId && !mongoose.isValidObjectId(parsed.data.categoryId))
      return res.status(400).json({ error: "INVALID_CATEGORY_ID" });
    const doc = await SessionTypeModel.findByIdAndUpdate(
      req.params.id,
      {
        ...parsed.data,
        ...(parsed.data.categoryId ? { categoryId: new mongoose.Types.ObjectId(parsed.data.categoryId) } : {}),
        ...(parsed.data.slug ? { slug: parsed.data.slug.toLowerCase().trim() } : {})
      },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ sessionType: { id: String((doc as any)._id) } });
  } catch (e) {
    next(e);
  }
});

// Clinic offerings
sessionTypesRouter.get("/clinic/:clinicId", authRequired, async (req, res, next) => {
  try {
    const clinicId = req.params.clinicId;
    if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });
    const rows = await ClinicSessionOfferingModel.find({ clinicId, isActive: true }).lean();
    const items = rows.map((r: any) => ({
      id: String(r._id),
      clinicId: String(r.clinicId),
      sessionTypeId: String(r.sessionTypeId),
      priceKwd: r.priceKwd,
      durationMinutes: r.durationMinutes
    }));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

sessionTypesRouter.post(
  "/clinic/:clinicId/admin",
  authRequired,
  requireRole(["admin", "clinicStaff"]),
  async (req, res, next) => {
    try {
      const clinicId = req.params.clinicId;
      if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });
      const parsed = z
        .object({
          sessionTypeId: z.string().min(1),
          priceKwd: z.string().regex(/^\d+(\.\d{3})$/).optional(),
          durationMinutes: z.number().int().positive().optional(),
          isActive: z.boolean().optional()
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
      if (!mongoose.isValidObjectId(parsed.data.sessionTypeId)) return res.status(400).json({ error: "INVALID_SESSION_TYPE_ID" });

      const doc = await ClinicSessionOfferingModel.findOneAndUpdate(
        { clinicId, sessionTypeId: parsed.data.sessionTypeId },
        {
          $set: {
            priceKwd: parsed.data.priceKwd,
            durationMinutes: parsed.data.durationMinutes,
            isActive: parsed.data.isActive ?? true
          }
        },
        { upsert: true, new: true }
      ).lean();

      return res.status(201).json({ offering: { id: String((doc as any)._id) } });
    } catch (e) {
      next(e);
    }
  }
);

