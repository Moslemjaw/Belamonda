import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { clinicsStore } from "../clinics/clinics.store.js";
import { offersStore } from "./offers.store.js";

const KwdString = z.string().regex(/^\d+(\.\d{3})$/); // SRS: 3 decimals

const OfferBaseSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["laser", "beauty", "skincare", "other"]),
  clinicId: z.string().min(1),
  subscriptionPriceKwd: KwdString,
  validityDays: z.number().int().positive(),
  cashbackPerSessionKwd: KwdString.default("0.000"),
  sessionIntervalDays: z.number().int().min(0).default(0),
  maxSessions: z.number().int().positive().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  enrollmentCap: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  description: z.string().optional(),
  terms: z.string().optional()
});

const OfferTypeASchema = OfferBaseSchema.extend({
  type: z.literal("A")
});

const OfferTypeBSchema = OfferBaseSchema.extend({
  type: z.literal("B"),
  perVisitPriceKwd: KwdString,
  originalClinicPriceKwd: KwdString
});

const OfferCreateSchema = z.discriminatedUnion("type", [OfferTypeASchema, OfferTypeBSchema]);
const OfferUpdateSchema = z.union([OfferTypeASchema.partial(), OfferTypeBSchema.partial()]);

export const offersRouter = Router();

// Public catalog browse (SRS FR-04, §5.1 catalog)
offersRouter.get("/", (req, res) => {
  const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  const category =
    req.query.category === "laser" || req.query.category === "beauty" || req.query.category === "skincare" || req.query.category === "other"
      ? req.query.category
      : undefined;
  const type = req.query.type === "A" || req.query.type === "B" ? req.query.type : undefined;
  const featured =
    req.query.featured === "true" ? true : req.query.featured === "false" ? false : undefined;

  const items = offersStore.listPublic({ clinicId, category, type, featured });
  return res.json({ items });
});

// Admin list (includes inactive and outside windows)
offersRouter.get("/admin", authRequired, requireRole(["admin"]), (_req, res) => {
  const items = offersStore.listAdmin();
  return res.json({ items });
});

offersRouter.post("/admin", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = OfferCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const clinic = clinicsStore.get(parsed.data.clinicId);
  if (!clinic || !clinic.active) return res.status(400).json({ error: "CLINIC_NOT_FOUND_OR_INACTIVE" });

  const offer = offersStore.create({
    ...parsed.data,
    enrolledCount: 0
  } as any);
  return res.status(201).json({ offer });
});

offersRouter.patch("/admin/:offerId", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = OfferUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const offer = offersStore.update(req.params.offerId, parsed.data as any);
  if (!offer) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ offer });
});

