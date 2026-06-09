import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as clinicService from "../../services/clinic.service.js";
import { UserModel } from "../../models/user.model.js";
import bcrypt from "bcryptjs";

const ClinicCreateSchema = z.object({
  nameEn: z.string().min(1),
  nameAr: z.string().default(""),
  address: z.string().default(""),
  lat: z.number().optional(),
  lng: z.number().optional(),
  phone: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("").optional()),
  categoryTags: z.array(z.string().min(1)).default([]),
  operatingHours: z
    .object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/)
    })
    .optional(),
  active: z.boolean().default(true),
  account: z.string().optional(),
  password: z.string().optional()
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
    
    const { account, password, ...clinicData } = parsed.data;
    const clinic = await clinicService.createClinic(clinicData);

    let accountWarning: string | undefined;
    if (account && password) {
      try {
        const existing = await UserModel.findOne({ username: account });
        if (existing) {
          accountWarning = "USERNAME_TAKEN";
        } else {
          const passwordHash = await bcrypt.hash(password, 10);
          await UserModel.create({
            username: account,
            passwordHash,
            role: "clinicStaff",
            clinicId: clinic.id,
            isActive: true
          });
        }
      } catch (userErr: unknown) {
        // User account creation failed — clinic still created, warn caller.
        console.error("[clinics] staff user creation failed:", userErr);
        accountWarning = "ACCOUNT_CREATION_FAILED";
      }
    }

    return res.status(201).json({ clinic, ...(accountWarning ? { accountWarning } : {}) });
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

clinicsRouter.delete("/admin/:clinicId", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const success = await clinicService.deleteClinic(req.params.clinicId);
    if (!success) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// Clinic staff self-update — lets a clinicStaff user update their own clinic.
// Must be registered BEFORE the public /:clinicId GET to avoid shadowing.
const ClinicSelfUpdateSchema = z.object({
  nameEn: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
});

clinicsRouter.patch("/me", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const clinicId = req.auth!.clinicId?.toString();
    if (!clinicId) return res.status(400).json({ error: "NO_CLINIC_LINKED" });
    const parsed = ClinicSelfUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const clinic = await clinicService.updateClinic(clinicId, parsed.data);
    if (!clinic) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ clinic });
  } catch (e) {
    next(e);
  }
});

const ProductsSchema = z.array(z.object({
  name: z.string().min(1),
  priceKwd: z.string().regex(/^\d+(\.\d{1,3})?$/)
}));

clinicsRouter.post("/me/products", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const clinicId = req.auth!.clinicId?.toString();
    if (!clinicId) return res.status(400).json({ error: "NO_CLINIC_LINKED" });
    const parsed = ProductsSchema.safeParse(req.body.products);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    
    const { ClinicModel } = await import("../../models/clinic.model.js");
    const clinic = await ClinicModel.findByIdAndUpdate(clinicId, { $set: { products: parsed.data } }, { new: true });
    if (!clinic) return res.status(404).json({ error: "NOT_FOUND" });
    
    return res.json({ products: clinic.products });
  } catch (e) {
    next(e);
  }
});

// Public single-clinic lookup (used by checkout for branch confirmation).
// Registered last so it doesn't shadow `/admin` and `/admin/:clinicId`.
clinicsRouter.get("/:clinicId", async (req, res, next) => {
  try {
    const clinic = await clinicService.getClinic(req.params.clinicId);
    if (!clinic) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ clinic });
  } catch (e) {
    next(e);
  }
});
