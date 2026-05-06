import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as clinicService from "../../services/clinic.service.js";

const ClinicCreateSchema = z.object({
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().optional(),
  categoryTags: z.array(z.string().min(1)).default([]),
  operatingHours: z
    .object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/)
    })
    .optional(),
  active: z.boolean().default(true)
});

const ClinicUpdateSchema = ClinicCreateSchema.partial();

export const clinicsRouter = Router();

clinicsRouter.get("/", async (_req, res, next) => {
  try {
    const items = await clinicService.listClinics({ activeOnly: true });
    return res.json({ items, clinics: items });
  } catch (e) {
    next(e);
  }
});

clinicsRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const items = await clinicService.listClinics({ activeOnly: false });
    return res.json({ items, clinics: items });
  } catch (e) {
    next(e);
  }
});

clinicsRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = ClinicCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const clinic = await clinicService.createClinic(parsed.data);
    return res.status(201).json({ clinic });
  } catch (e) {
    next(e);
  }
});

clinicsRouter.patch("/admin/:clinicId", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = ClinicUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const clinic = await clinicService.updateClinic(req.params.clinicId, parsed.data);
    if (!clinic) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ clinic });
  } catch (e) {
    next(e);
  }
});
