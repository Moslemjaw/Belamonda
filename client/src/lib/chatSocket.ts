import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getChatSocket(token: string): Socket {
  if (socket && currentToken === token && socket.connected) return socket;
  if (socket) {
    try {
      socket.disconnect();
    } catch {
      /* ignore */
    }
  }
  currentToken = token;
  socket = io(API_BASE_URL, {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
    reconnection: true
  });
  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch {
      /* ignore */
    }
    socket = null;
    currentToken = null;
  }
}

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  body: string;
  attachments: Array<{ id: string; url: string; filename: string; mimeType: string; sizeBytes: number }>;
  systemKind?: string;
  systemPayload?: Record<string, unknown>;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  kind: "booking" | "direct";
  bookingRequestId?: string;
  participants: Array<{ userId: string; role: string; joinedAt: string }>;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

export type BookingRequest = {
  id: string;
  userOfferId: string;
  userId: string;
  offerId: string;
  clinicId: string;
  status: "request_received" | "slot_assigned" | "scheduled" | "checked_in" | "in_progress" | "completed" | "no_show" | "cancelled" | "rescheduled";
  preferredAt?: string;
  proposedAt?: string;
  proposedBy?: string;
  acceptedAt?: string;
  confirmedAt?: string;
  scheduledSessionId?: string;
  rejectionReason?: string;
  notes?: string;
  conversationId?: string;
  clinicNameEn?: string;
  clinicNameAr?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  updatedAt: string;
};
