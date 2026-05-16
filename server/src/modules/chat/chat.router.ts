import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import type { Role } from "@belamonda/shared";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { chatStore, type AttachmentRef } from "./chat.store.js";
import { bookingRequestsStore } from "../scheduling/bookingRequests.store.js";
import { commerceStore } from "../commerce/commerce.store.js";
import { emitToConversation } from "./chat.socket.js";
import { notifyChatRelatedUsers } from "../notifications/notifications.service.chat.js";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain"
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      cb(null, `${Date.now()}_${Math.random().toString(16).slice(2, 8)}_${safe}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_MEDIA_TYPE"));
    }
    cb(null, true);
  }
});

const PostMessageSchema = z.object({
  body: z.string().max(4000).optional().default(""),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number()
      })
    )
    .optional()
});

export const chatRouter = Router();

// List my conversations
chatRouter.get("/conversations", authRequired, (req, res) => {
  const isAdmin = req.auth!.role === "admin";
  const items = isAdmin
    ? chatStore.listAllConversations().map((c) => ({ ...c, unreadCount: 0 }))
    : chatStore.listConversationsForUser(req.auth!.userId);
  return res.json({ items });
});

async function checkConvAccess(req: any, conv: any) {
  if (req.auth!.role === "admin") return true;
  if (chatStore.isParticipant(conv.id, req.auth!.userId)) return true;
  if (req.auth!.role === "clinicStaff" && conv.bookingRequestId) {
    const breq = await bookingRequestsStore.get(conv.bookingRequestId);
    if (breq && breq.clinicId === req.auth!.clinicId) return true;
  }
  return false;
}

// Get a conversation (participant or admin)
chatRouter.get("/conversations/:id", authRequired, async (req, res, next) => {
  try {
    const conv = chatStore.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await checkConvAccess(req, conv))) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const breq = conv.bookingRequestId ? await bookingRequestsStore.get(conv.bookingRequestId) : null;
    const userOffer = breq?.userOfferId ? commerceStore.get(breq.userOfferId) : null;
    return res.json({ conversation: conv, bookingRequest: breq, userOffer });
  } catch (error) {
    next(error);
  }
});

// Paginated messages
chatRouter.get("/conversations/:id/messages", authRequired, async (req, res, next) => {
  try {
    const conv = chatStore.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await checkConvAccess(req, conv))) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const before = typeof req.query.before === "string" ? req.query.before : undefined;
    const limit = req.query.limit ? Math.min(100, Number(req.query.limit)) : 50;
    const result = chatStore.listMessages(conv.id, { before, limit });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// Post a message via REST (also broadcasts via socket)
chatRouter.post("/conversations/:id/messages", authRequired, async (req, res, next) => {
  try {
    const conv = chatStore.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "NOT_FOUND" });
    if (req.auth!.role === "admin") {
      return res.status(403).json({ error: "ADMIN_READ_ONLY" });
    }
    if (!(await checkConvAccess(req, conv))) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const parsed = PostMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const body = parsed.data.body.trim();
    const attachments = parsed.data.attachments ?? [];
    if (!body && attachments.length === 0) return res.status(400).json({ error: "EMPTY_MESSAGE" });

    const msg = chatStore.addMessage({
      conversationId: conv.id,
      senderId: req.auth!.userId,
      senderRole: req.auth!.role as Role,
      body,
      attachments
    });
    if (!msg) return res.status(500).json({ error: "SEND_FAILED" });

    emitToConversation(conv.id, "message:new", { conversationId: conv.id, message: msg });

    const recipients = conv.participants.map((p) => p.userId).filter((u) => u !== req.auth!.userId);
    notifyChatRelatedUsers({
      userIds: recipients,
      kind: "chat_message",
      body: body || (attachments[0]?.filename ?? "Attachment"),
      payload: { conversationId: conv.id, messageId: msg.id }
    });

    return res.status(201).json({ message: msg });
  } catch (error) {
    next(error);
  }
});

// Mark conversation as read up to a message id
const MarkReadSchema = z.object({ lastMessageId: z.string().optional() });
chatRouter.post("/conversations/:id/read", authRequired, async (req, res, next) => {
  try {
    const conv = chatStore.getConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await checkConvAccess(req, conv))) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const parsed = MarkReadSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    const cur = chatStore.markRead(conv.id, req.auth!.userId, parsed.data.lastMessageId);
    emitToConversation(conv.id, "read:update", {
      conversationId: conv.id,
      userId: req.auth!.userId,
      lastReadMessageId: cur.lastReadMessageId,
      lastReadAt: cur.lastReadAt
    });
    return res.json({ cursor: cur });
  } catch (error) {
    next(error);
  }
});

// File upload — returns AttachmentRef the client can attach to the next message
chatRouter.post(
  "/uploads",
  authRequired,
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "UPLOAD_ERROR";
        if (msg === "UNSUPPORTED_MEDIA_TYPE") return res.status(415).json({ error: msg });
        if ((err as any)?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "FILE_TOO_LARGE" });
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  (req, res) => {
    const f = (req as any).file as Express.Multer.File | undefined;
    if (!f) return res.status(400).json({ error: "NO_FILE" });
    const ref: AttachmentRef = {
      id: f.filename,
      url: `/uploads/${f.filename}`,
      filename: f.originalname,
      mimeType: f.mimetype,
      sizeBytes: f.size
    };
    return res.status(201).json({ attachment: ref });
  }
);

// CR / admin can open a direct conversation with a customer
const OpenDirectSchema = z.object({
  customerUserId: z.string().min(1),
  title: z.string().max(120).optional()
});
chatRouter.post("/conversations/direct", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const parsed = OpenDirectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  const conv = chatStore.createConversation({
    kind: "direct",
    title: parsed.data.title || `Direct chat with ${parsed.data.customerUserId}`,
    participants: [
      { userId: req.auth!.userId, role: req.auth!.role as Role, joinedAt: new Date().toISOString() },
      { userId: parsed.data.customerUserId, role: "customer", joinedAt: new Date().toISOString() }
    ]
  });
  return res.status(201).json({ conversation: conv });
});

// Admin monitor: full conversation list with status info
chatRouter.get("/admin/overview", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const conversations = chatStore.listAllConversations();
    const items = await Promise.all(
      conversations.map(async (c) => {
        const breq = c.bookingRequestId ? await bookingRequestsStore.get(c.bookingRequestId) : null;
        return {
          conversation: c,
          bookingRequest: breq
        };
      })
    );
    return res.json({ items });
  } catch (error) {
    next(error);
  }
});
