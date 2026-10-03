// Shared schemas, loaders and helpers for the scheduling routes.
import { kwDate } from "../../utils/kwDate.js";
import mongoose from "mongoose";
import { z } from "zod";
import { commerceStore, type UserOfferRecord } from "../commerce/commerce.store.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { offersStore } from "../offers/offers.store.js";
import { sessionsStore } from "./sessions.store.js";
import { bookingRequestsStore } from "./bookingRequests.store.js";
import { chatStore } from "../chat/chat.store.js";
import { emitToConversation } from "../chat/chat.socket.js";
import { UserModel } from "../../models/user.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserOfferModel, type UserOfferDoc } from "../../models/userOffer.model.js";
import { OfferModel, type OfferDoc } from "../../models/offer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { logAuditAction } from "../../services/audit.service.js";

export const RequestSchema = z.object({
  userOfferId: z.string().min(1),
  preferredAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  clinicId: z.string().optional(),
  isStandalone: z.boolean().optional(),
  schedulingMode: z.enum(["belamonda_cs", "clinic_handles"]).optional(),
  standaloneName: z.string().optional(),
  standalonePrice: z.union([z.string(), z.number()]).optional(),
  sessionGrossKwd: z.string().optional(),
  cashbackAppliedKwd: z.string().optional()
});

export const ScheduleSchema = z.object({
  userOfferId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  forceOverride: z.boolean().optional()
});

export const ProposeSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  forceOverride: z.boolean().optional()
});

export const RejectSchema = z.object({ reason: z.string().min(1).max(500) });
export const CancelSchema = z.object({ reason: z.string().max(500).optional() });

/**
 * Clinic POS amounts: non-negative KWD with up to 3 decimals ("3", "3.5", "3.500").
 * A negative deduction used to credit the customer's wallet; a negative price lowered the bill.
 */
export const PosKwd = z.string().trim().regex(/^\d{1,7}(\.\d{1,3})?$/, "INVALID_AMOUNT");
export const PosExtraItems = z.array(z.object({ name: z.string(), priceKwd: PosKwd, qty: z.number().int().positive() }));

export const MarkSchema = z.object({
  status: z.enum(["completed", "no_show", "cancelled"]),
  notes: z.string().optional(),
  extraItems: PosExtraItems.optional(),
  cashbackToDeductKwd: PosKwd.optional()
});

// ── Mongo/legacy-aware loaders (from Task #2) ─────────────────────────────
export type SchedUO = {
  id: string;
  userId: string;
  offerId: string;
  clinicId: string;
  status: string;
  sessionsUsed: number;
  activatedAt?: string;
  expiresAt?: string;
  purchaseMode?: string;
  installmentCount?: number;
  installmentsPaid?: number;
  reservationExpiresAt?: string;
  membershipType?: "cashback" | "free_sessions" | "group";
  cashbackBalanceKwd?: string;
  sharedWith?: string[];
};

export async function loadUserOffer(id: string): Promise<SchedUO | null> {
  if (mongoose.isValidObjectId(id)) {
    const doc = await UserOfferModel.findById(id).lean<UserOfferDoc | null>();
    if (doc) {
      return {
        id: String(doc._id),
        userId: String(doc.userId),
        offerId: String(doc.offerId),
        clinicId: String(doc.clinicId),
        status: doc.status,
        sessionsUsed: doc.sessionsUsed ?? 0,
        activatedAt: doc.activatedAt ? new Date(doc.activatedAt).toISOString() : undefined,
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : undefined,
        purchaseMode: doc.purchaseMode ?? undefined,
        installmentCount: doc.installmentCount ?? undefined,
        installmentsPaid: doc.installmentsPaid ?? undefined,
        reservationExpiresAt: doc.reservationExpiresAt
          ? new Date(doc.reservationExpiresAt).toISOString()
          : undefined,
        membershipType: doc.membershipType as any,
        cashbackBalanceKwd: doc.cashbackBalanceKwd ?? undefined,
        sharedWith: doc.sharedWith
      };
    }
  }
  const legacy = commerceStore.get(id);
  if (!legacy) return null;
  return { ...legacy, purchaseMode: undefined, installmentCount: undefined, installmentsPaid: undefined };
}

export type SchedOffer = {
  id: string;
  name?: string;
  maxSessions: number | null;
  sessionIntervalDays: number;
  cashbackPerSessionKwd?: string;
  validityDays?: number;
  payPerSession: boolean;
  sessionPriceKwd?: string;
  branchSessionPrices: { clinicId: string; sessionPriceKwd: string }[];
  allowExtraPaidSessions: boolean;
  extraSessionPriceKwd?: string;
  branchExtraSessionPrices: { clinicId: string; priceKwd: string }[];
  bookingFlow?: "admin_forward" | "direct_clinic";
};

/**
 * Resolve the session fee for a specific branch.
 * Precedence: branch-level override → offer-level default.
 * Returns undefined when payPerSession is true but no price is configured.
 */
export function resolveSessionPrice(offer: SchedOffer, clinicId: string, isExtraSession: boolean = false): string | undefined {
  if (isExtraSession) {
    const override = offer.branchExtraSessionPrices.find((b) => b.clinicId === clinicId);
    if (override) return override.priceKwd;
    return offer.extraSessionPriceKwd;
  }
  const override = offer.branchSessionPrices.find((b) => b.clinicId === clinicId);
  if (override) return override.sessionPriceKwd;
  if (offer.payPerSession) return offer.sessionPriceKwd;
  return undefined;
}

export function mapOfferDocToSched(o: OfferDoc): SchedOffer {
  const overrides = (o.branchSessionPrices ?? []).map((b: { clinicId: unknown; sessionPriceKwd: unknown }) => ({
    clinicId: String(b.clinicId),
    sessionPriceKwd: String(b.sessionPriceKwd),
  }));
  return {
    id: String(o._id),
    name: (o as { name?: string }).name ?? undefined,
    maxSessions: o.maxSessions ?? null,
    sessionIntervalDays: o.sessionIntervalDays ?? 0,
    cashbackPerSessionKwd: o.cashbackPerSessionKwd ?? undefined,
    validityDays: o.validityDays,
    payPerSession: o.payPerSession ?? false,
    sessionPriceKwd: o.sessionPriceKwd ?? undefined,
    branchSessionPrices: overrides,
    allowExtraPaidSessions: o.allowExtraPaidSessions ?? false,
    extraSessionPriceKwd: o.extraSessionPriceKwd ?? undefined,
    branchExtraSessionPrices: (o.branchExtraSessionPrices ?? []).map((b: any) => ({
      clinicId: String(b.clinicId),
      priceKwd: String(b.priceKwd)
    })),
    bookingFlow: (o as any).bookingFlow ?? "admin_forward"
  };
}

/** Session list price, cashback applied, and cash the clinic should collect. */
export function computeBookingRequestFinancials(
  breq: {
    sessionPriceKwd?: string;
    cashbackDeductedKwd?: string;
    clinicId: string;
    membershipType?: string;
    hadCashback?: boolean;
    isStandalone?: boolean;
  },
  offer: SchedOffer | null
) {
  const storedPrice = parseFloat(breq.sessionPriceKwd ?? "0") || 0;
  const storedCashback = parseFloat(breq.cashbackDeductedKwd ?? "0") || 0;
  const listFromOffer = offer ? parseFloat(resolveSessionPrice(offer, breq.clinicId) ?? "0") || 0 : 0;
  const cashbackRate = offer ? parseFloat(offer.cashbackPerSessionKwd ?? "0") || 0 : 0;

  // sessionPriceKwd = the GROSS session price (what the treatment costs before cashback)
  let sessionGross = storedPrice;
  if (sessionGross <= 0 && listFromOffer > 0) sessionGross = listFromOffer;
  if (sessionGross <= 0 && cashbackRate > 0) sessionGross = cashbackRate;

  const usesCashback = storedCashback > 0 || breq.hadCashback === true || breq.membershipType === "cashback";

  // Cashback deducted from the gross price
  let cashbackDeducted = storedCashback;
  if (cashbackDeducted <= 0 && usesCashback && cashbackRate > 0 && sessionGross > 0) {
    cashbackDeducted = Math.min(cashbackRate, sessionGross);
  }

  // Clinic take = gross minus cashback (what the customer actually pays at the clinic)
  const clinicTake = Math.max(0, sessionGross - cashbackDeducted);

  return {
    sessionGrossKwd: sessionGross.toFixed(3),
    clinicTakeKwd: clinicTake.toFixed(3),
    cashbackDeductedKwd: cashbackDeducted.toFixed(3),
    usesCashback,
    isPrepaidMembership: !offer?.payPerSession && !breq.isStandalone && sessionGross > 0 && clinicTake === 0 && cashbackDeducted === 0 && !usesCashback,
  };
}

export async function loadOffer(offerId: string): Promise<SchedOffer | null> {
  if (mongoose.isValidObjectId(offerId)) {
    const o = await OfferModel.findById(offerId).lean<OfferDoc | null>();
    if (o) return mapOfferDocToSched(o);
  }
  const legacy = offersStore.get(offerId);
  if (!legacy) return null;
  return {
    id: legacy.id,
    name: (legacy as any).name ?? undefined,
    maxSessions: legacy.maxSessions ?? null,
    sessionIntervalDays: legacy.sessionIntervalDays ?? 0,
    cashbackPerSessionKwd: legacy.cashbackPerSessionKwd,
    payPerSession: false,
    branchSessionPrices: [],
    allowExtraPaidSessions: false,
    branchExtraSessionPrices: []
  };
}

export function isWithinOfferValidity(uo: SchedUO, scheduledAt: Date) {
  if (!uo.activatedAt || !uo.expiresAt) return false;
  return scheduledAt >= new Date(uo.activatedAt) && scheduledAt <= new Date(uo.expiresAt);
}

/**
 * Cap accessible sessions by paid installments.
 * Spec: each paid installment unlocks exactly one additional session
 * (1st payment => 1st session; 2nd payment => 2nd session; ...).
 * Once ALL installments are paid, the full offer entitlement is unlocked.
 *
 * Fallback when offer.maxSessions is null/unlimited: still gate by paid
 * installments — without a fallback, customers on a single installment
 * could pre-book unlimited sessions.
 */
export function maxAccessibleSessions(uo: SchedUO, offerMax: number | null): number | null {
  if (uo.purchaseMode !== "installments") return offerMax;
  const total = uo.installmentCount ?? 1;
  const paid = uo.installmentsPaid ?? 0;
  if (total <= 0) return offerMax;
  if (paid >= total) return offerMax;
  const installmentCap = Math.max(0, paid);
  if (offerMax == null) return installmentCap;
  return Math.min(offerMax, installmentCap);
}

/** Common booking eligibility check returning HTTP error or null. */
export async function eligibilityError(
  uo: SchedUO,
  offer: SchedOffer,
  opts?: { skipSessionCap?: boolean; scheduledAt?: string | Date }
): Promise<{ code: string; status: number } | null> {
  if (uo.status === "reserved") return { code: "RESERVED_NEEDS_BALANCE", status: 409 };
  // A membership past its end date cannot be booked, even if the expiry job has
  // not flipped its status yet; nor can a session be placed after the end date.
  const expiresAt = uo.expiresAt ? new Date(uo.expiresAt) : null;
  if (uo.status === "expired" || (uo.status === "active" && expiresAt && expiresAt < new Date())) {
    return { code: "MEMBERSHIP_EXPIRED", status: 409 };
  }
  if (expiresAt && opts?.scheduledAt && new Date(opts.scheduledAt) > expiresAt) {
    return { code: "SCHEDULED_AFTER_EXPIRY", status: 409 };
  }
  if (uo.status === "enet_pending") return { code: "ENET_PENDING", status: 409 };
  if (uo.status === "enet_rejected") return { code: "ENET_REJECTED", status: 409 };
  if (uo.status !== "active" && uo.status !== "pending_payment") {
    return { code: "OFFER_NOT_ACTIVE", status: 409 };
  }

  if (opts?.skipSessionCap) return null;

  const cap = maxAccessibleSessions(uo, offer.maxSessions);
  if (cap != null) {
    // Count both already-consumed sessions AND future scheduled bookings — a
    // user shouldn't be able to pre-book the entire entitlement on the back of
    // a single installment payment.
    const committed = await sessionsStore.countCommitted(uo.id);
    const consumed = Math.max(uo.sessionsUsed ?? 0, committed);
    if (consumed >= cap) {
      if (uo.purchaseMode === "installments") {
        const total = uo.installmentCount ?? 1;
        const paid = uo.installmentsPaid ?? 0;
        if (paid < total) {
          return { code: "INSTALLMENT_NOT_PAID_FOR_NEXT_SESSION", status: 409 };
        }
      }
      if (!offer.allowExtraPaidSessions) {
        return { code: "MAX_SESSIONS_REACHED", status: 409 };
      }
    }
  }
  return null;
}

/**
 * Validates whether a proposed/confirmed appointment date respects the customer's session interval (e.g. 25 days).
 * Used across CS propose, Clinic confirm, Chat propose/confirm, CS direct schedule, and Reschedule.
 * Allows override with audit logging if forceOverride is explicitly confirmed.
 */
export async function checkStaffIntervalConstraint({
  userOfferId,
  userId,
  targetDate,
  forceOverride,
  actorId,
  actorRole,
  actionContext
}: {
  userOfferId?: string | null;
  userId: string;
  targetDate: Date;
  forceOverride?: boolean;
  actorId?: string;
  actorRole?: string;
  actionContext: string;
}): Promise<{
  allowed: boolean;
  code?: string;
  error?: string;
  message?: string;
  messageAr?: string;
  lastCompletedAt?: string;
  nextEligibleAt?: string;
  daysSinceLast?: number;
  requiredIntervalDays?: number;
}> {
  if (!userOfferId || !mongoose.isValidObjectId(userOfferId)) {
    return { allowed: true };
  }

  const uo = await loadUserOffer(userOfferId);
  if (!uo) return { allowed: true };

  const offer = await loadOffer(uo.offerId);
  // The offer's "minimum days between sessions" is the single rule for customers and
  // staff alike. 0 means the membership has no interval (e.g. Abraj, Sawa).
  const intervalDays = offer && typeof offer.sessionIntervalDays === "number" && offer.sessionIntervalDays > 0
    ? offer.sessionIntervalDays
    : 0;

  const uoDoc = await UserOfferModel.findById(userOfferId).select("bookingCooldownEndOverrideAt lastManualSessionAt").lean();
  const cooldownOverrideAt = (uoDoc as any)?.bookingCooldownEndOverrideAt ? new Date((uoDoc as any).bookingCooldownEndOverrideAt) : null;

  // 1. Check custom cooldown end override
  if (cooldownOverrideAt && targetDate < cooldownOverrideAt) {
    if (forceOverride) {
      if (actorId) {
        await logAuditAction({
          actorId,
          actorRole: (actorRole as any) || "staff",
          actionType: "override_interval_warning",
          targetEntityType: "UserOffer",
          targetEntityId: userOfferId,
          beforeState: { bookingCooldownEndOverrideAt: cooldownOverrideAt.toISOString() },
          afterState: { targetDate: targetDate.toISOString(), forceOverride: true },
          metadata: { actionContext, reason: "Staff forced schedule before cooldown end override" }
        });
      }
      return { allowed: true };
    }

    const targetDateStr = kwDate(targetDate);
    const cooldownStr = kwDate(cooldownOverrideAt);
    return {
      allowed: false,
      code: "INTERVAL_WARNING",
      error: "INTERVAL_WARNING",
      message: `The selected date (${targetDateStr}) is before the required cooldown date (${cooldownStr}).`,
      messageAr: `الموعد المختار (${targetDateStr}) قبل تاريخ انتهاء فترة التبريد المقررة (${cooldownStr}).`,
      nextEligibleAt: cooldownOverrideAt.toISOString(),
      requiredIntervalDays: intervalDays
    };
  }

  if (intervalDays === 0) return { allowed: true };

  // 2. Find last completed session
  const lastSessionDoc = await BookingSessionModel.findOne({
    userOfferId,
    status: "completed"
  }).sort({ completedAt: -1, scheduledAt: -1 }).lean();

  const d1 = (lastSessionDoc as any)?.completedAt
    ? new Date((lastSessionDoc as any).completedAt).getTime()
    : ((lastSessionDoc as any)?.scheduledAt ? new Date((lastSessionDoc as any).scheduledAt).getTime() : 0);
  const d2 = (uoDoc as any)?.lastManualSessionAt ? new Date((uoDoc as any).lastManualSessionAt).getTime() : 0;

  let lastCompletedDate: Date | null = null;
  if (d1 > 0 || d2 > 0) {
    lastCompletedDate = new Date(Math.max(d1, d2));
  } else {
    // Fallback: search by userId
    const userLastDoc = await BookingSessionModel.findOne({
      userId: uo.userId,
      status: "completed"
    }).sort({ completedAt: -1, scheduledAt: -1 }).lean();
    if (userLastDoc) {
      const dUser = (userLastDoc as any)?.completedAt
        ? new Date((userLastDoc as any).completedAt).getTime()
        : ((userLastDoc as any)?.scheduledAt ? new Date((userLastDoc as any).scheduledAt).getTime() : 0);
      if (dUser > 0) lastCompletedDate = new Date(dUser);
    }
  }

  if (lastCompletedDate) {
    const nextEligible = new Date(lastCompletedDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    if (targetDate < nextEligible) {
      if (forceOverride) {
        if (actorId) {
          await logAuditAction({
            actorId,
            actorRole: (actorRole as any) || "staff",
            actionType: "override_interval_warning",
            targetEntityType: "UserOffer",
            targetEntityId: userOfferId,
            beforeState: { lastCompletedAt: lastCompletedDate.toISOString(), nextEligibleAt: nextEligible.toISOString() },
            afterState: { targetDate: targetDate.toISOString(), forceOverride: true },
            metadata: { actionContext, reason: `Staff forced appointment before ${intervalDays}-day interval` }
          });
        }
        return { allowed: true };
      }

      const daysGap = Math.floor((targetDate.getTime() - lastCompletedDate.getTime()) / (24 * 60 * 60 * 1000));
      const lastStr = kwDate(lastCompletedDate);
      const nextStr = kwDate(nextEligible);
      return {
        allowed: false,
        code: "INTERVAL_WARNING",
        error: "INTERVAL_WARNING",
        message: `The proposed date is only ${daysGap} day(s) after the last completed session on ${lastStr}. Minimum gap required is ${intervalDays} days (next eligible date: ${nextStr}).`,
        messageAr: `الموعد المختار يبعد ${daysGap} يوماً فقط عن آخر جلسة مسجلة للعميلة (${lastStr}). يشترط فاصل ${intervalDays} يوماً على الأقل (أقرب موعد مسموح: ${nextStr}).`,
        lastCompletedAt: lastCompletedDate.toISOString(),
        nextEligibleAt: nextEligible.toISOString(),
        daysSinceLast: daysGap,
        requiredIntervalDays: intervalDays
      };
    }
  }

  return { allowed: true };
}

// ── Booking-request / chat helpers (from Task #4) ─────────────────────────
export type MongoUserOffer = {
  id: string;
  userId: string;
  offerId: string;
  clinicId: string;
  status: string;
  createdAt: string;
  pendingExpiresAt?: string;
  activatedAt?: string;
  expiresAt?: string;
  sessionsUsed?: number;
  paymentConfirmedBy?: string;
  paymentConfirmedAt?: string;
  paymentProofRef?: string;
  paymentMethod?: string;
  paymentAmountKwd?: string;
};

export async function resolveUserOffer(id: string): Promise<UserOfferRecord | null> {
  const local = commerceStore.get(id);
  if (local) return local;
  const mongo = (await userOfferService.getUserOffer(id).catch(() => null)) as MongoUserOffer | null;
  if (!mongo) return null;
  return {
    id: mongo.id,
    userId: String(mongo.userId),
    offerId: String(mongo.offerId),
    clinicId: String(mongo.clinicId),
    status: mongo.status as UserOfferRecord["status"],
    createdAt: mongo.createdAt,
    pendingExpiresAt: mongo.pendingExpiresAt,
    activatedAt: mongo.activatedAt,
    expiresAt: mongo.expiresAt,
    sessionsUsed: mongo.sessionsUsed ?? 0,
    paymentConfirmedBy: mongo.paymentConfirmedBy,
    paymentConfirmedAt: mongo.paymentConfirmedAt,
    paymentProofRef: mongo.paymentProofRef,
    paymentMethod: mongo.paymentMethod,
    paymentAmountKwd: mongo.paymentAmountKwd
  };
}

export type UserLean = { _id: mongoose.Types.ObjectId | string; clinicId?: mongoose.Types.ObjectId | string };
export type ClinicLean = { _id: mongoose.Types.ObjectId | string; nameEn?: string; nameAr?: string };

/**
 * Authorize a `clinicStaff` actor against a clinic. Admin/CS always allowed;
 * clinicStaff must belong to the same clinicId. Prevents cross-clinic IDOR
 * on booking-mutation endpoints.
 */
export async function canActOnClinic(
  actor: { userId: string; role: string },
  clinicId: string
): Promise<boolean> {
  if (actor.role === "admin" || actor.role === "cs" || actor.role === "legal" || actor.role === "cs_director") return true;
  if (actor.role !== "clinicStaff") return false;
  if (actor.userId.startsWith("impersonated_")) {
    const impersonatedClinicId = actor.userId.replace("impersonated_", "");
    return impersonatedClinicId === clinicId;
  }
  const myClinicId = await getUserClinicId(actor.userId);
  return !!myClinicId && myClinicId === clinicId;
}

export async function getUserClinicId(userId: string): Promise<string | undefined> {
  if (!mongoose.isValidObjectId(userId)) return undefined;
  try {
    const me = (await UserModel.findById(userId).select("clinicId").lean()) as UserLean | null;
    return me?.clinicId ? String(me.clinicId) : undefined;
  } catch {
    return undefined;
  }
}

export async function findClinicStaffUserIds(clinicId: string): Promise<string[]> {
  if (!mongoose.isValidObjectId(clinicId)) return [];
  try {
    const rows = (await UserModel.find({ role: "clinicStaff", clinicId, isActive: true })
      .select("_id")
      .lean()) as UserLean[];
    return rows.map((r) => String(r._id));
  } catch {
    return [];
  }
}

export const _roleIdCache: Map<string, { ids: string[]; ts: number }> = new Map();
export const ROLE_CACHE_TTL_MS = 60_000;

export async function findUserIdsByRole(role: string): Promise<string[]> {
  const cached = _roleIdCache.get(role);
  if (cached && Date.now() - cached.ts < ROLE_CACHE_TTL_MS) return cached.ids;
  try {
    const rows = (await UserModel.find({ role, isActive: true }).select("_id").lean()) as UserLean[];
    const ids = rows.map((r) => String(r._id));
    _roleIdCache.set(role, { ids, ts: Date.now() });
    return ids;
  } catch {
    return cached?.ids ?? [];
  }
}

export async function findCsUserIds(): Promise<string[]> {
  return findUserIdsByRole("cs");
}

export async function findFinanceUserIds(): Promise<string[]> {
  return findUserIdsByRole("finance");
}

export async function getClinicNames(clinicId: string): Promise<{ nameEn?: string; nameAr?: string }> {
  if (!mongoose.isValidObjectId(clinicId)) return {};
  try {
    const c = (await ClinicModel.findById(clinicId).select("nameEn nameAr").lean()) as ClinicLean | null;
    return c ? { nameEn: c.nameEn, nameAr: c.nameAr } : {};
  } catch {
    return {};
  }
}

export async function ensureConversationFor(breqId: string): Promise<{ conv: ReturnType<typeof chatStore.getConversation> | ReturnType<typeof chatStore.createConversation> | null; csIds: string[] }> {
  const breq = await bookingRequestsStore.get(breqId);
  if (!breq) return { conv: null, csIds: [] };

  // If there's already a conversationId AND the in-memory store still has it, return it.
  if (breq.conversationId) {
    const existing = chatStore.getConversation(breq.conversationId);
    if (existing) return { conv: existing, csIds: [] };

    // The conversation was lost (server restart wiped the in-memory store).
    // Restore it with the same ID so the booking request stays linked.
    const [staffIds, csIds, clinicNames] = await Promise.all([
      findClinicStaffUserIds(breq.clinicId),
      findCsUserIds(),
      getClinicNames(breq.clinicId)
    ]);

    const participants = [
      { userId: breq.userId, role: "customer" as const, joinedAt: new Date().toISOString() },
      ...(breq.bookingRoute === "clinic" ? staffIds : []).map((id) => ({ userId: id, role: "clinicStaff" as const, joinedAt: new Date().toISOString() })),
      ...(breq.bookingRoute === "cs" ? csIds : []).map((id) => ({ userId: id, role: "cs" as const, joinedAt: new Date().toISOString() }))
    ];
    const seen = new Set<string>();
    const uniqParticipants = participants.filter((p) => (seen.has(p.userId) ? false : (seen.add(p.userId), true)));

    const restored = chatStore.restoreConversation({
      id: breq.conversationId,
      kind: "booking",
      title: `Booking @ ${clinicNames.nameEn ?? breq.clinicId}`,
      bookingRequestId: breq.id,
      participants: uniqParticipants
    });
    return { conv: restored, csIds };
  }

  // No conversationId at all — create a brand-new conversation.
  const [staffIds, csIds, clinicNames] = await Promise.all([
    findClinicStaffUserIds(breq.clinicId),
    findCsUserIds(),
    getClinicNames(breq.clinicId)
  ]);

  const participants = [
    { userId: breq.userId, role: "customer" as const, joinedAt: new Date().toISOString() },
    ...(breq.bookingRoute === "clinic" ? staffIds : []).map((id) => ({ userId: id, role: "clinicStaff" as const, joinedAt: new Date().toISOString() })),
    ...(breq.bookingRoute === "cs" ? csIds : []).map((id) => ({ userId: id, role: "cs" as const, joinedAt: new Date().toISOString() }))
  ];
  // De-duplicate
  const seen = new Set<string>();
  const uniqParticipants = participants.filter((p) => (seen.has(p.userId) ? false : (seen.add(p.userId), true)));

  const conv = chatStore.createConversation({
    kind: "booking",
    title: `Booking @ ${clinicNames.nameEn ?? breq.clinicId}`,
    bookingRequestId: breq.id,
    participants: uniqParticipants
  });
  await bookingRequestsStore.setConversation(breq.id, conv.id);
  return { conv, csIds };
}

export function postSystemMessage(
  conversationId: string,
  kind: NonNullable<Parameters<typeof chatStore.addMessage>[0]["systemKind"]>,
  body: string,
  payload?: Record<string, unknown>,
  senderId = "system"
) {
  const msg = chatStore.addMessage({
    conversationId,
    senderId,
    senderRole: "admin",
    body,
    systemKind: kind,
    systemPayload: payload
  });
  if (msg) emitToConversation(conversationId, "message:new", { conversationId, message: msg });
  return msg;
}
