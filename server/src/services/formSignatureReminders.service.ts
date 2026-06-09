import mongoose from "mongoose";
import { EFormModel, EFormSubmissionModel } from "../models/eform.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { FormReminderLogModel } from "../models/formReminderLog.model.js";
import { notifyFormSignatureReminderSms } from "../modules/notifications/notifications.service.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = ONE_DAY_MS; // 24h between SMS reminders per user+form

// ─── Atomic DB-backed deduplication ─────────────────────────────────────────
//
// A single findOneAndUpdate with upsert provides atomic claim-or-skip semantics:
//
// Case A — no record exists: upsert inserts a new document → return true (send).
// Case B — record exists with sentAt ≤ cooldown cutoff: filter matches, document
//          is updated in place → return true (send).
// Case C — record exists with sentAt > cooldown cutoff: filter doesn't match,
//          upsert tries to insert a second document which violates the unique
//          index on {userId, formId} → MongoDB throws E11000 → return false (skip).
//
// This removes the read-then-write window that allowed concurrent duplicate sends.

async function claimSendSlot(
  userId: string,
  formId: string,
  formVersion: number,
  now: Date
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - COOLDOWN_MS);
  try {
    await FormReminderLogModel.findOneAndUpdate(
      {
        userId,
        formId: new mongoose.Types.ObjectId(formId),
        sentAt: { $not: { $gt: cutoff } }
      },
      { $set: { formVersion, sentAt: now } },
      { upsert: true }
    );
    return true;
  } catch (e: any) {
    if (e?.code === 11000) return false;
    throw e;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** IDs of users who have already submitted the given form at its current version. */
async function getSignedUserIds(formId: mongoose.Types.ObjectId, formVersion: number, userIds: string[]): Promise<Set<string>> {
  const subs = await EFormSubmissionModel.find({
    formId,
    formVersion,
    userId: { $in: userIds }
  })
    .select("userId")
    .lean<{ userId: string }[]>();
  return new Set(subs.map((s) => s.userId));
}

/** Atomically claim the send slot, then dispatch SMS if the claim succeeded. */
async function maybeSend(userId: string, formId: string, formVersion: number, formTitle: string, now: Date): Promise<void> {
  try {
    const claimed = await claimSendSlot(userId, formId, formVersion, now);
    if (!claimed) return;
    notifyFormSignatureReminderSms(userId, formId, formTitle);
  } catch (e) {
    console.warn(`[formSignatureReminders] failed for user=${userId} form=${formId}:`, e);
  }
}

// ─── Tick: requireBeforeFirstPayment ─────────────────────────────────────────
//
// Targets customers whose pending_payment offer expires in the next 24–48 hours
// and who haven't signed a form that's required before their first payment.
// Using pendingExpiresAt as the canonical "payment gate deadline" field.

async function tickPaymentGate(now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() + ONE_DAY_MS);    // 24h from now
  const windowEnd   = new Date(now.getTime() + 2 * ONE_DAY_MS); // 48h from now

  // 1. Find pending-payment offers whose deadline falls in the 24–48h window.
  const pendingOffers = await UserOfferModel.find({
    status: "pending_payment",
    pendingExpiresAt: { $gte: windowStart, $lte: windowEnd }
  })
    .select("userId offerId")
    .lean<{ userId: string; offerId: mongoose.Types.ObjectId }[]>();

  if (!pendingOffers.length) return;

  const offerToUsers = new Map<string, Set<string>>();
  for (const uo of pendingOffers) {
    const oid = String(uo.offerId);
    if (!offerToUsers.has(oid)) offerToUsers.set(oid, new Set());
    offerToUsers.get(oid)!.add(uo.userId);
  }

  const offerIds = Array.from(offerToUsers.keys()).filter((id) => mongoose.isValidObjectId(id));
  if (!offerIds.length) return;

  // 2. Forms that are required before first payment and linked to those offers.
  const forms = await EFormModel.find({
    archived: { $ne: true },
    requireBeforeFirstPayment: true,
    "targets.kind": "offer",
    "targets.refId": { $in: offerIds }
  })
    .select("_id title version targets")
    .lean<{ _id: mongoose.Types.ObjectId; title: string; version: number; targets: { kind: string; refId: string }[] }[]>();

  for (const form of forms) {
    const formId = String(form._id);
    const linkedOfferIds = form.targets.filter((t) => t.kind === "offer").map((t) => t.refId);

    const candidateUsers = new Set<string>();
    for (const oid of linkedOfferIds) {
      offerToUsers.get(oid)?.forEach((u) => candidateUsers.add(u));
    }
    if (!candidateUsers.size) continue;

    const signed = await getSignedUserIds(form._id, form.version, Array.from(candidateUsers));

    for (const userId of candidateUsers) {
      if (signed.has(userId)) continue;
      await maybeSend(userId, formId, form.version, form.title, now);
    }
  }
}

// ─── Tick: requireBeforeBooking ───────────────────────────────────────────────
//
// Targets customers who have a session scheduled in the next 24–48 hours and
// haven't signed a form that's required before booking.

async function tickBookingGate(now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() + ONE_DAY_MS);   // 24h from now
  const windowEnd   = new Date(now.getTime() + 2 * ONE_DAY_MS); // 48h from now

  // 1. Find sessions scheduled in the 24–48h window.
  const upcomingSessions = await BookingSessionModel.find({
    status: "scheduled",
    scheduledAt: { $gte: windowStart, $lte: windowEnd }
  })
    .select("userId offerId")
    .lean<{ userId: string; offerId: mongoose.Types.ObjectId }[]>();

  if (!upcomingSessions.length) return;

  const offerToUsers = new Map<string, Set<string>>();
  for (const s of upcomingSessions) {
    const oid = String(s.offerId);
    if (!offerToUsers.has(oid)) offerToUsers.set(oid, new Set());
    offerToUsers.get(oid)!.add(s.userId);
  }

  const offerIds = Array.from(offerToUsers.keys()).filter((id) => mongoose.isValidObjectId(id));
  if (!offerIds.length) return;

  // 2. Forms required before booking linked to those offers.
  const forms = await EFormModel.find({
    archived: { $ne: true },
    requireBeforeBooking: true,
    "targets.kind": "offer",
    "targets.refId": { $in: offerIds }
  })
    .select("_id title version targets")
    .lean<{ _id: mongoose.Types.ObjectId; title: string; version: number; targets: { kind: string; refId: string }[] }[]>();

  for (const form of forms) {
    const formId = String(form._id);
    const linkedOfferIds = form.targets.filter((t) => t.kind === "offer").map((t) => t.refId);

    const candidateUsers = new Set<string>();
    for (const oid of linkedOfferIds) {
      offerToUsers.get(oid)?.forEach((u) => candidateUsers.add(u));
    }
    if (!candidateUsers.size) continue;

    const signed = await getSignedUserIds(form._id, form.version, Array.from(candidateUsers));

    for (const userId of candidateUsers) {
      if (signed.has(userId)) continue;
      await maybeSend(userId, formId, form.version, form.title, now);
    }
  }
}

// ─── Main tick ───────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const now = new Date();
  await Promise.allSettled([tickPaymentGate(now), tickBookingGate(now)]);
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;

/** Start the form-signature SMS reminder background job. Safe to call multiple times. */
export function startFormSignatureReminders(): void {
  if (timer) return;
  // Check every hour — well within the 24h cooldown window.
  timer = setInterval(() => { tick().catch(() => {}); }, 60 * 60 * 1000);
  // Fire once at startup so reminders are sent shortly after boot.
  tick().catch(() => {});
}

/** Stop the background job (used in tests or clean shutdown). */
export function stopFormSignatureReminders(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
