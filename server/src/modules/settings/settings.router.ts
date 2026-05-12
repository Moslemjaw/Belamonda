import { Router } from "express";
import mongoose, { Schema, Document } from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";

// ── Model ─────────────────────────────────────────────────────────────────

interface ISystemSettings extends Document {
  key: string;
  value: any;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  { key: { type: String, required: true, unique: true }, value: { type: Schema.Types.Mixed } },
  { timestamps: true }
);

const SystemSettingsModel =
  (mongoose.models["SystemSettings"] as mongoose.Model<ISystemSettings>) ||
  mongoose.model<ISystemSettings>("SystemSettings", SystemSettingsSchema);

// Defaults
const DEFAULTS = {
  maintenanceMode: false,
  allowNewSignups: true,
  defaultLanguage: "en",
  requireInstallmentPayment: false,
  sessionTimeoutHours: 24,
  force2FAForAdmins: false,
};

async function getSettings() {
  const docs = await SystemSettingsModel.find().lean();
  const result: Record<string, any> = { ...DEFAULTS };
  for (const d of docs) result[d.key] = d.value;
  return result;
}

// ── Router ────────────────────────────────────────────────────────────────

export const settingsRouter = Router();

// GET /settings/system — admin only
settingsRouter.get("/system", authRequired, requireRole(["admin"]), async (_req, res) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /settings/system — admin only, upsert all provided keys
settingsRouter.put("/system", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const updates = req.body as Record<string, any>;
    const ops = Object.entries(updates).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: { $set: { key, value } },
        upsert: true,
      },
    }));
    if (ops.length) await SystemSettingsModel.bulkWrite(ops);
    res.json({ settings: await getSettings() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
