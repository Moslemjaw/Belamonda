import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { notificationsStore } from "./notifications.store.js";
import { notificationSettingsStore } from "./notifications.settings.store.js";

const MarkReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

const SettingsUpdateSchema = z.object({
  updates: z.array(z.object({
    type: z.string().min(1),
    channels: z.object({
      in_app: z.boolean().optional(),
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      whatsapp: z.boolean().optional()
    })
  })).min(1)
});

export const notificationsRouter = Router();

// ── Customer inbox ─────────────────────────────────────────────────────────

notificationsRouter.get("/me", authRequired, (req, res) => {
  const inbox = notificationsStore.listInbox(req.auth!.userId);
  const outbound = notificationsStore.listOutbound(req.auth!.userId);
  const unreadCount = notificationsStore.unreadCount(req.auth!.userId);
  return res.json({ inbox, outbound, unreadCount });
});

notificationsRouter.post("/me/mark-read", authRequired, (req, res) => {
  const parsed = MarkReadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const updated = notificationsStore.markRead(req.auth!.userId, parsed.data.ids);
  return res.json({ inbox: updated });
});

notificationsRouter.post("/me/mark-all-read", authRequired, (req, res) => {
  const updated = notificationsStore.markAllRead(req.auth!.userId);
  return res.json({ inbox: updated });
});

// ── Admin: notification settings ───────────────────────────────────────────

notificationsRouter.get("/admin/settings", authRequired, requireRole(["admin"]), (_req, res) => {
  const settings = notificationSettingsStore.list();
  return res.json({ settings });
});

notificationsRouter.put("/admin/settings", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = SettingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const updated = notificationSettingsStore.upsert(parsed.data.updates);
  return res.json({ settings: updated });
});
