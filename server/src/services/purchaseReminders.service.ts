import { UserOfferModel } from "../models/userOffer.model.js";
import { OfferModel } from "../models/offer.model.js";
import { sessionsStore } from "../modules/scheduling/sessions.store.js";
import {
  notifyDepositExpiring,
  notifyDepositExpired,
  notifyInstallmentDue,
  notifySessionReminder,
  notifyMembershipExpiring
} from "../modules/notifications/notifications.service.js";

const ONE_DAY = 24 * 60 * 60 * 1000;
const THREE_DAYS = 3 * ONE_DAY;
const REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12h dedupe window
let timer: ReturnType<typeof setInterval> | null = null;

// In-memory dedupe set for session reminders: "sessionId::YYYY-MM-DD"
const sessionReminderSent = new Set<string>();

type DateLike = Date | string | number | null | undefined;
function shouldRemind(lastSentAt: DateLike, now: Date): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - new Date(lastSentAt).getTime() >= REMINDER_COOLDOWN_MS;
}
function toIsoOrEmpty(v: DateLike): string {
  if (!v) return new Date().toISOString();
  return new Date(v).toISOString();
}

async function tick() {
  const now = new Date();
  const in24h = new Date(now.getTime() + ONE_DAY);

  // 1) Deposit reservations expiring within 24h → remind (deduped)
  try {
    const expiring = await UserOfferModel.find({
      status: "reserved",
      reservationExpiresAt: { $gte: now, $lte: in24h }
    })
      .select("_id userId reservationExpiresAt lastDepositReminderAt")
      .lean();
    for (const uo of expiring) {
      if (!shouldRemind(uo.lastDepositReminderAt, now)) continue;
      notifyDepositExpiring(
        uo.userId,
        String(uo._id),
        toIsoOrEmpty(uo.reservationExpiresAt)
      );
      await UserOfferModel.updateOne(
        { _id: uo._id },
        { $set: { lastDepositReminderAt: now } }
      );
    }
  } catch (e) {
    console.warn("[purchaseReminders] deposit-expiring tick failed", e);
  }

  // 2) Auto-cancel reservations whose expiry has passed
  try {
    const expired = await UserOfferModel.find({
      status: "reserved",
      reservationExpiresAt: { $lt: now }
    })
      .select("_id userId")
      .lean();
    if (expired.length) {
      await UserOfferModel.updateMany(
        { _id: { $in: expired.map((e) => e._id) }, status: "reserved" },
        { $set: { status: "expired" } }
      );
      for (const uo of expired) {
        notifyDepositExpired(uo.userId, String(uo._id));
      }
    }
  } catch (e) {
    console.warn("[purchaseReminders] reservation auto-cancel failed", e);
  }

  // 3) Installment due within 24h → remind (deduped)
  try {
    const due = await UserOfferModel.find({
      status: "active",
      purchaseMode: "installments",
      nextInstallmentDueAt: { $gte: now, $lte: in24h }
    })
      .select("_id userId installmentsPaid installmentCount nextInstallmentDueAt lastInstallmentReminderAt")
      .lean();
    for (const uo of due) {
      if (!shouldRemind(uo.lastInstallmentReminderAt, now)) continue;
      notifyInstallmentDue(
        uo.userId,
        String(uo._id),
        (uo.installmentsPaid ?? 0) + 1,
        uo.installmentCount ?? 0,
        toIsoOrEmpty(uo.nextInstallmentDueAt)
      );
      await UserOfferModel.updateOne(
        { _id: uo._id },
        { $set: { lastInstallmentReminderAt: now } }
      );
    }
  } catch (e) {
    console.warn("[purchaseReminders] installment-due tick failed", e);
  }

  // 4) Session reminders — fire once per session per day (deduped via in-memory set)
  try {
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const upcoming = await sessionsStore.listScheduledBetween(windowStart, windowEnd);
    const today = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    for (const sess of upcoming) {
      const key = `${sess.id}::${today}`;
      if (sessionReminderSent.has(key)) continue;
      sessionReminderSent.add(key);
      notifySessionReminder(sess.userId, sess.id, sess.scheduledAt);
    }
  } catch (e) {
    console.warn("[purchaseReminders] session-reminder tick failed", e);
  }

  // 5) Membership expiring within 3 days → remind (deduped)
  try {
    const in3days = new Date(now.getTime() + THREE_DAYS);
    const expiring = await UserOfferModel.find({
      status: "active",
      expiresAt: { $gte: now, $lte: in3days }
    })
      .select("_id userId offerId expiresAt lastMembershipExpiryReminderAt")
      .lean();

    for (const uo of expiring) {
      if (!shouldRemind((uo as { lastMembershipExpiryReminderAt?: Date }).lastMembershipExpiryReminderAt, now)) continue;

      let offerName = "your offer";
      try {
        const offer = await OfferModel.findById(uo.offerId).select("name").lean() as { name?: string } | null;
        if (offer?.name) offerName = offer.name;
      } catch (_) {}

      notifyMembershipExpiring(uo.userId, String(uo._id), offerName, toIsoOrEmpty(uo.expiresAt));

      await UserOfferModel.updateOne(
        { _id: uo._id },
        { $set: { lastMembershipExpiryReminderAt: now } }
      );
    }
  } catch (e) {
    console.warn("[purchaseReminders] membership-expiring tick failed", e);
  }
}

export function startPurchaseReminders() {
  if (timer) return;
  // Run frequently in dev so reminders surface promptly. Real prod should cron this.
  timer = setInterval(() => {
    tick().catch(() => {});
  }, 60 * 1000);
  // Kick off immediately so notifications appear shortly after server start.
  tick().catch(() => {});
}

export function stopPurchaseReminders() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
