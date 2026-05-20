import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { ComplaintModel, ComplaintUpdateModel } from "../../models/complaint.model.js";

const CreateSchema = z.object({
  category: z.enum(["service_quality", "billing", "scheduling", "cashback", "clinic", "other"]),
  subject: z.string().min(3),
  description: z.string().min(10),
});

const UpdateSchema = z.object({
  status: z.enum(["in_progress", "escalated", "resolved", "closed"]).optional(),
  note: z.string().min(1),
});

export const complaintsRouter = Router();

// Customer submits complaint
complaintsRouter.post("/me", authRequired, async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const doc = await ComplaintModel.create({
      userId: req.auth!.userId,
      category: parsed.data.category,
      subject: parsed.data.subject,
      description: parsed.data.description,
      status: "open"
    });
    return res.status(201).json({ complaint: { id: String(doc._id) } });
  } catch (e) {
    next(e);
  }
});

// Customer lists own complaints
complaintsRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const rows = await ComplaintModel.find({ userId: req.auth!.userId }).sort({ createdAt: -1 }).lean();
    const items = rows.map((c: any) => ({
      id: String(c._id),
      userId: c.userId,
      category: c.category,
      subject: c.subject,
      status: c.status,
      createdAt: new Date(c.createdAt).toISOString()
    }));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// CS/Admin list all complaints
complaintsRouter.get("/all", authRequired, requireRole(["cs", "admin", "legal"]), async (_req, res, next) => {
  try {
    const rows = await ComplaintModel.find({}).sort({ createdAt: -1 }).lean();
    const items = rows.map((c: any) => ({
      id: String(c._id),
      userId: c.userId,
      category: c.category,
      subject: c.subject,
      status: c.status,
      createdAt: new Date(c.createdAt).toISOString()
    }));
    return res.json({ items, total: items.length });
  } catch (e) {
    next(e);
  }
});

// CS/Admin update complaint
complaintsRouter.post("/:id/update", authRequired, requireRole(["cs", "admin", "legal"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const complaint = await ComplaintModel.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: "NOT_FOUND" });

    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    if (parsed.data.status) complaint.status = parsed.data.status as any;
    await complaint.save();

    await ComplaintUpdateModel.create({
      complaintId: new mongoose.Types.ObjectId(req.params.id),
      by: req.auth!.userId,
      note: parsed.data.note,
      status: parsed.data.status ?? complaint.status
    });

    return res.json({ complaint: { id: String(complaint._id) } });
  } catch (e) {
    next(e);
  }
});
