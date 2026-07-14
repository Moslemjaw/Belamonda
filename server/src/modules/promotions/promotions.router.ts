import { Router } from "express";
import { PromotionModel, PromotionSubmissionModel, OfferModel } from "../../models/index.js";
import { authRequired } from "../../middlewares/authRequired.js";
import { z } from "zod";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: "dyxzbgiic",
  api_key: "525168948871956",
  api_secret: "q4Qf-Y32H9yVJYm-G-m1ufJ15Ns"
});

async function uploadToCloudinary(base64Image: string): Promise<string> {
  if (!base64Image || !base64Image.startsWith("data:image")) return base64Image;
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: "promo_images"
  });
  return result.secure_url;
}

const router = Router();

// --- Admin Routes ---

router.get("/admin", authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== "admin" && req.auth!.role !== "finance") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const promos = await PromotionModel.find()
      .populate("offerIds", "name nameAr subscriptionPriceKwd categoryIds")
      .populate("createdBy", "name username")
      .sort({ createdAt: -1 });
    res.json({ items: promos });
  } catch (e) {
    next(e);
  }
});

router.post("/admin", authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== "admin" && req.auth!.role !== "finance") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const d = z.object({
      title: z.string().min(1),
      descriptionEn: z.string().optional().default(""),
      descriptionAr: z.string().optional().default(""),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/i, "Slug must be alphanumeric and dashes only"),
      imageUrl: z.string().optional(),
      type: z.enum(["packages", "survey"]).optional().default("packages"),
      offerIds: z.array(z.string()).optional().default([]),
      surveyQuestions: z.array(z.object({
        key: z.string(),
        type: z.enum(["short_text", "long_text", "single_choice", "multi_choice"]),
        labelEn: z.string(),
        labelAr: z.string().optional(),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional()
      })).optional().default([])
    }).safeParse(req.body);

    if (!d.success) return res.status(400).json({ error: d.error.issues[0].message });

    let finalImageUrl = d.data.imageUrl;
    if (finalImageUrl) {
      finalImageUrl = await uploadToCloudinary(finalImageUrl);
    }

    const existing = await PromotionModel.findOne({ slug: d.data.slug });
    if (existing) return res.status(400).json({ error: "Slug already in use" });

    const promo = await PromotionModel.create({
      title: d.data.title,
      description: d.data.descriptionEn || d.data.descriptionAr,
      descriptionEn: d.data.descriptionEn,
      descriptionAr: d.data.descriptionAr,
      slug: d.data.slug.toLowerCase(),
      imageUrl: finalImageUrl,
      type: d.data.type,
      offerIds: d.data.type === "packages" ? d.data.offerIds : [],
      surveyQuestions: d.data.type === "survey" ? d.data.surveyQuestions : [],
      createdBy: req.auth!.userId,
    });

    res.json(promo);
  } catch (e) {
    next(e);
  }
});

router.put("/admin/:id", authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== "admin" && req.auth!.role !== "finance") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const d = z.object({
      title: z.string().min(1),
      descriptionEn: z.string().optional().default(""),
      descriptionAr: z.string().optional().default(""),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/i, "Slug must be alphanumeric and dashes only"),
      imageUrl: z.string().optional(),
      type: z.enum(["packages", "survey"]).optional().default("packages"),
      offerIds: z.array(z.string()).optional().default([]),
      surveyQuestions: z.array(z.object({
        key: z.string(),
        type: z.enum(["short_text", "long_text", "single_choice", "multi_choice"]),
        labelEn: z.string(),
        labelAr: z.string().optional(),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional()
      })).optional().default([])
    }).safeParse(req.body);

    if (!d.success) return res.status(400).json({ error: d.error.issues[0].message });

    const p = await PromotionModel.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });

    // Check slug uniqueness
    if (p.slug !== d.data.slug.toLowerCase()) {
      const existing = await PromotionModel.findOne({ slug: d.data.slug.toLowerCase() });
      if (existing) return res.status(400).json({ error: "Slug already in use" });
    }

    p.title = d.data.title;
    p.description = d.data.descriptionEn || d.data.descriptionAr;
    p.descriptionEn = d.data.descriptionEn;
    p.descriptionAr = d.data.descriptionAr;
    p.slug = d.data.slug.toLowerCase();
    
    if (d.data.imageUrl !== undefined) {
      if (d.data.imageUrl.startsWith("data:image")) {
        p.imageUrl = await uploadToCloudinary(d.data.imageUrl);
      } else {
        p.imageUrl = d.data.imageUrl;
      }
    }

    p.type = d.data.type as any;
    p.offerIds = d.data.type === "packages" ? d.data.offerIds : [];
    p.surveyQuestions = d.data.type === "survey" ? d.data.surveyQuestions as any : [];

    await p.save();
    res.json(p);
  } catch (e) {
    next(e);
  }
});

router.patch("/admin/:id/toggle", authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== "admin" && req.auth!.role !== "finance") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const p = await PromotionModel.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });

    p.isActive = !p.isActive;
    await p.save();
    res.json(p);
  } catch (e) {
    next(e);
  }
});

router.delete("/admin/:id", authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== "admin" && req.auth!.role !== "finance") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await PromotionModel.findByIdAndDelete(req.params.id);
    await PromotionSubmissionModel.deleteMany({ promotionId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.get("/admin/:id/submissions", authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== "admin" && req.auth!.role !== "finance") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const subs = await PromotionSubmissionModel.find({ promotionId: req.params.id }).sort({ createdAt: -1 });
    res.json({ items: subs });
  } catch (e) {
    next(e);
  }
});


// --- Public Routes ---

router.get("/public/:slug", async (req, res, next) => {
  try {
    const promo = await PromotionModel.findOne({ slug: req.params.slug.toLowerCase() });
    if (!promo || !promo.isActive) {
      return res.status(404).json({ error: "Promotion not found or inactive" });
    }
    
    if (promo.type === "survey") {
      return res.json(promo);
    }
    
    // Populate the offers with relevant details needed for the public landing page
    const populated = await PromotionModel.findById(promo._id).populate({
      path: "offerIds",
      select: "name nameAr subtitle description subscriptionPriceKwd originalClinicPriceKwd imageUrl bannerUrl validityDays categoryIds",
      match: { status: "active" } // Only show active offers
    });

    res.json(populated);
  } catch (e) {
    next(e);
  }
});

router.post("/public/:slug/submit", async (req, res, next) => {
  try {
    const promo = await PromotionModel.findOne({ slug: req.params.slug.toLowerCase() });
    if (!promo || !promo.isActive || promo.type !== "survey") {
      return res.status(404).json({ error: "Survey not found or inactive" });
    }

    const d = z.object({
      answers: z.array(z.object({
        key: z.string(),
        value: z.any()
      })),
      guestName: z.string().optional(),
      guestPhone: z.string().optional(),
      guestEmail: z.string().optional()
    }).safeParse(req.body);

    if (!d.success) return res.status(400).json({ error: "Invalid submission data" });

    // Enforce required fields
    for (const q of promo.surveyQuestions) {
      if (q.required) {
        const a = d.data.answers.find((x: any) => x.key === q.key);
        if (!a || a.value === "" || a.value === null || a.value === undefined || (Array.isArray(a.value) && a.value.length === 0)) {
          return res.status(400).json({ error: `Missing required answer for ${q.key}` });
        }
      }
    }

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "";
    const userAgent = req.headers["user-agent"]?.toString() || "";
    
    // Optional: if the endpoint has an auth token, save the userId.
    const authHeader = req.headers.authorization;
    let userId: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const { verifyAccessToken } = await import("../auth/token.js");
        const payload = verifyAccessToken(authHeader.substring(7));
        if (payload?.sub) userId = payload.sub;
      } catch (err) {
        // ignore invalid token for public submit
      }
    }

    const sub = await PromotionSubmissionModel.create({
      promotionId: promo._id,
      promotionTitle: promo.title,
      userId,
      guestName: d.data.guestName,
      guestPhone: d.data.guestPhone,
      guestEmail: d.data.guestEmail,
      answers: d.data.answers,
      ip,
      userAgent
    });

    res.status(201).json({ success: true, submissionId: sub._id });
  } catch (e) {
    next(e);
  }
});

export default router;
