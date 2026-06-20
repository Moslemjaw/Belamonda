import { Router } from "express";
import { PromotionModel, OfferModel } from "../../models/index.js";
import { authRequired } from "../../middlewares/authRequired.js";
import { z } from "zod";

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
      description: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/i, "Slug must be alphanumeric and dashes only"),
      offerIds: z.array(z.string()),
    }).safeParse(req.body);

    if (!d.success) return res.status(400).json({ error: d.error.issues[0].message });

    const existing = await PromotionModel.findOne({ slug: d.data.slug });
    if (existing) return res.status(400).json({ error: "Slug already in use" });

    const promo = await PromotionModel.create({
      title: d.data.title,
      description: d.data.description,
      slug: d.data.slug.toLowerCase(),
      offerIds: d.data.offerIds,
      createdBy: req.auth!.userId,
    });

    res.json(promo);
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
    res.json({ success: true });
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

export default router;
