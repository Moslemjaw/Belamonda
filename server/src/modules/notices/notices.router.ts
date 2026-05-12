import { Router } from "express";
import mongoose, { Schema, Document } from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";

// ── Model ──────────────────────────────────────────────────────────────────

interface IClinicNotice extends Document {
  message: string;
  messageAr?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicNoticeSchema = new Schema<IClinicNotice>(
  {
    message:   { type: String, required: true, trim: true },
    messageAr: { type: String, default: "", trim: true },
    isActive:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ClinicNoticeModel =
  (mongoose.models["ClinicNotice"] as mongoose.Model<IClinicNotice>) ||
  mongoose.model<IClinicNotice>("ClinicNotice", ClinicNoticeSchema);

// ── Router ─────────────────────────────────────────────────────────────────

export const noticesRouter = Router();

// GET /notices/active — any authenticated user can fetch the active banner
noticesRouter.get("/active", authRequired, async (_req, res) => {
  try {
    const notice = await ClinicNoticeModel.findOne({ isActive: true })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ notice: notice ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /notices/admin — list all notices
noticesRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res) => {
  try {
    const items = await ClinicNoticeModel.find().sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /notices/admin — create a notice
noticesRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const { message, messageAr, isActive } = req.body as {
      message: string; messageAr?: string; isActive?: boolean;
    };
    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    // If this one is being set active, deactivate all others first
    if (isActive) {
      await ClinicNoticeModel.updateMany({}, { isActive: false });
    }
    const notice = await ClinicNoticeModel.create({ message, messageAr, isActive: !!isActive });
    res.json({ notice });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notices/admin/:id — update message or toggle isActive
noticesRouter.put("/admin/:id", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const { message, messageAr, isActive } = req.body as {
      message?: string; messageAr?: string; isActive?: boolean;
    };
    // If activating this one, deactivate all others first
    if (isActive === true) {
      await ClinicNoticeModel.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    }
    const update: Partial<IClinicNotice> = {};
    if (message !== undefined) update.message = message;
    if (messageAr !== undefined) update.messageAr = messageAr;
    if (isActive !== undefined) update.isActive = isActive;
    const notice = await ClinicNoticeModel.findByIdAndUpdate(
      req.params.id, update, { new: true }
    ).lean();
    if (!notice) { res.status(404).json({ error: "not found" }); return; }
    res.json({ notice });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /notices/admin/:id
noticesRouter.delete("/admin/:id", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    await ClinicNoticeModel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
