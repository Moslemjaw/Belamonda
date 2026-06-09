import { notificationSettingsStore } from "./notifications.settings.store.js";
import { sendEmail, sendSms, sendWhatsApp, resolveUserEmail } from "../../services/email.service.js";

export type NotificationChannel = "in_app" | "email" | "sms" | "whatsapp";

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
    | "booking_rejected"
    | "booking_cancelled"
    | "booking_update"
    | "booking_under_review"
    | "booking_slot_proposed"
    | "booking_slot_accepted"
    | "session_reminder"
    | "session_completed_cashback"
    | "offer_expiring"
    | "payment_success"
    | "payment_failed"
    | "installment_paid"
    | "installment_due"
    | "deposit_reserved"
    | "deposit_expiring"
    | "deposit_expired"
    | "enet_approved"
    | "enet_rejected"
    | "form_signature_required"
    | "referral_first_purchase"
    | "cashback_update"
    | "new_offer_alert"
    | "membership_activated"
    | "membership_expiring"
    | "chat_message";
  title: string;
  body: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
};

export type OutboundMessageRecord = {
  id: string;
  userId: string;
  channel: Exclude<NotificationChannel, "in_app">;
  template: string;
  payload: Record<string, unknown>;
  createdAt: string;
  delivered?: boolean;
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
    if (!notificationSettingsStore.isEnabled(input.type, "in_app")) return null;

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
    if (!notificationSettingsStore.isEnabled(input.template, input.channel)) return null;

    const rec: OutboundMessageRecord = {
      id: randomId("out"),
      createdAt: nowIso(),
      delivered: false,
      ...input
    };
    const list = outboundByUser.get(input.userId) ?? [];
    list.unshift(rec);
    outboundByUser.set(input.userId, list);

    if (input.channel === "email") {
      resolveUserEmail(input.userId)
        .then((email) => {
          if (email) {
            const subjectMap: Record<string, string> = {
              payment_success: "Payment confirmed",
              payment_failed: "Payment failed — action required",
              booking_confirmed: "Booking confirmed",
              session_reminder: "Reminder: your session is tomorrow",
              installment_due: "Installment due soon",
              deposit_expiring: "Your reservation is expiring",
              offer_pending_payment: "Complete your payment to activate your offer",
              kyc_approved: "Your account is verified",
              kyc_rejected: "KYC verification — action required",
              form_signature_required: "Please sign your form",
              session_completed_cashback: "Session completed — cashback unlocked",
              booking_rejected: "Booking request update",
              membership_activated: "Welcome — your membership is active",
              membership_expiring: "Your membership is expiring soon",
              booking_slot_proposed: "New time slot proposed for your booking"
            };
            sendEmail({
              to: email,
              template: input.template,
              subject: subjectMap[input.template] ?? "Belamonda notification",
              payload: input.payload
            });
          }
        })
        .catch(() => {});
    } else if (input.channel === "sms") {
      sendSms({ to: input.userId, template: input.template, payload: input.payload });
    } else if (input.channel === "whatsapp") {
      sendWhatsApp({ to: input.userId, template: input.template, payload: input.payload });
    }

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
  },

  markAllRead(userId: string) {
    const list = inboxByUser.get(userId) ?? [];
    for (const n of list) n.read = true;
    inboxByUser.set(userId, list);
    return list;
  },

  hasUnreadFormSignature(userId: string, formId: string): boolean {
    const list = inboxByUser.get(userId) ?? [];
    const actionUrl = `/forms/fill/${formId}?return=/dashboard`;
    return list.some((n) => !n.read && n.type === "form_signature_required" && n.actionUrl === actionUrl);
  },

  unreadCount(userId: string): number {
    return (inboxByUser.get(userId) ?? []).filter((n) => !n.read).length;
  }
};
