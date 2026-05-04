import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { clinicsStore } from "./clinics.store.js";

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

// Public list (active only)
clinicsRouter.get("/", (_req, res) => {
  const items = clinicsStore.list({ activeOnly: true });
  return res.json({ items });
});

// Admin/CS internal list (includes inactive)
clinicsRouter.get("/admin", authRequired, requireRole(["admin"]), (_req, res) => {
  const items = clinicsStore.list({ activeOnly: false });
  return res.json({ items });
});

clinicsRouter.post("/admin", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = ClinicCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const clinic = clinicsStore.create(parsed.data);
  return res.status(201).json({ clinic });
});

clinicsRouter.patch("/admin/:clinicId", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = ClinicUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const clinic = clinicsStore.update(req.params.clinicId, parsed.data);
  if (!clinic) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ clinic });
});

