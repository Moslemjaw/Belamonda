import { Router } from "express";
import mongoose, { Schema, Document } from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";

// ── Model ──────────────────────────────────────────────────────────────────

interface IClinicNotice extends Document {
  message: string;
  messageAr?: string;
  isActive: boolean;
  clinicId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicNoticeSchema = new Schema<IClinicNotice>(
  {
    message:   { type: String, required: true, trim: true },
    messageAr: { type: String, default: "", trim: true },
    isActive:  { type: Boolean, default: false },
    clinicId:  { type: Schema.Types.ObjectId, ref: "Clinic", default: null },
  },
  { timestamps: true }
);

const ClinicNoticeModel =
  (mongoose.models["ClinicNotice"] as mongoose.Model<IClinicNotice>) ||
  mongoose.model<IClinicNotice>("ClinicNotice", ClinicNoticeSchema);

// ── Router ─────────────────────────────────────────────────────────────────

export const noticesRouter = Router();

// GET /notices/active — returns the best matching active notice for the caller.
// Clinic staff: prefer a notice targeted to their clinic; fall back to global (no clinicId).
// Others: return global active notice.
noticesRouter.get("/active", authRequired, async (req, res) => {
  try {
    const callerClinicId = req.auth!.clinicId?.toString() ?? null;

    if (callerClinicId && mongoose.isValidObjectId(callerClinicId)) {
      // 1. Look for a clinic-specific active notice
      const specific = await ClinicNoticeModel.findOne({
        isActive: true,
        clinicId: new mongoose.Types.ObjectId(callerClinicId),
      }).sort({ updatedAt: -1 }).lean();

      if (specific) {
        res.json({ notice: specific });
        return;
      }

      // 2. Fall back to global active notice (clinicId is null/undefined)
      const global = await ClinicNoticeModel.findOne({
        isActive: true,
        clinicId: null,
      }).sort({ updatedAt: -1 }).lean();

      res.json({ notice: global ?? null });
      return;
    }

    // Non-clinic users: return any active global notice
    const notice = await ClinicNoticeModel.findOne({ isActive: true, clinicId: null })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ notice: notice ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /notices/admin — list all notices (with clinic info populated)
noticesRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res) => {
  try {
    const items = await ClinicNoticeModel.find()
      .sort({ createdAt: -1 })
      .populate("clinicId", "nameEn nameAr")
      .lean();
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /notices/admin — create a notice
noticesRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const { message, messageAr, isActive, clinicId } = req.body as {
      message: string; messageAr?: string; isActive?: boolean; clinicId?: string | null;
    };
    if (!message?.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const targetClinicId =
      clinicId && mongoose.isValidObjectId(clinicId)
        ? new mongoose.Types.ObjectId(clinicId)
        : null;

    // If activating, deactivate other notices with the same scope
    if (isActive) {
      await ClinicNoticeModel.updateMany(
        targetClinicId ? { clinicId: targetClinicId } : { clinicId: null },
        { isActive: false }
      );
    }

    const notice = await ClinicNoticeModel.create({
      message,
      messageAr,
      isActive: !!isActive,
      clinicId: targetClinicId,
    });

    const populated = await notice.populate("clinicId", "nameEn nameAr");
    res.json({ notice: populated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /notices/admin/:id — update message or toggle isActive
noticesRouter.put("/admin/:id", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const { message, messageAr, isActive, clinicId } = req.body as {
      message?: string; messageAr?: string; isActive?: boolean; clinicId?: string | null;
    };

    const existing = await ClinicNoticeModel.findById(req.params.id).lean();
    if (!existing) { res.status(404).json({ error: "not found" }); return; }

    const targetClinicId =
      clinicId !== undefined
        ? (clinicId && mongoose.isValidObjectId(clinicId)
            ? new mongoose.Types.ObjectId(clinicId)
            : null)
        : existing.clinicId ?? null;

    // If activating, deactivate others in the same scope
    if (isActive === true) {
      await ClinicNoticeModel.updateMany(
        {
          _id: { $ne: req.params.id },
          ...(targetClinicId ? { clinicId: targetClinicId } : { clinicId: null }),
        },
        { isActive: false }
      );
    }

    const update: Partial<IClinicNotice> = {};
    if (message !== undefined) update.message = message;
    if (messageAr !== undefined) update.messageAr = messageAr;
    if (isActive !== undefined) update.isActive = isActive;
    if (clinicId !== undefined) update.clinicId = targetClinicId as any;

    const notice = await ClinicNoticeModel.findByIdAndUpdate(
      req.params.id, update, { new: true }
    ).populate("clinicId", "nameEn nameAr").lean();

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
