export type NotifChannel = "in_app" | "email" | "sms" | "whatsapp";

export type NotifTypeSettings = {
  type: string;
  label: string;
  category: "payment" | "session" | "engagement" | "communication" | "system";
  channels: Record<NotifChannel, boolean>;
};

const DEFAULT_SETTINGS: NotifTypeSettings[] = [
  // ── Payment ────────────────────────────────────────────────────────────────
  { type: "offer_pending_payment",    label: "Offer pending payment (48 h hold)",       category: "payment",       channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "payment_confirmed",        label: "Payment confirmed / offer activated",      category: "payment",       channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "payment_success",          label: "Payment successful",                       category: "payment",       channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "payment_failed",           label: "Payment failed",                           category: "payment",       channels: { in_app: true,  email: false, sms: true,  whatsapp: false } },
  { type: "installment_paid",         label: "Installment paid",                         category: "payment",       channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "installment_due",          label: "Installment due reminder",                 category: "payment",       channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "deposit_reserved",         label: "Deposit received — offer reserved",        category: "payment",       channels: { in_app: true,  email: true,  sms: false, whatsapp: false } },
  { type: "deposit_expiring",         label: "Deposit reservation expiring soon",        category: "payment",       channels: { in_app: true,  email: false, sms: true,  whatsapp: false } },
  { type: "deposit_expired",          label: "Deposit reservation expired",              category: "payment",       channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "enet_approved",            label: "ENET plan approved",                       category: "payment",       channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "enet_rejected",            label: "ENET plan rejected",                       category: "payment",       channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  // ── Session / Booking ─────────────────────────────────────────────────────
  { type: "booking_confirmed",        label: "Booking confirmed",                        category: "session",       channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "booking_rejected",         label: "Booking rejected",                         category: "session",       channels: { in_app: true,  email: true,  sms: false, whatsapp: false } },
  { type: "booking_cancelled",        label: "Booking cancelled",                        category: "session",       channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "session_reminder",         label: "Session reminder (24 h before)",           category: "session",       channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "session_completed_cashback", label: "Session completed + cashback unlock",    category: "session",       channels: { in_app: true,  email: true,  sms: false, whatsapp: false } },
  // ── Engagement ────────────────────────────────────────────────────────────
  { type: "cashback_update",          label: "Cashback balance updated",                 category: "engagement",    channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "new_offer_alert",          label: "New matching offer available",             category: "engagement",    channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "membership_activated",     label: "Membership activated",                     category: "engagement",    channels: { in_app: true,  email: true,  sms: false, whatsapp: false } },
  { type: "membership_expiring",      label: "Membership expiring soon",                 category: "engagement",    channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "referral_first_purchase",  label: "Referral converted (first purchase)",      category: "engagement",    channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  // ── Communication ─────────────────────────────────────────────────────────
  { type: "chat_message",             label: "New chat message",                         category: "communication", channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "booking_slot_proposed",    label: "Booking time slot proposed",               category: "communication", channels: { in_app: true,  email: true,  sms: false, whatsapp: false } },
  { type: "booking_slot_accepted",    label: "Booking slot accepted by customer",        category: "communication", channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  { type: "booking_under_review",     label: "Booking request received (staff view)",    category: "communication", channels: { in_app: true,  email: false, sms: false, whatsapp: false } },
  // ── System ────────────────────────────────────────────────────────────────
  { type: "kyc_submitted",            label: "KYC submitted",                            category: "system",        channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "kyc_approved",             label: "KYC approved",                             category: "system",        channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "kyc_rejected",             label: "KYC rejected",                             category: "system",        channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
  { type: "form_signature_required",  label: "Form signature required",                  category: "system",        channels: { in_app: true,  email: true,  sms: true,  whatsapp: false } },
];

const settingsMap = new Map<string, NotifTypeSettings>(
  DEFAULT_SETTINGS.map((s) => [s.type, { ...s, channels: { ...s.channels } }])
);

export const notificationSettingsStore = {
  list(): NotifTypeSettings[] {
    return Array.from(settingsMap.values());
  },

  isEnabled(type: string, channel: NotifChannel): boolean {
    const entry = settingsMap.get(type);
    if (!entry) return true;
    return entry.channels[channel] ?? false;
  },

  upsert(updates: Array<{ type: string; channels: Partial<Record<NotifChannel, boolean>> }>) {
    for (const u of updates) {
      const existing = settingsMap.get(u.type);
      if (!existing) continue;
      settingsMap.set(u.type, {
        ...existing,
        channels: { ...existing.channels, ...u.channels }
      });
    }
    return this.list();
  }
};
