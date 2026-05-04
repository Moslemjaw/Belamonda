export type NotificationChannel = "in_app" | "email" | "sms";

export type NotificationRecord = {
  id: string;
  userId: string;
  type:
    | "registration_success"
    | "kyc_submitted"
    | "kyc_approved"
    | "kyc_rejected"
    | "offer_pending_payment"
    | "payment_confirmed"
    | "booking_confirmed"
    | "session_reminder"
    | "session_completed_cashback"
    | "offer_expiring";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type OutboundMessageRecord = {
  id: string;
  userId: string;
  channel: Exclude<NotificationChannel, "in_app">; // email|sms
  template: NotificationRecord["type"];
  payload: Record<string, unknown>;
  createdAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const inboxByUser = new Map<string, NotificationRecord[]>();
const outboundByUser = new Map<string, OutboundMessageRecord[]>();

export const notificationsStore = {
  pushInApp(input: Omit<NotificationRecord, "id" | "read" | "createdAt">) {
    const rec: NotificationRecord = {
      id: randomId("notif"),
      read: false,
      createdAt: nowIso(),
      ...input
    };
    const list = inboxByUser.get(input.userId) ?? [];
    list.unshift(rec);
    inboxByUser.set(input.userId, list);
    return rec;
  },

  pushOutbound(input: Omit<OutboundMessageRecord, "id" | "createdAt">) {
    const rec: OutboundMessageRecord = {
      id: randomId("out"),
      createdAt: nowIso(),
      ...input
    };
    const list = outboundByUser.get(input.userId) ?? [];
    list.unshift(rec);
    outboundByUser.set(input.userId, list);
    return rec;
  },

  listInbox(userId: string) {
    return inboxByUser.get(userId) ?? [];
  },

  listOutbound(userId: string) {
    return outboundByUser.get(userId) ?? [];
  },

  markRead(userId: string, ids: string[]) {
    const list = inboxByUser.get(userId) ?? [];
    const set = new Set(ids);
    for (const n of list) {
      if (set.has(n.id)) n.read = true;
    }
    inboxByUser.set(userId, list);
    return list;
  }
};

