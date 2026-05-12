import type { Server as HttpServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import type { Role } from "@belamonda/shared";
import { env } from "../../config/env.js";
import { verifyAccessToken } from "../auth/token.js";
import { chatStore } from "./chat.store.js";
import { notifyChatRelatedUsers } from "../notifications/notifications.service.chat.js";

let io: IOServer | null = null;

type AuthSocket = Socket & {
  data: { userId: string; role: Role; rateBucket: number[] };
};

const RATE_LIMIT_WINDOW_MS = 5_000;
const RATE_LIMIT_MAX_EVENTS = 20; // 20 messages / 5 seconds per socket

function rateLimitOk(s: AuthSocket) {
  const now = Date.now();
  s.data.rateBucket = (s.data.rateBucket ?? []).filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
  if (s.data.rateBucket.length >= RATE_LIMIT_MAX_EVENTS) return false;
  s.data.rateBucket.push(now);
  return true;
}

export function initChatSocket(httpServer: HttpServer) {
  const allowedOrigins =
    env.CLIENT_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ??
    (env.CLIENT_ORIGIN ? [env.CLIENT_ORIGIN] : []);

  io = new IOServer(httpServer, {
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (env.NODE_ENV !== "production") {
          if (/^https?:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
        }
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true
    },
    maxHttpBufferSize: 1024 * 64
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.headers.authorization === "string"
          ? socket.handshake.headers.authorization.replace(/^Bearer /, "")
          : undefined);
      if (!token) return next(new Error("UNAUTHORIZED"));
      const payload = verifyAccessToken(token);
      (socket as AuthSocket).data = { userId: payload.sub, role: payload.role, rateBucket: [] };
      return next();
    } catch {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (raw) => {
    const socket = raw as AuthSocket;
    socket.join(userRoom(socket.data.userId));

    socket.on("conversation:join", (payload: { conversationId: string }, ack?: (r: any) => void) => {
      const conv = chatStore.getConversation(payload?.conversationId);
      if (!conv) return ack?.({ ok: false, error: "NOT_FOUND" });
      if (socket.data.role !== "admin" && !chatStore.isParticipant(conv.id, socket.data.userId)) {
        return ack?.({ ok: false, error: "FORBIDDEN" });
      }
      socket.join(convRoom(conv.id));
      ack?.({ ok: true });
    });

    socket.on("conversation:leave", (payload: { conversationId: string }) => {
      if (payload?.conversationId) socket.leave(convRoom(payload.conversationId));
    });

    socket.on(
      "message:send",
      (
        payload: {
          conversationId: string;
          body?: string;
          attachments?: Array<{ id: string; url: string; filename: string; mimeType: string; sizeBytes: number }>;
        },
        ack?: (r: any) => void
      ) => {
        if (!rateLimitOk(socket)) return ack?.({ ok: false, error: "RATE_LIMITED" });
        const conv = chatStore.getConversation(payload?.conversationId);
        if (!conv) return ack?.({ ok: false, error: "NOT_FOUND" });
        if (socket.data.role === "admin") return ack?.({ ok: false, error: "ADMIN_READ_ONLY" });
        if (!chatStore.isParticipant(conv.id, socket.data.userId)) return ack?.({ ok: false, error: "FORBIDDEN" });
        const body = (payload.body ?? "").toString().slice(0, 4000).trim();
        const attachments = (payload.attachments ?? []).slice(0, 5);
        if (!body && attachments.length === 0) return ack?.({ ok: false, error: "EMPTY" });

        const msg = chatStore.addMessage({
          conversationId: conv.id,
          senderId: socket.data.userId,
          senderRole: socket.data.role,
          body,
          attachments
        });
        if (!msg) return ack?.({ ok: false, error: "SEND_FAILED" });

        emitToConversation(conv.id, "message:new", { conversationId: conv.id, message: msg });

        const recipients = conv.participants.map((p) => p.userId).filter((u) => u !== socket.data.userId);
        notifyChatRelatedUsers({
          userIds: recipients,
          kind: "chat_message",
          body: body || (attachments[0]?.filename ?? "Attachment"),
          payload: { conversationId: conv.id, messageId: msg.id }
        });
        ack?.({ ok: true, message: msg });
      }
    );

    socket.on("typing", (payload: { conversationId: string; isTyping: boolean }) => {
      const conv = chatStore.getConversation(payload?.conversationId);
      if (!conv) return;
      if (!chatStore.isParticipant(conv.id, socket.data.userId)) return;
      socket.to(convRoom(conv.id)).emit("typing", {
        conversationId: conv.id,
        userId: socket.data.userId,
        role: socket.data.role,
        isTyping: !!payload.isTyping
      });
    });

    socket.on("read", (payload: { conversationId: string; lastMessageId?: string }) => {
      const conv = chatStore.getConversation(payload?.conversationId);
      if (!conv) return;
      if (!chatStore.isParticipant(conv.id, socket.data.userId)) return;
      const cur = chatStore.markRead(conv.id, socket.data.userId, payload.lastMessageId);
      emitToConversation(conv.id, "read:update", {
        conversationId: conv.id,
        userId: socket.data.userId,
        lastReadMessageId: cur.lastReadMessageId,
        lastReadAt: cur.lastReadAt
      });
    });
  });

  return io;
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(convRoom(conversationId)).emit(event, payload);
  // Also emit to participants' user-rooms so unread badges update even without joining the conv room.
  const conv = chatStore.getConversation(conversationId);
  if (conv) {
    for (const p of conv.participants) {
      io.to(userRoom(p.userId)).emit("conversation:update", { conversationId });
    }
  }
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
}

function convRoom(id: string) {
  return `conv:${id}`;
}
function userRoom(id: string) {
  return `user:${id}`;
}
