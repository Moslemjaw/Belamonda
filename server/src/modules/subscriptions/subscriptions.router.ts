import { Router } from "express";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { SubscriptionPlanModel } from "../../models/subscriptionPlan.model.js";

export const subscriptionsRouter = Router();

// GET all subscription plans
subscriptionsRouter.get("/plans", async (req, res, next) => {
  try {
    const plans = await SubscriptionPlanModel.find().sort({ createdAt: -1 }).lean();
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// POST create a new subscription plan
subscriptionsRouter.post("/plans", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const plan = await SubscriptionPlanModel.create(req.body);
    res.status(201).json(plan);
  } catch (e) {
    next(e);
  }
});

// PUT update a subscription plan
subscriptionsRouter.put("/plans/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const plan = await SubscriptionPlanModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json(plan);
  } catch (e) {
    next(e);
  }
});

// DELETE a subscription plan
subscriptionsRouter.delete("/plans/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const plan = await SubscriptionPlanModel.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
