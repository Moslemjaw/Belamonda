import type { Role } from "@belamonda/shared";

export type ConversationKind = "booking" | "direct";

export type Participant = {
  userId: string;
  role: Role;
  joinedAt: string;
};

export type ConversationRecord = {
  id: string;
  kind: ConversationKind;
  bookingRequestId?: string;
  participants: Participant[];
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
};

export type AttachmentRef = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type MessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: Role;
  body: string;
  attachments: AttachmentRef[];
  systemKind?:
    | "booking_requested"
    | "slot_proposed"
    | "slot_accepted"
    | "booking_confirmed"
    | "booking_rejected"
    | "booking_cancelled";
  systemPayload?: Record<string, unknown>;
  createdAt: string;
};

export type ReadCursor = {
  conversationId: string;
  userId: string;
  lastReadMessageId?: string;
  lastReadAt: string;
};

function nowIso() {
  return new Date().toISOString();
}
function rid(p: string) {
  return `${p}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const conversations = new Map<string, ConversationRecord>();
const messages = new Map<string, MessageRecord[]>(); // conversationId -> messages (oldest first)
const cursors = new Map<string, ReadCursor>(); // key: convId|userId

function cursorKey(convId: string, userId: string) {
  return `${convId}|${userId}`;
}

export const chatStore = {
  // ── Conversations ─────────────────────────────
  createConversation(input: {
    kind: ConversationKind;
    title: string;
    participants: Participant[];
    bookingRequestId?: string;
  }): ConversationRecord {
    const id = rid("conv");
    const now = nowIso();
    const rec: ConversationRecord = {
      id,
      kind: input.kind,
      bookingRequestId: input.bookingRequestId,
      participants: input.participants,
      title: input.title,
      createdAt: now,
      updatedAt: now
    };
    conversations.set(id, rec);
    messages.set(id, []);
    return rec;
  },

  /**
   * Re-register a conversation with a known ID (e.g. rehydrating from DB
   * after a server restart wiped the in-memory store).  If the conversation
   * already exists in memory this is a no-op and returns the existing record.
   */
  restoreConversation(input: {
    id: string;
    kind: ConversationKind;
    title: string;
    participants: Participant[];
    bookingRequestId?: string;
  }): ConversationRecord {
    const existing = conversations.get(input.id);
    if (existing) return existing;
    const now = nowIso();
    const rec: ConversationRecord = {
      id: input.id,
      kind: input.kind,
      bookingRequestId: input.bookingRequestId,
      participants: input.participants,
      title: input.title,
      createdAt: now,
      updatedAt: now,
    };
    conversations.set(input.id, rec);
    messages.set(input.id, []);
    return rec;
  },

  getConversation(id: string) {
    return conversations.get(id) ?? null;
  },

  findConversationByBookingRequest(bookingRequestId: string) {
    for (const c of conversations.values()) {
      if (c.bookingRequestId === bookingRequestId) return c;
    }
    return null;
  },

  listConversationsForUser(userId: string) {
    const list = Array.from(conversations.values())
      .filter((c) => c.participants.some((p) => p.userId === userId))
      .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));
    return list.map((c) => ({
      ...c,
      unreadCount: chatStore.unreadCount(c.id, userId)
    }));
  },

  listAllConversations() {
    return Array.from(conversations.values()).sort((a, b) =>
      (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt)
    );
  },

  addParticipant(convId: string, p: Participant) {
    const c = conversations.get(convId);
    if (!c) return null;
    if (!c.participants.some((x) => x.userId === p.userId)) {
      c.participants.push(p);
      c.updatedAt = nowIso();
      conversations.set(convId, c);
    }
    return c;
  },

  isParticipant(convId: string, userId: string) {
    const c = conversations.get(convId);
    if (!c) return false;
    return c.participants.some((p) => p.userId === userId);
  },

  // ── Messages ──────────────────────────────────
  addMessage(input: {
    conversationId: string;
    senderId: string;
    senderRole: Role;
    body: string;
    attachments?: AttachmentRef[];
    systemKind?: MessageRecord["systemKind"];
    systemPayload?: Record<string, unknown>;
  }): MessageRecord | null {
    const c = conversations.get(input.conversationId);
    if (!c) return null;
    const rec: MessageRecord = {
      id: rid("msg"),
      conversationId: input.conversationId,
      senderId: input.senderId,
      senderRole: input.senderRole,
      body: input.body,
      attachments: input.attachments ?? [],
      systemKind: input.systemKind,
      systemPayload: input.systemPayload,
      createdAt: nowIso()
    };
    const list = messages.get(input.conversationId) ?? [];
    list.push(rec);
    messages.set(input.conversationId, list);
    c.lastMessagePreview = rec.body.slice(0, 120) || (rec.attachments[0]?.filename ?? "");
    c.lastMessageAt = rec.createdAt;
    c.updatedAt = rec.createdAt;
    conversations.set(c.id, c);
    return rec;
  },

  listMessages(convId: string, opts?: { before?: string; limit?: number }) {
    const list = messages.get(convId) ?? [];
    const limit = opts?.limit ?? 50;
    let filtered = list;
    if (opts?.before) {
      const idx = list.findIndex((m) => m.id === opts.before);
      filtered = idx > 0 ? list.slice(0, idx) : [];
    }
    const slice = filtered.slice(Math.max(0, filtered.length - limit));
    const hasMore = filtered.length > slice.length;
    return { items: slice, hasMore };
  },

  // ── Read receipts ─────────────────────────────
  markRead(convId: string, userId: string, lastMessageId?: string) {
    const cur: ReadCursor = {
      conversationId: convId,
      userId,
      lastReadMessageId: lastMessageId,
      lastReadAt: nowIso()
    };
    cursors.set(cursorKey(convId, userId), cur);
    return cur;
  },

  getCursor(convId: string, userId: string) {
    return cursors.get(cursorKey(convId, userId)) ?? null;
  },

  unreadCount(convId: string, userId: string) {
    const cur = cursors.get(cursorKey(convId, userId));
    const list = messages.get(convId) ?? [];
    if (!cur) return list.filter((m) => m.senderId !== userId).length;
    let count = 0;
    let passed = !cur.lastReadMessageId;
    for (const m of list) {
      if (passed && m.senderId !== userId) count++;
      if (!passed && m.id === cur.lastReadMessageId) passed = true;
    }
    return count;
  }
};
