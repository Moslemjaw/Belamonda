import type { Role } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

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
    | "booking_cancelled"
    | "booking_reverted";
  systemPayload?: Record<string, unknown>;
  createdAt: string;
};

export type ReadCursor = {
  conversationId: string;
  userId: string;
  lastReadMessageId?: string;
  lastReadAt: string;
};

// ── Storage ──────────────────────────────────────────────────────────────────
// Chat used to live only in server memory, so every restart/deploy lost all messages
// and direct conversations, and two server instances each saw a different chat.
// Everything is now in MongoDB; records keep exactly the shapes above.

const ConversationSchema = new Schema(
  {
    _id: { type: String },
    kind: { type: String, required: true },
    bookingRequestId: { type: String, index: true },
    participants: { type: [{ _id: false, userId: String, role: String, joinedAt: String }], default: [] },
    title: { type: String, default: "" },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    lastMessagePreview: { type: String },
    lastMessageAt: { type: String }
  },
  { versionKey: false, timestamps: false }
);
ConversationSchema.index({ "participants.userId": 1 });

const MessageSchema = new Schema(
  {
    _id: { type: String },
    conversationId: { type: String, required: true },
    seq: { type: Number, required: true }, // insertion order (createdAt can tie)
    senderId: { type: String, required: true },
    senderRole: { type: String, required: true },
    body: { type: String, default: "" },
    attachments: { type: [Schema.Types.Mixed], default: [] },
    systemKind: { type: String },
    systemPayload: { type: Schema.Types.Mixed },
    createdAt: { type: String, required: true }
  },
  { versionKey: false, timestamps: false, minimize: false }
);
MessageSchema.index({ conversationId: 1, seq: 1 });

const CursorSchema = new Schema(
  {
    _id: { type: String }, // convId|userId
    conversationId: { type: String, required: true },
    userId: { type: String, required: true },
    lastReadMessageId: { type: String },
    lastReadAt: { type: String, required: true }
  },
  { versionKey: false, timestamps: false }
);

const ConversationModel = mongoose.models.ChatConversation ?? mongoose.model("ChatConversation", ConversationSchema, "chat_conversations");
const MessageModel = mongoose.models.ChatMessage ?? mongoose.model("ChatMessage", MessageSchema, "chat_messages");
const CursorModel = mongoose.models.ChatCursor ?? mongoose.model("ChatCursor", CursorSchema, "chat_cursors");

function nowIso() {
  return new Date().toISOString();
}
function rid(p: string) {
  return `${p}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
let lastSeq = 0;
function nextSeq() {
  lastSeq = Math.max(Date.now() * 1000, lastSeq + 1);
  return lastSeq;
}
function cursorKey(convId: string, userId: string) {
  return `${convId}|${userId}`;
}

function toConversation(d: any): ConversationRecord {
  const rec: ConversationRecord = {
    id: d._id,
    kind: d.kind,
    participants: (d.participants ?? []).map((p: any) => ({ userId: p.userId, role: p.role, joinedAt: p.joinedAt })),
    title: d.title,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt
  };
  if (d.bookingRequestId !== undefined && d.bookingRequestId !== null) rec.bookingRequestId = d.bookingRequestId;
  if (d.lastMessagePreview !== undefined && d.lastMessagePreview !== null) rec.lastMessagePreview = d.lastMessagePreview;
  if (d.lastMessageAt !== undefined && d.lastMessageAt !== null) rec.lastMessageAt = d.lastMessageAt;
  return rec;
}

function toMessage(d: any): MessageRecord {
  const rec: MessageRecord = {
    id: d._id,
    conversationId: d.conversationId,
    senderId: d.senderId,
    senderRole: d.senderRole,
    body: d.body ?? "",
    attachments: d.attachments ?? [],
    createdAt: d.createdAt
  };
  if (d.systemKind) rec.systemKind = d.systemKind;
  if (d.systemPayload !== undefined && d.systemPayload !== null) rec.systemPayload = d.systemPayload;
  return rec;
}

function toCursor(d: any): ReadCursor {
  const rec: ReadCursor = { conversationId: d.conversationId, userId: d.userId, lastReadAt: d.lastReadAt };
  if (d.lastReadMessageId) rec.lastReadMessageId = d.lastReadMessageId;
  return rec;
}

const byRecent = (a: ConversationRecord, b: ConversationRecord) =>
  (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt);

export const chatStore = {
  // ── Conversations ─────────────────────────────
  /** Id for a conversation about to be created (lets callers link to it in parallel). */
  newConversationId() {
    return rid("conv");
  },

  async createConversation(input: {
    id?: string;
    kind: ConversationKind;
    title: string;
    participants: Participant[];
    bookingRequestId?: string;
  }): Promise<ConversationRecord> {
    const now = nowIso();
    const doc = await ConversationModel.create({
      _id: input.id ?? rid("conv"),
      kind: input.kind,
      bookingRequestId: input.bookingRequestId,
      participants: input.participants,
      title: input.title,
      createdAt: now,
      updatedAt: now
    });
    return toConversation(doc.toObject());
  },

  /**
   * Register a conversation with a known ID (a booking request already points at it).
   * If it already exists this is a no-op and returns the existing record.
   */
  async restoreConversation(input: {
    id: string;
    kind: ConversationKind;
    title: string;
    participants: Participant[];
    bookingRequestId?: string;
  }): Promise<ConversationRecord> {
    const now = nowIso();
    const doc = await ConversationModel.findOneAndUpdate(
      { _id: input.id },
      {
        $setOnInsert: {
          kind: input.kind,
          bookingRequestId: input.bookingRequestId,
          participants: input.participants,
          title: input.title,
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true, new: true }
    ).lean();
    return toConversation(doc);
  },

  async getConversation(id: string): Promise<ConversationRecord | null> {
    const d = await ConversationModel.findById(id).lean();
    return d ? toConversation(d) : null;
  },

  async findConversationByBookingRequest(bookingRequestId: string): Promise<ConversationRecord | null> {
    const d = await ConversationModel.findOne({ bookingRequestId }).lean();
    return d ? toConversation(d) : null;
  },

  async listConversationsForUser(userId: string) {
    const docs = await ConversationModel.find({ "participants.userId": userId }).lean();
    const list = docs.map(toConversation).sort(byRecent);
    const out: Array<ConversationRecord & { unreadCount: number }> = [];
    for (const c of list) out.push({ ...c, unreadCount: await chatStore.unreadCount(c.id, userId) });
    return out;
  },

  async listAllConversations(): Promise<ConversationRecord[]> {
    const docs = await ConversationModel.find({}).lean();
    return docs.map(toConversation).sort(byRecent);
  },

  async addParticipant(convId: string, p: Participant): Promise<ConversationRecord | null> {
    await ConversationModel.updateOne(
      { _id: convId, "participants.userId": { $ne: p.userId } },
      { $push: { participants: p }, $set: { updatedAt: nowIso() } }
    );
    return chatStore.getConversation(convId);
  },

  async isParticipant(convId: string, userId: string): Promise<boolean> {
    return !!(await ConversationModel.exists({ _id: convId, "participants.userId": userId }));
  },

  // ── Messages ──────────────────────────────────
  async addMessage(input: {
    conversationId: string;
    senderId: string;
    senderRole: Role;
    body: string;
    attachments?: AttachmentRef[];
    systemKind?: MessageRecord["systemKind"];
    systemPayload?: Record<string, unknown>;
  }): Promise<MessageRecord | null> {
    const createdAt = nowIso();
    const attachments = input.attachments ?? [];
    const id = rid("msg");
    // One round trip instead of three: insert the message and update the conversation together;
    // the update's match count says whether the conversation exists.
    const [conv, doc] = await Promise.all([
      ConversationModel.updateOne(
        { _id: input.conversationId },
        {
          $set: {
            lastMessagePreview: input.body.slice(0, 120) || (attachments[0]?.filename ?? ""),
            lastMessageAt: createdAt,
            updatedAt: createdAt
          }
        }
      ),
      MessageModel.create({
        _id: id,
        conversationId: input.conversationId,
        seq: nextSeq(),
        senderId: input.senderId,
        senderRole: input.senderRole,
        body: input.body,
        attachments,
        systemKind: input.systemKind,
        systemPayload: input.systemPayload,
        createdAt
      })
    ]);
    if (conv.matchedCount === 0) {
      // No such conversation: undo the insert, as if it had never been accepted
      await MessageModel.deleteOne({ _id: id });
      return null;
    }
    return toMessage(doc.toObject());
  },

  async listMessages(convId: string, opts?: { before?: string; limit?: number }) {
    const limit = opts?.limit ?? 50;
    const filter: Record<string, unknown> = { conversationId: convId };
    if (opts?.before) {
      const pivot = await MessageModel.findOne({ _id: opts.before, conversationId: convId }).select("seq").lean<{ seq: number } | null>();
      // Unknown "before" id, or the very first message: nothing older (as before)
      if (!pivot) return { items: [], hasMore: false };
      filter.seq = { $lt: pivot.seq };
    }
    const newestFirst = await MessageModel.find(filter).sort({ seq: -1 }).limit(limit + 1).lean();
    const hasMore = newestFirst.length > limit;
    const items = newestFirst.slice(0, limit).reverse().map(toMessage);
    return { items, hasMore };
  },

  // ── Read receipts ─────────────────────────────
  async markRead(convId: string, userId: string, lastMessageId?: string): Promise<ReadCursor> {
    const cur: ReadCursor = { conversationId: convId, userId, lastReadMessageId: lastMessageId, lastReadAt: nowIso() };
    await CursorModel.replaceOne({ _id: cursorKey(convId, userId) }, { _id: cursorKey(convId, userId), ...cur }, { upsert: true });
    return cur;
  },

  async getCursor(convId: string, userId: string): Promise<ReadCursor | null> {
    const d = await CursorModel.findById(cursorKey(convId, userId)).lean();
    return d ? toCursor(d) : null;
  },

  async unreadCount(convId: string, userId: string): Promise<number> {
    const cur = await CursorModel.findById(cursorKey(convId, userId)).lean<{ lastReadMessageId?: string } | null>();
    const others = { conversationId: convId, senderId: { $ne: userId } };
    if (!cur || !cur.lastReadMessageId) return MessageModel.countDocuments(others);
    const pivot = await MessageModel.findOne({ _id: cur.lastReadMessageId, conversationId: convId }).select("seq").lean<{ seq: number } | null>();
    if (!pivot) return 0; // cursor points at a message we don't have: nothing counted (as before)
    return MessageModel.countDocuments({ ...others, seq: { $gt: pivot.seq } });
  }
};
