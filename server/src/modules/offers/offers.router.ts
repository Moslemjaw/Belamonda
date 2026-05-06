import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as clinicService from "../../services/clinic.service.js";
import * as offerService from "../../services/offer.service.js";

const KwdString = z.string().regex(/^\d+(\.\d{3})$/);

const OfferBaseFields = z.object({
  name: z.string().min(1),
  category: z.enum(["laser", "beauty", "skincare", "other"]).optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  clinicId: z.string().min(1),
  subscriptionPriceKwd: KwdString,
  validityDays: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
  isCashbackOnly: z.boolean().optional(),
  signupCashbackKwd: KwdString.optional(),
  cashbackActivationFeeKwd: KwdString.optional(),
  tagsEn: z.array(z.string().min(1)).optional(),
  tagsAr: z.array(z.string().min(1)).optional(),
  allowFullPayment: z.boolean().optional(),
  allowInstallments: z.boolean().optional(),
  maxInstallments: z.number().int().min(1).optional(),
  allowDeposit: z.boolean().optional(),
  depositAmountKwd: KwdString.optional(),
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

const OfferTypeASchema = OfferBaseFields.extend({
  type: z.literal("A")
});

const OfferTypeBSchema = OfferBaseFields.extend({
  type: z.literal("B"),
  perVisitPriceKwd: KwdString,
  originalClinicPriceKwd: KwdString
});

const OfferCreateSchema = z.discriminatedUnion("type", [OfferTypeASchema, OfferTypeBSchema]);
const OfferUpdateSchema = z.union([OfferTypeASchema.partial(), OfferTypeBSchema.partial()]);

export const offersRouter = Router();

offersRouter.get("/", async (req, res, next) => {
  try {
    const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const type = req.query.type === "A" || req.query.type === "B" ? req.query.type : undefined;
    const featured =
      req.query.featured === "true" ? true : req.query.featured === "false" ? false : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await offerService.listOffersPublic({
      clinicId,
      category,
      type,
      featured,
      search,
      page,
      limit
    });
    return res.json({ items: result.items, page: result.page, limit: result.limit });
  } catch (e) {
    next(e);
  }
});

offersRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const items = await offerService.listOffersAdmin();
    return res.json({ items, offers: items });
  } catch (e) {
    next(e);
  }
});

offersRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = OfferCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    if (!(parsed.data.categoryIds && parsed.data.categoryIds.length)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        details: { formErrors: [], fieldErrors: { categoryIds: ["Select at least one category"] } }
      });
    }

    const clinic = await clinicService.getClinic(parsed.data.clinicId);
    if (!clinic || !clinic.active) return res.status(400).json({ error: "CLINIC_NOT_FOUND_OR_INACTIVE" });

    const offer = await offerService.createOffer({
      ...parsed.data,
      category: parsed.data.category, // kept for backwards-compat / primary slug
      categoryIds: parsed.data.categoryIds
    });
    return res.status(201).json({ offer });
  } catch (e) {
    next(e);
  }
});

offersRouter.patch("/admin/:offerId", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = OfferUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const offer = await offerService.updateOffer(req.params.offerId, parsed.data as Record<string, unknown>);
    if (!offer) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ offer });
  } catch (e) {
    next(e);
  }
});
