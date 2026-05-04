import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { notificationsStore } from "./notifications.store.js";

const MarkReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

export const notificationsRouter = Router();

notificationsRouter.get("/me", authRequired, (req, res) => {
  const inbox = notificationsStore.listInbox(req.auth!.userId);
  const outbound = notificationsStore.listOutbound(req.auth!.userId);
  return res.json({ inbox, outbound });
});

notificationsRouter.post("/me/mark-read", authRequired, (req, res) => {
  const parsed = MarkReadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const updated = notificationsStore.markRead(req.auth!.userId, parsed.data.ids);
  return res.json({ inbox: updated });
});

