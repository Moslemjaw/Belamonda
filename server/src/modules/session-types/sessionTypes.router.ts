import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { SessionTypeModel } from "../../models/sessionType.model.js";
import { ClinicSessionOfferingModel } from "../../models/clinicSessionOffering.model.js";

const CreateSchema = z.object({
  slug: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  categorySlug: z.string().min(1).optional(),
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
      slug: r.slug,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      categorySlug: r.categorySlug ?? "other",
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
    const items = rows.map((r: any) => ({
      id: String(r._id),
      slug: r.slug,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      categorySlug: r.categorySlug ?? "other",
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
    const doc = await SessionTypeModel.create({
      ...parsed.data,
      slug: parsed.data.slug.toLowerCase().trim(),
      categorySlug: (parsed.data.categorySlug ?? "other").toLowerCase().trim(),
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
    const updatePayload: Record<string, unknown> = {
      ...parsed.data,
      ...(parsed.data.slug ? { slug: parsed.data.slug.toLowerCase().trim() } : {}),
      ...(parsed.data.categorySlug ? { categorySlug: parsed.data.categorySlug.toLowerCase().trim() } : {})
    };
    const doc = await SessionTypeModel.findByIdAndUpdate(req.params.id, updatePayload, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ sessionType: { id: String((doc as any)._id) } });
  } catch (e) {
    next(e);
  }
});

sessionTypesRouter.delete("/admin/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const doc = await SessionTypeModel.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ─── Public: all active offerings across all clinics (for customer dashboard) ──
sessionTypesRouter.get("/offerings", async (_req, res, next) => {
  try {
    const offerings = await ClinicSessionOfferingModel.find({ isActive: true }).lean();
    const sessionTypeIds = [...new Set(offerings.map((o: any) => String(o.sessionTypeId)))];
    const sessionTypes = await SessionTypeModel.find({ _id: { $in: sessionTypeIds }, isActive: true }).lean();
    const stMap = new Map((sessionTypes as any[]).map((st) => [String(st._id), st]));

    const items = offerings
      .filter((o: any) => stMap.has(String(o.sessionTypeId)))
      .map((o: any) => {
        const st = stMap.get(String(o.sessionTypeId))!;
        return {
          id: String(o._id),
          clinicId: String(o.clinicId),
          sessionTypeId: String(o.sessionTypeId),
          nameEn: (st as any).nameEn,
          nameAr: (st as any).nameAr,
          categorySlug: (st as any).categorySlug ?? "other",
          priceKwd: o.priceKwd,
          cashbackDeductionKwd: o.cashbackDeductionKwd ?? "0.000",
          bookingMode: o.bookingMode ?? "belamonda_cs",
          durationMinutes: o.durationMinutes
        };
      });
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ─── Admin: all offerings (including inactive) ──
sessionTypesRouter.get("/offerings/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const offerings = await ClinicSessionOfferingModel.find({}).lean();
    const sessionTypeIds = [...new Set(offerings.map((o: any) => String(o.sessionTypeId)))];
    const sessionTypes = await SessionTypeModel.find({ _id: { $in: sessionTypeIds } }).lean();
    const stMap = new Map((sessionTypes as any[]).map((st) => [String(st._id), st]));

    const items = offerings.map((o: any) => {
      const st = stMap.get(String(o.sessionTypeId));
      return {
        id: String(o._id),
        clinicId: String(o.clinicId),
        sessionTypeId: String(o.sessionTypeId),
        nameEn: (st as any)?.nameEn ?? "Unknown",
        nameAr: (st as any)?.nameAr ?? "غير معروف",
        categorySlug: (st as any)?.categorySlug ?? "other",
        priceKwd: o.priceKwd,
        cashbackDeductionKwd: o.cashbackDeductionKwd ?? "0.000",
        bookingMode: o.bookingMode ?? "belamonda_cs",
        durationMinutes: o.durationMinutes,
        isActive: !!o.isActive
      };
    });
    return res.json({ items });
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
      cashbackDeductionKwd: r.cashbackDeductionKwd ?? "0.000",
      bookingMode: r.bookingMode ?? "belamonda_cs",
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
          cashbackDeductionKwd: z.string().regex(/^\d+(\.\d{3})$/).optional(),
          bookingMode: z.enum(["belamonda_cs", "clinic_handles"]).optional(),
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
            cashbackDeductionKwd: parsed.data.cashbackDeductionKwd ?? "0.000",
            bookingMode: parsed.data.bookingMode ?? "belamonda_cs",
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

// Delete a clinic offering
sessionTypesRouter.delete(
  "/clinic/:clinicId/admin/:offeringId",
  authRequired,
  requireRole(["admin", "clinicStaff"]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.offeringId)) return res.status(400).json({ error: "INVALID_ID" });
      const doc = await ClinicSessionOfferingModel.findByIdAndDelete(req.params.offeringId);
      if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }
);

