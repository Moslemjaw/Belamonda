import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { commerceStore, type UserOfferRecord } from "../commerce/commerce.store.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { offersStore } from "../offers/offers.store.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore } from "./sessions.store.js";
import { bookingRequestsStore, type BookingRequestStatus } from "./bookingRequests.store.js";
import { chatStore } from "../chat/chat.store.js";
import { emitToConversation, emitToUser } from "../chat/chat.socket.js";
import { UserModel } from "../../models/user.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserOfferModel, type UserOfferDoc } from "../../models/userOffer.model.js";
import { OfferModel, type OfferDoc } from "../../models/offer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { PaymentModel } from "../../models/payment.model.js";
import { notifyBookingConfirmed, notifyBookingUnderReview, notifyBookingRejected, notifyBookingCancelled, notifySessionCompletedCashback } from "../notifications/notifications.service.js";
import { notifyChatRelatedUsers } from "../notifications/notifications.service.chat.js";
import { listRequiredFormsForUser } from "../eforms/eforms.router.js";
import { createSessionPayment, confirmSessionPayment } from "../../services/payment.service.js";

const RequestSchema = z.object({
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

const ScheduleSchema = z.object({
  userOfferId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional()
});

const ProposeSchema = z.object({
  scheduledAt: z.string().datetime(),
  notes: z.string().optional()
});

const RejectSchema = z.object({ reason: z.string().min(1).max(500) });
const CancelSchema = z.object({ reason: z.string().max(500).optional() });

const MarkSchema = z.object({
  status: z.enum(["completed", "no_show", "cancelled"]),
  notes: z.string().optional(),
  extraItems: z.array(z.object({ name: z.string(), priceKwd: z.string(), qty: z.number() })).optional(),
  cashbackToDeductKwd: z.string().optional()
});

// ── Mongo/legacy-aware loaders (from Task #2) ─────────────────────────────
type SchedUO = {
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

async function loadUserOffer(id: string): Promise<SchedUO | null> {
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

type SchedOffer = {
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
};

/**
 * Resolve the session fee for a specific branch.
 * Precedence: branch-level override → offer-level default.
 * Returns undefined when payPerSession is true but no price is configured.
 */
function resolveSessionPrice(offer: SchedOffer, clinicId: string, isExtraSession: boolean = false): string | undefined {
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

function mapOfferDocToSched(o: OfferDoc): SchedOffer {
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
    }))
  };
}

/** Session list price, cashback applied, and cash the clinic should collect. */
function computeBookingRequestFinancials(
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

async function loadOffer(offerId: string): Promise<SchedOffer | null> {
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

function isWithinOfferValidity(uo: SchedUO, scheduledAt: Date) {
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
function maxAccessibleSessions(uo: SchedUO, offerMax: number | null): number | null {
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
async function eligibilityError(
  uo: SchedUO,
  offer: SchedOffer,
  opts?: { skipSessionCap?: boolean }
): Promise<{ code: string; status: number } | null> {
  if (uo.status === "reserved") return { code: "RESERVED_NEEDS_BALANCE", status: 409 };
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

// ── Booking-request / chat helpers (from Task #4) ─────────────────────────
type MongoUserOffer = {
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

async function resolveUserOffer(id: string): Promise<UserOfferRecord | null> {
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

type UserLean = { _id: mongoose.Types.ObjectId | string; clinicId?: mongoose.Types.ObjectId | string };
type ClinicLean = { _id: mongoose.Types.ObjectId | string; nameEn?: string; nameAr?: string };

/**
 * Authorize a `clinicStaff` actor against a clinic. Admin/CS always allowed;
 * clinicStaff must belong to the same clinicId. Prevents cross-clinic IDOR
 * on booking-mutation endpoints.
 */
async function canActOnClinic(
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

async function getUserClinicId(userId: string): Promise<string | undefined> {
  if (!mongoose.isValidObjectId(userId)) return undefined;
  try {
    const me = (await UserModel.findById(userId).select("clinicId").lean()) as UserLean | null;
    return me?.clinicId ? String(me.clinicId) : undefined;
  } catch {
    return undefined;
  }
}

async function findClinicStaffUserIds(clinicId: string): Promise<string[]> {
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

const _roleIdCache: Map<string, { ids: string[]; ts: number }> = new Map();
const ROLE_CACHE_TTL_MS = 60_000;

async function findUserIdsByRole(role: string): Promise<string[]> {
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

async function findCsUserIds(): Promise<string[]> {
  return findUserIdsByRole("cs");
}

async function findFinanceUserIds(): Promise<string[]> {
  return findUserIdsByRole("finance");
}

async function getClinicNames(clinicId: string): Promise<{ nameEn?: string; nameAr?: string }> {
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

function postSystemMessage(
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

export const schedulingRouter = Router();

// ── Customer requests a session — creates booking request + conversation ───
schedulingRouter.post("/me/request", authRequired, async (req, res, next) => {
  try {
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    let uoId = parsed.data.userOfferId;
    let overrideClinicId = parsed.data.clinicId;

    if (parsed.data.isStandalone && uoId.startsWith("temp_")) {
       if (!parsed.data.standaloneName) return res.status(400).json({ error: "MISSING_STANDALONE_NAME" });
       if (!overrideClinicId) return res.status(400).json({ error: "MISSING_CLINIC_ID" });
       const bookingRoute: "clinic" | "cs" =
         parsed.data.schedulingMode === "belamonda_cs" ? "cs" : "clinic";

       const openStatuses = ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted"];
       const existingStandalone = await BookingRequestModel.findOne({
         userId: req.auth!.userId,
         isStandalone: true,
         status: { $in: openStatuses }
       });
       if (existingStandalone) {
         return res.status(409).json({ error: "ALREADY_HAVE_OPEN_REQUEST" });
       }

       // Standalone booking flow: create booking request only.
       // Do NOT create Offer/UserOffer records.
       const standalonePrice = String(parsed.data.standalonePrice ?? "0.000");
       const breq = await bookingRequestsStore.create({
         userId: req.auth!.userId,
         clinicId: overrideClinicId,
         isStandalone: true,
         bookingRoute,
         standaloneName: parsed.data.standaloneName,
         membershipType: "none",
         hadCashback: false,
         sessionPriceKwd: standalonePrice,
         preferredAt: parsed.data.preferredAt,
         notes: parsed.data.notes
       });
       const { conv } = await ensureConversationFor(breq.id);
       if (conv) {
         postSystemMessage(
           conv.id,
           "booking_requested",
           `Customer requested a CS booking for ${parsed.data.standaloneName}${parsed.data.preferredAt ? ` (preferred ${parsed.data.preferredAt})` : ""}.${parsed.data.notes ? ` Note: ${parsed.data.notes}` : ""}`,
           { bookingRequestId: breq.id, preferredAt: parsed.data.preferredAt }
         );
       }
       notifyBookingUnderReview(req.auth!.userId, breq.id);
       const [csIds, financeIds] = await Promise.all([findCsUserIds(), findFinanceUserIds()]);
       const additionalNotifyIds = bookingRoute === "clinic" ? await findClinicStaffUserIds(breq.clinicId) : csIds;
       notifyChatRelatedUsers({
         userIds: Array.from(new Set([...additionalNotifyIds, ...financeIds])),
         kind: "booking_under_review",
         body: `Booking request ${breq.id}: clinic=${breq.clinicId}, price=${breq.sessionPriceKwd ?? "0.000"} KWD, membership=none, cashback=0.000 KWD`,
         payload: {
           bookingRequestId: breq.id,
           clinicId: breq.clinicId,
           sessionPriceKwd: breq.sessionPriceKwd ?? "0.000",
           membershipType: "none",
           cashbackDeductedKwd: "0.000",
           isStandalone: true,
           bookingRoute
         }
       });
       return res.status(201).json({ request: breq, conversationId: conv?.id ?? null });
    }

    const uo = await loadUserOffer(uoId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    // Ensure the customer is either the owner OR a group member
    const isOwner = uo.userId === req.auth!.userId;
    const isMember = (uo.membershipType === "group" || !!(uo as any).groupInviteCode) && uo.sharedWith?.includes(req.auth!.userId);
    if (!isOwner && !isMember) {
      return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    }
    
    if (overrideClinicId) {
       uo.clinicId = overrideClinicId; // Use selected clinic
    }

    // KYC + offer load + e-forms check — all independent, run in parallel
    const [user, offer, pendingForms] = await Promise.all([
      kycStore.getUser(req.auth!.userId),
      loadOffer(uo.offerId),
      listRequiredFormsForUser(req.auth!.userId, [{ kind: "offer", refId: String(uo.offerId) }], "booking")
    ]);

    if (user && user.verificationStatus !== "approved") {
      return res.status(403).json({ error: "KYC_REQUIRED" });
    }
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    const elErr = await eligibilityError(uo, offer);
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });

    // Gate: session interval cooling period
    if (offer.sessionIntervalDays > 0) {
      const lastCompletedAt = await sessionsStore.lastCompletedAt(uo.id);
      if (lastCompletedAt) {
        const nextEligible = new Date(new Date(lastCompletedAt).getTime() + offer.sessionIntervalDays * 24 * 60 * 60 * 1000);
        if (new Date() < nextEligible) {
          return res.status(409).json({ error: "INTERVAL_NOT_MET", nextEligibleAt: nextEligible.toISOString() });
        }
      }
    }

    // Gate: required-before-booking e-forms
    if (pendingForms.length) {
      return res.status(409).json({ error: "EFORMS_REQUIRED", forms: pendingForms });
    }

    // Gate: prevent multiple open booking requests for the same membership
    const openStatuses = ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted"];
    const existingReq = await BookingRequestModel.findOne({
      userOfferId: uo.id,
      status: { $in: openStatuses }
    });
    if (existingReq) {
      return res.status(409).json({ error: "ALREADY_HAVE_OPEN_REQUEST" });
    }

    // Calculate if this is an extra session
    const cap = maxAccessibleSessions(uo, offer.maxSessions);
    const committed = await sessionsStore.countCommitted(uo.id);
    const consumed = Math.max(uo.sessionsUsed ?? 0, committed);
    const isExtraSession = !!(offer.allowExtraPaidSessions && cap != null && consumed >= cap);

    // Gate: pay-per-session / cashback logic
    const resolvedPrice = resolveSessionPrice(offer, uo.clinicId, isExtraSession);
    let amountToPay = resolvedPrice;
    let cashbackDeducted = 0;

    if (!parsed.data.isStandalone && uo.membershipType === "cashback") {
      // Defer all cashback deductions to the POS checkout.
      // We will not deduct cashback during scheduling, as the user pays at the clinic.
      cashbackDeducted = 0;
      amountToPay = resolvedPrice;
    } else if (resolvedPrice && !parsed.data.isStandalone) {
      // Non-cashback membership with a pay-per-session price — no cashback deduction.
      amountToPay = resolvedPrice;
    }

    if (amountToPay && parseFloat(amountToPay) > 0 && !parsed.data.isStandalone) {
      // Create the booking request first so we can link the payment to it
      const breq = await bookingRequestsStore.create({
        userOfferId: uo.id,
        userId: uo.userId,
        offerId: uo.offerId,
        clinicId: uo.clinicId,
        isStandalone: !!parsed.data.isStandalone,
        bookingRoute: "cs",
        membershipType: uo.membershipType ?? "none",
        hadCashback: cashbackDeducted > 0,
        standaloneName: parsed.data.standaloneName,
        preferredAt: parsed.data.preferredAt,
        notes: parsed.data.notes
      });
      const gross = parseFloat(amountToPay) + cashbackDeducted;
      await bookingRequestsStore.update(breq.id, { 
        status: "awaiting_session_payment", 
        sessionPriceKwd: parsed.data.sessionGrossKwd ?? gross.toFixed(3)
        // We do not save cashbackDeductedKwd here. It will be handled entirely at POS checkout.
      });
      let sessionPayment;
      try {
        sessionPayment = await createSessionPayment({
          userId: uo.userId,
          offerId: uo.offerId,
          userOfferId: uo.id,
          amountKwd: amountToPay,
          grossAmountKwd: gross.toFixed(3),
          cashbackAppliedKwd: cashbackDeducted > 0 ? cashbackDeducted.toFixed(3) : undefined,
          bookingRequestId: breq.id
        });
      } catch (payErr) {
        // Compensate: remove the orphaned booking request so the customer can retry
        await bookingRequestsStore.update(breq.id, { status: "cancelled" });
        if (cashbackDeducted > 0 && mongoose.isValidObjectId(uo.id)) {
          // Refund cashback
          await UserOfferModel.findByIdAndUpdate(uo.id, {
            $inc: { cashbackBalanceKwd: cashbackDeducted }
          });
          await kycStore.adjustUnlocked({
            userId: uo.userId,
            amountKwd: cashbackDeducted.toFixed(3),
            reason: "Refund from failed booking payment",
            createdById: req.auth!.userId
          });
        }
        throw payErr;
      }
      const finalBreq = await bookingRequestsStore.update(breq.id, { sessionPaymentId: sessionPayment.id });
      return res.status(201).json({
        request: finalBreq,
        sessionPaymentRequired: true,
        sessionPaymentId: sessionPayment.id,
        sessionPriceKwd: amountToPay,
        conversationId: null
      });
    }
    // Compute session gross price for display on clinic/CS dashboards
    // Priority: client-provided session price > server-computed > offer config
    let sessionGross: string | undefined;
    if (parsed.data.sessionGrossKwd) {
      // Client sent the actual treatment price at the clinic
      sessionGross = parsed.data.sessionGrossKwd;
    } else if (parsed.data.isStandalone) {
      sessionGross = String(parsed.data.standalonePrice ?? "0.000");
    } else if (cashbackDeducted > 0) {
      const remaining = parseFloat(amountToPay ?? "0") || 0;
      sessionGross = (cashbackDeducted + remaining).toFixed(3);
    } else if (offer && uo.membershipType === "cashback") {
      const rate = parseFloat(offer.cashbackPerSessionKwd || "0") || 0;
      if (rate > 0) sessionGross = rate.toFixed(3);
    }

    // Cashback is entirely handled at the POS checkout. We don't save any initial deduction here.
    const finalCashbackDeducted = undefined;

    const breq = await bookingRequestsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      isStandalone: !!parsed.data.isStandalone,
      bookingRoute: "cs",
      membershipType: uo.membershipType ?? "none",
      hadCashback: cashbackDeducted > 0 || !!parsed.data.cashbackAppliedKwd,
      sessionPriceKwd: sessionGross,
      cashbackDeductedKwd: finalCashbackDeducted,
      standaloneName: parsed.data.standaloneName,
      preferredAt: parsed.data.preferredAt,
      notes: parsed.data.notes
    });

    const [{ conv, csIds: convCsIds }, financeIds] = await Promise.all([
      ensureConversationFor(breq.id),
      findFinanceUserIds()
    ]);
    if (conv) {
      postSystemMessage(
        conv.id,
        "booking_requested",
        `Customer requested a booking${parsed.data.preferredAt ? ` (preferred ${parsed.data.preferredAt})` : ""}.${parsed.data.notes ? ` Note: ${parsed.data.notes}` : ""}`,
        { bookingRequestId: breq.id, preferredAt: parsed.data.preferredAt }
      );
      const recipients = conv.participants.map((p) => p.userId).filter((u) => u !== req.auth!.userId);
      notifyChatRelatedUsers({
        userIds: recipients,
        kind: "booking_under_review",
        body: `New booking request from ${req.auth!.userId}`,
        payload: { bookingRequestId: breq.id }
      });
    }

    const additionalNotifyIds = breq.bookingRoute === "clinic" 
      ? await findClinicStaffUserIds(breq.clinicId)
      : (convCsIds.length ? convCsIds : await findCsUserIds());
      
    notifyBookingUnderReview(req.auth!.userId, breq.id);
    notifyChatRelatedUsers({
      userIds: Array.from(new Set([...additionalNotifyIds, ...financeIds])),
      kind: "booking_under_review",
      body: `Booking request ${breq.id}: clinic=${breq.clinicId}, price=${breq.sessionPriceKwd ?? "0.000"} KWD, membership=${breq.membershipType ?? "none"}, cashback=${breq.cashbackDeductedKwd ?? "0.000"} KWD`,
      payload: {
        bookingRequestId: breq.id,
        clinicId: breq.clinicId,
        sessionPriceKwd: breq.sessionPriceKwd ?? "0.000",
        membershipType: breq.membershipType ?? "none",
        cashbackDeductedKwd: breq.cashbackDeductedKwd ?? "0.000",
        isStandalone: !!breq.isStandalone
      }
    });

    return res.status(201).json({ request: breq, conversationId: conv?.id ?? null });
  } catch (e) {
    next(e);
  }
});

// ── Customer's own sessions ────────────────────────────────────────────────
schedulingRouter.get("/me/sessions", authRequired, async (req, res) => {
  const sessions = Array.from(await sessionsStore.listByUser(req.auth!.userId));
  const enriched = await Promise.all(sessions.map(async (s) => {
    let offerName = null;
    const breq = await bookingRequestsStore.findBySessionId(s.id);
    if (breq?.standaloneName) {
      offerName = breq.standaloneName;
    } else if (s.offerId) {
      const offer = await loadOffer(s.offerId);
      offerName = offer?.name ?? null;
    }
    return { ...s, offerName };
  }));
  return res.json({ items: enriched });
});

schedulingRouter.get("/me/requests", authRequired, async (req, res) => {
  const requests = await bookingRequestsStore.list({ userId: req.auth!.userId });
  const enriched = await Promise.all(requests.map(async (r) => {
    let offerName = r.standaloneName;
    if (!offerName && r.offerId) {
      const offer = await loadOffer(r.offerId);
      offerName = offer?.name ?? undefined;
    }
    return { ...r, offerName };
  }));
  return res.json({ items: enriched });
});

/** Pre-booking quote: session price, cashback, and cash due at clinic. */
schedulingRouter.get("/me/booking-quote", authRequired, async (req, res) => {
  const userOfferId = typeof req.query.userOfferId === "string" ? req.query.userOfferId : "";
  const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  if (!userOfferId) return res.status(400).json({ error: "VALIDATION_ERROR" });

  const uo = await loadUserOffer(userOfferId);
  if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
  const isOwner = uo.userId === req.auth!.userId;
  const isMember = (uo.membershipType === "group" || !!(uo as any).groupInviteCode) && uo.sharedWith?.includes(req.auth!.userId);
  if (!isOwner && !isMember) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

  const offer = await loadOffer(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

  const cap = maxAccessibleSessions(uo, offer.maxSessions);
  const committed = await sessionsStore.countCommitted(uo.id);
  const consumed = Math.max(uo.sessionsUsed ?? 0, committed);
  const isExtraSession = !!(offer.allowExtraPaidSessions && cap != null && consumed >= cap);

  const targetClinic = clinicId || uo.clinicId;
  const listPrice = resolveSessionPrice(offer, targetClinic, isExtraSession);
  const listNum = parseFloat(listPrice ?? "0") || 0;
  const rate = listNum > 0 ? listNum : parseFloat(offer.cashbackPerSessionKwd || "0");

  let cashbackApplied = 0;
  let clinicPay = rate;
  if (uo.membershipType === "cashback") {
    const balance = parseFloat(uo.cashbackBalanceKwd || "0");
    cashbackApplied = Math.min(balance, rate);
    clinicPay = Math.max(0, rate - cashbackApplied);
  } else if (listNum > 0) {
    clinicPay = listNum;
  }

  const elErr = await eligibilityError(uo, offer);

  return res.json({
    canBook: !elErr,
    blockCode: elErr?.code ?? null,
    sessionGrossKwd: (rate || clinicPay + cashbackApplied).toFixed(3),
    cashbackAppliedKwd: cashbackApplied.toFixed(3),
    clinicPayKwd: clinicPay.toFixed(3),
    sessionsUsed: consumed,
    sessionsCap: cap,
    installmentsPaid: uo.installmentsPaid ?? null,
    installmentCount: uo.installmentCount ?? null,
    isExtraSession,
  });
});

// ── Customer pays the session fee (mock) ────────────────────────────────────
schedulingRouter.post("/me/requests/:id/pay-session", authRequired, async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (breq.userId !== req.auth!.userId) return res.status(403).json({ error: "FORBIDDEN" });
    if (breq.status !== "awaiting_session_payment") return res.status(409).json({ error: "INVALID_STATE" });
    if (!breq.sessionPaymentId) return res.status(400).json({ error: "NO_SESSION_PAYMENT" });

    await confirmSessionPayment(breq.sessionPaymentId);

    const updated = await bookingRequestsStore.update(breq.id, { status: "under_review" });

    const [{ conv, csIds: convCsIds2 }, financeIds] = await Promise.all([
      ensureConversationFor(breq.id),
      findFinanceUserIds()
    ]);
    if (conv) {
      postSystemMessage(
        conv.id,
        "booking_requested",
        `Customer paid session fee (${breq.sessionPriceKwd ?? ""} KWD) and submitted booking request${breq.preferredAt ? ` (preferred ${breq.preferredAt})` : ""}.${breq.notes ? ` Note: ${breq.notes}` : ""}`,
        { bookingRequestId: breq.id, preferredAt: breq.preferredAt }
      );
      const recipients = conv.participants.map((p: any) => p.userId).filter((u: any) => u !== req.auth!.userId);
      notifyChatRelatedUsers({
        userIds: recipients,
        kind: "booking_under_review",
        body: `New session booking (paid) from ${req.auth!.userId}`,
        payload: { bookingRequestId: breq.id }
      });
    }

    const additionalNotifyIds = breq.bookingRoute === "clinic"
      ? await findClinicStaffUserIds(breq.clinicId)
      : (convCsIds2.length ? convCsIds2 : await findCsUserIds());

    notifyBookingUnderReview(req.auth!.userId, breq.id);
    notifyChatRelatedUsers({
      userIds: Array.from(new Set([...additionalNotifyIds, ...financeIds])),
      kind: "booking_under_review",
      body: `Paid booking request ${breq.id}: clinic=${breq.clinicId}, price=${breq.sessionPriceKwd ?? "0.000"} KWD, membership=${breq.membershipType ?? "none"}, cashback=${breq.cashbackDeductedKwd ?? "0.000"} KWD`,
      payload: {
        bookingRequestId: breq.id,
        clinicId: breq.clinicId,
        sessionPriceKwd: breq.sessionPriceKwd ?? "0.000",
        membershipType: breq.membershipType ?? "none",
        cashbackDeductedKwd: breq.cashbackDeductedKwd ?? "0.000"
      }
    });

    return res.json({ request: updated, conversationId: conv?.id ?? null });
  } catch (e) {
    next(e);
  }
});

// ── Customer accepts a proposed slot ───────────────────────────────────────
schedulingRouter.post("/me/requests/:id/accept", authRequired, async (req, res) => {
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (breq.userId !== req.auth!.userId) return res.status(403).json({ error: "FORBIDDEN" });
  if (breq.status !== "slot_proposed") return res.status(409).json({ error: "INVALID_STATE" });

  const updated = await bookingRequestsStore.update(breq.id, {
    status: "slot_accepted",
    acceptedAt: new Date().toISOString()
  });

  if (updated) {
    const { conv } = await ensureConversationFor(breq.id);
    if (conv) {
      postSystemMessage(conv.id, "slot_accepted", `Customer accepted the proposed time (${updated.proposedAt}).`, {
        bookingRequestId: updated.id,
        scheduledAt: updated.proposedAt
      });
      const recipients = conv.participants.map((p) => p.userId).filter((u) => u !== req.auth!.userId);
      notifyChatRelatedUsers({
        userIds: recipients,
        kind: "booking_slot_accepted",
        body: `Customer accepted the proposed time slot.`,
        payload: { bookingRequestId: updated.id }
      });
    }
  }
  return res.json({ request: updated });
});

// ── Customer cancels their request ─────────────────────────────────────────
schedulingRouter.post("/me/requests/:id/cancel", authRequired, async (req, res) => {
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (breq.userId !== req.auth!.userId) return res.status(403).json({ error: "FORBIDDEN" });
  if (!["under_review", "slot_proposed", "slot_accepted"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }
  const parsed = CancelSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  const updated = await bookingRequestsStore.update(breq.id, { status: "cancelled" });

  // Refund cashback if it was deducted
  if (updated?.cashbackDeductedKwd && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
    const refund = parseFloat(updated.cashbackDeductedKwd);
    if (refund > 0) {
      await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { cashbackBalanceKwd: refund } });
      await kycStore.adjustUnlocked({
        userId: breq.userId,
        amountKwd: refund.toFixed(3),
        reason: "Refund from cancelled booking",
        createdById: req.auth!.userId
      });
    }
  }
  if (updated?.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_cancelled",
      `Customer cancelled the request${parsed.data.reason ? `: ${parsed.data.reason}` : ""}.`,
      { bookingRequestId: updated.id }
    );
  }
  const staffIds = await findClinicStaffUserIds(breq.clinicId);
  const csIds = await findCsUserIds();
  const financeIds = await findFinanceUserIds();
  notifyChatRelatedUsers({
    userIds: Array.from(new Set([...staffIds, ...csIds, ...financeIds])),
    kind: "booking_cancelled",
    body: `Customer cancelled booking request ${breq.id}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`,
    payload: { bookingRequestId: breq.id }
  });
  return res.json({ request: updated });
});

// ── Clinic / CS lists pending booking requests ─────────────────────────────
schedulingRouter.get("/cs/requests", authRequired, requireRole(["cs", "legal", "admin", "clinicStaff", "finance", "cs_director"]), async (req, res) => {
  const status = (typeof req.query.status === "string" ? req.query.status : "open") as BookingRequestStatus | "all" | "open";
  const filter: Parameters<typeof bookingRequestsStore.list>[0] = { status };
  if (req.auth!.role === "clinicStaff") {
    const cid = await getUserClinicId(req.auth!.userId);
    if (cid) filter.clinicId = cid;
  }
  const items = await bookingRequestsStore.list(filter);

  // Enrich with customer names
  const uniqueUserIds = [...new Set(items.map((i) => i.userId))];
  const users = uniqueUserIds.length > 0
    ? (await UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()) as Array<{ _id: { toString(): string }; fullName?: string; phone?: string }>
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));

  // Enrich with offer names and financials
  const uniqueOfferIds = [...new Set(items.map((it) => it.offerId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const offerDocs = uniqueOfferIds.length > 0
    ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean<OfferDoc[]>()
    : [];
  const offerMap = new Map(offerDocs.map((o) => [String(o._id), mapOfferDocToSched(o)]));

  const enriched = await Promise.all(
    items.map(async (it) => {
      const c = await getClinicNames(it.clinicId);
      const offer = it.offerId && mongoose.isValidObjectId(it.offerId)
        ? (offerMap.get(it.offerId) ?? null)
        : null;
      const financials = computeBookingRequestFinancials(it, offer);
      return {
        ...it,
        customerName: userMap.get(it.userId)?.fullName ?? null,
        customerPhone: userMap.get(it.userId)?.phone ?? null,
        clinicNameEn: c.nameEn,
        clinicNameAr: c.nameAr,
        offerName: it.standaloneName ?? offer?.name ?? null,
        ...financials,
      };
    })
  );
  return res.json({ items: enriched });
});

schedulingRouter.get("/clinic/requests", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  let clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  if (!clinicId && req.auth!.role === "clinicStaff") {
    clinicId = req.auth!.clinicId || await getUserClinicId(req.auth!.userId);
    if (!clinicId) return res.json({ items: [] });
  }
  const status = (typeof req.query.status === "string" ? req.query.status : "open") as BookingRequestStatus | "all" | "open";
  const filter: Parameters<typeof bookingRequestsStore.list>[0] = { status, bookingRoute: "clinic" };
  if (clinicId) filter.clinicId = clinicId;
  const items = await bookingRequestsStore.list(filter);

  const uniqueUserIds = [...new Set(items.map((i) => i.userId))];
  const users = uniqueUserIds.length > 0
    ? (await UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()) as Array<{ _id: { toString(): string }; fullName?: string; phone?: string }>
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));

  const enriched = items.map((item) => ({
    ...item,
    customerName: userMap.get(item.userId)?.fullName ?? null,
    customerPhone: userMap.get(item.userId)?.phone ?? null,
  }));

  const uniqueOfferIds = [...new Set(enriched.map((it) => it.offerId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const offerDocs = uniqueOfferIds.length > 0
    ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean<OfferDoc[]>()
    : [];
  const offerMap = new Map(offerDocs.map((o) => [String(o._id), mapOfferDocToSched(o)]));

  const finalItems = enriched.map((it) => {
    const offer = it.offerId && mongoose.isValidObjectId(it.offerId)
      ? (offerMap.get(it.offerId) ?? null)
      : (it.offerId ? (offersStore.get(it.offerId) as any as SchedOffer | undefined) ?? null : null);
    const financials = computeBookingRequestFinancials(it, offer);
    return {
      ...it,
      offerName: it.standaloneName ?? offer?.name ?? (it.offerId && !mongoose.isValidObjectId(it.offerId) ? (offersStore.get(it.offerId) as { name?: string } | undefined)?.name ?? null : null),
      ...financials,
    };
  });

  return res.json({ items: finalItems });
});

schedulingRouter.get("/clinic/financial-summary", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  let clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  if (!clinicId && req.auth!.role === "clinicStaff") {
    clinicId = req.auth!.clinicId || ((await getUserClinicId(req.auth!.userId)) ?? undefined);
  }
  const empty = {
    totalGrossSalesKwd: "0.000",
    totalCashbackSpentKwd: "0.000",
    totalClinicCashKwd: "0.000",
    totalPendingCashKwd: "0.000",
    totalPaidCashKwd: "0.000",
    salesWithoutCashbackKwd: "0.000",
    salesWithCashbackKwd: "0.000",
    totalCashbackTakenKwd: "0.000",
    grossWithCashbackKwd: "0.000",
  };
  if (!clinicId) return res.json({ summary: empty });

  const docs = await BookingRequestModel.find({
    clinicId,
    status: { $nin: ["cancelled", "rejected"] },
  }).select("sessionPriceKwd cashbackDeductedKwd offerId clinicId membershipType hadCashback isStandalone status clinicPaymentStatus").lean();

  const offerIds = [...new Set(docs.map((d) => d.offerId).filter((id): id is string => !!id && mongoose.isValidObjectId(id)))];
  const offerDocs = offerIds.length > 0 ? await OfferModel.find({ _id: { $in: offerIds } }).lean<OfferDoc[]>() : [];
  const offerMap = new Map(offerDocs.map((o) => [String(o._id), mapOfferDocToSched(o)]));

  let totalGross = 0;
  let totalCashback = 0;
  let totalClinicCash = 0;
  let totalPending = 0;
  let totalPaid = 0;

  for (const d of docs) {
    const offer = d.offerId ? offerMap.get(String(d.offerId)) ?? null : null;
    const fin = computeBookingRequestFinancials(d as any, offer as any);
    const gross = parseFloat(fin.sessionGrossKwd) || 0;
    const cb = parseFloat(fin.cashbackDeductedKwd) || 0;
    const cash = parseFloat(fin.clinicTakeKwd) || 0;
    totalGross += gross;
    totalCashback += cb;
    if (d.status === "confirmed") {
      totalClinicCash += cash;
      if (d.clinicPaymentStatus === "paid") totalPaid += cash;
      else totalPending += cash;
    }
  }

  return res.json({
    summary: {
      totalGrossSalesKwd: totalGross.toFixed(3),
      totalCashbackSpentKwd: totalCashback.toFixed(3),
      totalClinicCashKwd: totalClinicCash.toFixed(3),
      totalPendingCashKwd: totalPending.toFixed(3),
      totalPaidCashKwd: totalPaid.toFixed(3),
      salesWithoutCashbackKwd: totalClinicCash.toFixed(3),
      salesWithCashbackKwd: totalPaid.toFixed(3),
      totalCashbackTakenKwd: totalCashback.toFixed(3),
      grossWithCashbackKwd: totalGross.toFixed(3),
    },
  });
});

schedulingRouter.post("/requests/:id/conversation", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  const { conv } = await ensureConversationFor(breq.id);
  return res.json({ conversationId: conv?.id ?? breq.conversationId ?? null });
});

// ── Clinic staff / CS proposes a slot in chat ─────────────────────────────
schedulingRouter.post("/requests/:id/propose", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const parsed = ProposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (!["under_review", "slot_proposed", "slot_accepted", "awaiting_session_payment"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }
  const updated = await bookingRequestsStore.update(breq.id, {
    status: "slot_proposed",
    proposedAt: parsed.data.scheduledAt,
    proposedBy: req.auth!.userId
  });
  const { conv } = await ensureConversationFor(breq.id);
  if (conv) {
    postSystemMessage(
      conv.id,
      "slot_proposed",
      `Proposed time: ${parsed.data.scheduledAt}${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
      { bookingRequestId: breq.id, scheduledAt: parsed.data.scheduledAt },
      req.auth!.userId
    );
    notifyChatRelatedUsers({
      userIds: [breq.userId],
      kind: "booking_slot_proposed",
      body: `New time proposed: ${parsed.data.scheduledAt}`,
      payload: { bookingRequestId: breq.id }
    });
  }
  return res.json({ request: updated });
});

// ── Clinic staff / CS confirms the booking ──────────────────────────────────
schedulingRouter.post("/requests/:id/confirm", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (!["slot_proposed", "slot_accepted", "under_review", "awaiting_session_payment"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }
  const bodyParsed = ProposeSchema.safeParse(req.body ?? {});
  const scheduledAt = (bodyParsed.success ? bodyParsed.data.scheduledAt : undefined) || breq.proposedAt;
  if (!scheduledAt) return res.status(400).json({ error: "NO_SCHEDULED_TIME" });

  if (!breq.userOfferId) {
    return res.status(400).json({ error: "STANDALONE_USE_SCHEDULE_ENDPOINT" });
  }

  const uo = await loadUserOffer(breq.userOfferId);
  if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
  const offer = await loadOffer(uo.offerId);
  if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
  const elErr = await eligibilityError(uo, offer, { skipSessionCap: true });
  if (elErr) return res.status(elErr.status).json({ error: elErr.code });

  const sessionClinicId = breq.clinicId || uo.clinicId;
  if (await sessionsStore.isSlotTaken(sessionClinicId, scheduledAt)) {
    return res.status(409).json({ error: "SLOT_TAKEN" });
  }

  const session = await sessionsStore.create({
    userOfferId: uo.id,
    userId: uo.userId,
    offerId: uo.offerId,
    clinicId: sessionClinicId,
    scheduledAt,
    scheduledBy: req.auth!.userId
  });

  // Increment sessionsUsed when booking is confirmed/scheduled (non-standalone memberships)
  if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
    await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: 1 } });
  }

  const finPreview = computeBookingRequestFinancials(breq, offer);
  const clinicStaffConfirm = req.auth!.role === "clinicStaff";
  await bookingRequestsStore.update(breq.id, {
    sessionPriceKwd: breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0 ? breq.sessionPriceKwd : finPreview.clinicTakeKwd,
    cashbackDeductedKwd: breq.cashbackDeductedKwd && parseFloat(breq.cashbackDeductedKwd) > 0 ? breq.cashbackDeductedKwd : finPreview.cashbackDeductedKwd,
    clinicPaymentStatus: clinicStaffConfirm ? "pending" : breq.clinicPaymentStatus,
  });

  let sessionPaymentId = breq.sessionPaymentId;
  if (breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0 && !sessionPaymentId) {
    const cb = parseFloat(breq.cashbackDeductedKwd || "0");
    const gross = parseFloat(breq.sessionPriceKwd) + cb;
    const sessionPayment = await createSessionPayment({
      userId: uo.userId,
      offerId: uo.offerId,
      userOfferId: uo.id,
      amountKwd: breq.sessionPriceKwd,
      grossAmountKwd: gross.toFixed(3),
      cashbackAppliedKwd: cb > 0 ? cb.toFixed(3) : undefined,
      bookingRequestId: breq.id
    });
    sessionPaymentId = sessionPayment.id;
  }

  const updated = await bookingRequestsStore.update(breq.id, {
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
    confirmedBy: req.auth!.userId,
    scheduledSessionId: session.id,
    ...(sessionPaymentId ? { sessionPaymentId } : {})
  });

  if (updated?.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_confirmed",
      `Booking confirmed for ${scheduledAt}.`,
      { bookingRequestId: updated.id, sessionId: session.id, scheduledAt },
      req.auth!.userId
    );
  }

  notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
  notifyChatRelatedUsers({
    userIds: [uo.userId],
    kind: "booking_confirmed",
    body: `Your booking is confirmed for ${scheduledAt}`,
    payload: { sessionId: session.id, bookingRequestId: breq.id }
  });
  emitToUser(uo.userId, "booking:confirmed", { request: updated, session });

  return res.status(201).json({ request: updated, session });
});

const MarkPaidSchema = z.object({
  extraItems: z.array(z.object({ name: z.string(), priceKwd: z.string(), qty: z.number() })).optional(),
  cashbackToDeductKwd: z.string().optional()
});

// ── Clinic marks a booking request payment as paid ──────────────────────────
schedulingRouter.post("/requests/:id/mark-paid", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res) => {
  const parsed = MarkPaidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (breq.clinicPaymentStatus === "paid") return res.status(409).json({ error: "ALREADY_MARKED_PAID" });

  if (breq.sessionPaymentId) {
    await PaymentModel.findByIdAndUpdate(breq.sessionPaymentId, {
      status: "completed",
      confirmedAt: new Date(),
      confirmedBy: req.auth!.userId,
      method: "cash" // or pos, we default to cash for clinic side payments
    });
  } else if (breq.sessionPriceKwd && parseFloat(breq.sessionPriceKwd) > 0) {
    // Fallback if no pending payment existed
    const cb = parseFloat(breq.cashbackDeductedKwd || "0");
    const gross = parseFloat(breq.sessionPriceKwd) + cb;
    const payDoc = await PaymentModel.create({
      userId: breq.userId,
      offerId: breq.offerId ? new mongoose.Types.ObjectId(breq.offerId) : undefined,
      userOfferId: breq.userOfferId ? new mongoose.Types.ObjectId(breq.userOfferId) : undefined,
      amountKwd: breq.sessionPriceKwd,
      grossAmountKwd: gross.toFixed(3),
      cashbackAppliedKwd: cb > 0 ? cb.toFixed(3) : undefined,
      currency: "KWD",
      method: "cash",
      purpose: "session_payment",
      status: "completed",
      provider: "manual",
      bookingRequestId: breq.id,
      confirmedAt: new Date(),
      confirmedBy: req.auth!.userId
    });
    await bookingRequestsStore.update(breq.id, { sessionPaymentId: payDoc.id });
  }

  const cbToDeduct = parseFloat(parsed.data.cashbackToDeductKwd || "0");
  const alreadyDeducted = parseFloat(breq.cashbackDeductedKwd || "0");
  const diff = cbToDeduct - alreadyDeducted;

  if (diff > 0) {
    const resAdjust = await kycStore.deductUnlocked({
      userId: breq.userId,
      amountKwd: diff.toFixed(3),
      reference: { kind: "session", id: breq.id },
      createdBy: { kind: "admin", id: req.auth!.userId }
    });
    if ("error" in resAdjust) {
      return res.status(400).json({ error: resAdjust.error });
    }
    if (breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
      const uoDoc = await UserOfferModel.findById(breq.userOfferId);
      if (uoDoc && uoDoc.cashbackBalanceKwd) {
        const oldBal = parseFloat(uoDoc.cashbackBalanceKwd);
        const newBal = Math.max(0, oldBal - diff);
        await UserOfferModel.findByIdAndUpdate(uoDoc._id, { $set: { cashbackBalanceKwd: newBal.toFixed(3) } });
      }
    }
  } else if (diff < 0) {
    await kycStore.adjustUnlocked({
      userId: breq.userId,
      amountKwd: Math.abs(diff).toFixed(3),
      reason: "Cashback un-applied at clinic POS",
      createdById: req.auth!.userId
    });
    if (breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
      const uoDoc = await UserOfferModel.findById(breq.userOfferId);
      if (uoDoc && uoDoc.cashbackBalanceKwd) {
        const oldBal = parseFloat(uoDoc.cashbackBalanceKwd);
        const newBal = oldBal + Math.abs(diff);
        await UserOfferModel.findByIdAndUpdate(uoDoc._id, { $set: { cashbackBalanceKwd: newBal.toFixed(3) } });
      }
    }
  }

  let totalBillKwd: string | undefined;
  let finalPaidKwd: string | undefined;
  
  const extraSum = parsed.data.extraItems?.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0) || 0;
  const basePrice = parseFloat(breq.sessionPriceKwd || "0");
  totalBillKwd = (basePrice + extraSum).toFixed(3);
  finalPaidKwd = Math.max(0, basePrice + extraSum - cbToDeduct).toFixed(3);

  const updated = await bookingRequestsStore.update(breq.id, {
    status: "confirmed",
    clinicPaymentStatus: "paid",
    clinicPaymentMarkedAt: new Date().toISOString(),
    clinicPaymentMarkedBy: req.auth!.userId,
    extraItems: parsed.data.extraItems,
    totalBillKwd,
    finalPaidKwd,
    cashbackDeductedKwd: cbToDeduct > 0 ? cbToDeduct.toFixed(3) : undefined
  });

  if (updated?.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_confirmed",
      `Clinic marked payment as paid${updated.sessionPriceKwd ? ` (${updated.sessionPriceKwd} KWD)` : ""}.`,
      { bookingRequestId: updated.id, clinicPaymentStatus: "paid" },
      req.auth!.userId
    );
  }

  const csIds = await findCsUserIds();
  const financeIds = await findFinanceUserIds();
  notifyChatRelatedUsers({
    userIds: Array.from(new Set([...csIds, ...financeIds, updated?.userId ?? breq.userId])),
    kind: "booking_confirmed",
    body: `Clinic marked booking ${breq.id} as paid${breq.sessionPriceKwd ? ` (${breq.sessionPriceKwd} KWD)` : ""}.`,
    payload: { bookingRequestId: breq.id, clinicPaymentStatus: "paid" }
  });

  return res.json({ request: updated });
});

// ── Clinic staff / CS rejects the booking ──────────────────────────────────
schedulingRouter.post("/requests/:id/reject", authRequired, requireRole(["clinicStaff", "cs", "legal", "admin", "cs_director"]), async (req, res) => {
  const parsed = RejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  const breq = await bookingRequestsStore.get(req.params.id);
  if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
  if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
    return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
  }
  if (["confirmed", "cancelled", "rejected"].includes(breq.status)) {
    return res.status(409).json({ error: "INVALID_STATE" });
  }
  const updated = await bookingRequestsStore.update(breq.id, {
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    rejectedBy: req.auth!.userId,
    rejectionReason: parsed.data.reason
  });

  // Refund cashback if it was deducted
  if (updated?.cashbackDeductedKwd && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
    const refund = parseFloat(updated.cashbackDeductedKwd);
    if (refund > 0) {
      await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { cashbackBalanceKwd: refund } });
      await kycStore.adjustUnlocked({
        userId: breq.userId,
        amountKwd: refund.toFixed(3),
        reason: "Refund from cancelled booking",
        createdById: req.auth!.userId
      });
    }
  }
  if (updated?.conversationId) {
    postSystemMessage(
      updated.conversationId,
      "booking_rejected",
      `Booking rejected: ${parsed.data.reason}`,
      { bookingRequestId: updated.id },
      req.auth!.userId
    );
  }
  notifyBookingRejected(breq.userId, breq.id, parsed.data.reason);
  notifyChatRelatedUsers({
    userIds: [breq.userId],
    kind: "booking_rejected",
    body: `Your booking was rejected: ${parsed.data.reason}`,
    payload: { bookingRequestId: breq.id }
  });
  return res.json({ request: updated });
});

// ── CS direct-schedule (legacy / Mongo-aware) ─────────────────────────────
schedulingRouter.post("/cs/schedule", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = ScheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const uo = await loadUserOffer(parsed.data.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    const user = await kycStore.getUser(uo.userId);
    if (user && user.verificationStatus !== "approved") return res.status(403).json({ error: "KYC_NOT_APPROVED" });

    const offer = await loadOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    if (offer.payPerSession) {
      return res.status(409).json({ error: "SESSION_PAYMENT_REQUIRED" });
    }

    const elErr = await eligibilityError(uo, offer);
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });

    const scheduledAtDate = new Date(parsed.data.scheduledAt);
    if (!isWithinOfferValidity(uo, scheduledAtDate)) return res.status(409).json({ error: "OFFER_OUT_OF_VALIDITY" });

    const lastCompletedAt = await sessionsStore.lastCompletedAt(uo.id);
    if (lastCompletedAt && offer.sessionIntervalDays > 0) {
      const nextEligible = new Date(new Date(lastCompletedAt).getTime() + offer.sessionIntervalDays * 24 * 60 * 60 * 1000);
      if (scheduledAtDate < nextEligible) {
        return res.status(409).json({ error: "INTERVAL_NOT_MET", nextEligibleAt: nextEligible.toISOString() });
      }
    }

    if (await sessionsStore.isSlotTaken(uo.clinicId, parsed.data.scheduledAt)) {
      return res.status(409).json({ error: "SLOT_TAKEN" });
    }

    const session = await sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: uo.clinicId,
      scheduledAt: parsed.data.scheduledAt,
      scheduledBy: req.auth!.userId,
      notes: parsed.data.notes
    });

    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    return res.status(201).json({ session });
  } catch (e) {
    next(e);
  }
});

// ── CS schedules from a specific request id ────────────────────────────────
schedulingRouter.post(
  "/cs/requests/:id/schedule",
  authRequired,
  requireRole(["cs", "legal", "admin", "clinicStaff", "cs_director"]),
  async (req, res) => {
    const parsed = ProposeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }
    if (["confirmed", "cancelled", "rejected"].includes(breq.status)) {
      return res.status(409).json({ error: "INVALID_STATE" });
    }
    // Standalone CS booking requests are confirmed without creating UserOffer/session.
    if (!breq.userOfferId) {
      const updated = await bookingRequestsStore.update(breq.id, {
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        confirmedBy: req.auth!.userId,
        proposedAt: parsed.data.scheduledAt
      });
      if (updated?.conversationId) {
        postSystemMessage(
          updated.conversationId,
          "booking_confirmed",
          `Booking confirmed for ${parsed.data.scheduledAt}.`,
          { bookingRequestId: updated.id }
        );
      }
      notifyBookingConfirmed(breq.userId, breq.id, parsed.data.scheduledAt);
      notifyChatRelatedUsers({
        userIds: [breq.userId],
        kind: "booking_confirmed",
        body: `Your booking is confirmed for ${parsed.data.scheduledAt}`,
        payload: { bookingRequestId: breq.id }
      });
      return res.status(201).json({ session: null, request: updated });
    }

    const uo = await loadUserOffer(breq.userOfferId);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });
    const offer = await loadOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
    const elErr = await eligibilityError(uo, offer, { skipSessionCap: true });
    if (elErr) return res.status(elErr.status).json({ error: elErr.code });



    // Use the booking request's clinicId (what the customer actually requested and CS confirmed)
    // rather than uo.clinicId, so the session appears in the correct clinic's dashboard.
    const sessionClinicId = breq.clinicId || uo.clinicId;
    if (await sessionsStore.isSlotTaken(sessionClinicId, parsed.data.scheduledAt)) {
      return res.status(409).json({ error: "SLOT_TAKEN" });
    }
    const session = await sessionsStore.create({
      userOfferId: uo.id,
      userId: uo.userId,
      offerId: uo.offerId,
      clinicId: sessionClinicId,
      scheduledAt: parsed.data.scheduledAt,
      scheduledBy: req.auth!.userId,
      notes: parsed.data.notes
    });

    if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
      await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: 1 } });
    }

    const breqAfterCb = (await bookingRequestsStore.get(breq.id)) ?? breq;
    const finPreview = computeBookingRequestFinancials(breqAfterCb, offer);
    const isCsOrAdmin = req.auth!.role === "cs" || req.auth!.role === "legal" || req.auth!.role === "admin" || req.auth!.role === "cs_director";
    const clinicTake = breqAfterCb.sessionPriceKwd && parseFloat(breqAfterCb.sessionPriceKwd) > 0 ? breqAfterCb.sessionPriceKwd : finPreview.clinicTakeKwd;
    const cashbackUsed = breqAfterCb.cashbackDeductedKwd && parseFloat(breqAfterCb.cashbackDeductedKwd) > 0 ? breqAfterCb.cashbackDeductedKwd : finPreview.cashbackDeductedKwd;

    const updated = await bookingRequestsStore.update(breq.id, {
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedBy: req.auth!.userId,
      scheduledSessionId: session.id,
      proposedAt: parsed.data.scheduledAt,
      sessionPriceKwd: clinicTake,
      cashbackDeductedKwd: cashbackUsed,
      clinicPaymentStatus: isCsOrAdmin ? "paid" : "pending",
      ...(isCsOrAdmin
        ? { clinicPaymentMarkedAt: new Date().toISOString(), clinicPaymentMarkedBy: req.auth!.userId }
        : {}),
    });
    if (updated?.conversationId) {
      postSystemMessage(
        updated.conversationId,
        "booking_confirmed",
        `Booking confirmed for ${parsed.data.scheduledAt}.`,
        { bookingRequestId: updated.id, sessionId: session.id }
      );
    }
    notifyBookingConfirmed(uo.userId, session.id, session.scheduledAt);
    notifyChatRelatedUsers({
      userIds: [uo.userId],
      kind: "booking_confirmed",
      body: `Your booking is confirmed for ${parsed.data.scheduledAt}`,
      payload: { sessionId: session.id }
    });
    return res.status(201).json({ session, request: updated });
  }
);

// ── Clinic schedule view (Mongo-aware) ─────────────────────────────────────
schedulingRouter.get("/clinic/:clinicId/schedule", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = typeof req.query.to === "string" ? req.query.to : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = await sessionsStore.listByClinic(req.params.clinicId, from, to);

    if (sessions.length === 0) return res.json({ items: [] });

    // ── Collect unique IDs for batch lookups ─────────────────────────────
    const uniqueUserIds       = [...new Set(sessions.map(s => s.userId))];
    const uniqueUserOfferIds  = [...new Set(sessions.map(s => s.userOfferId).filter(id => mongoose.isValidObjectId(id)))];
    const validSessionIds     = sessions.map(s => s.id).filter(id => mongoose.isValidObjectId(id));

    // ── Round 1: 4 parallel batch queries ────────────────────────────────
    const [userDocs, userOfferDocs, breqDocs, lastCompletedAgg] = await Promise.all([
      // 1. All users in one query
      uniqueUserIds.length > 0
        ? UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()
        : Promise.resolve([]),
      // 2. All UserOffers in one query
      uniqueUserOfferIds.length > 0
        ? UserOfferModel.find({ _id: { $in: uniqueUserOfferIds } }).lean()
        : Promise.resolve([]),
      // 3. All BookingRequests by scheduledSessionId in one query
      validSessionIds.length > 0
        ? BookingRequestModel.find({ scheduledSessionId: { $in: validSessionIds } })
            .select("_id scheduledSessionId clinicPaymentStatus sessionPriceKwd cashbackDeductedKwd isStandalone membershipType").lean()
        : Promise.resolve([]),
      // 4. Last completed session per userOffer — one aggregate instead of N findOne queries
      uniqueUserOfferIds.length > 0
        ? BookingSessionModel.aggregate([
            { $match: { userOfferId: { $in: uniqueUserOfferIds }, status: "completed", completedAt: { $exists: true } } },
            { $sort: { completedAt: -1 } },
            { $group: { _id: "$userOfferId", completedAt: { $first: "$completedAt" } } }
          ])
        : Promise.resolve([]),
    ]);

    const userMap        = new Map((userDocs as any[]).map(u => [u._id.toString(), u]));
    const uoMap          = new Map((userOfferDocs as any[]).map(uo => [uo._id.toString(), uo]));
    const breqBySession  = new Map((breqDocs as any[]).map(b => [b.scheduledSessionId?.toString(), b]));
    const lastCompletedMap = new Map((lastCompletedAgg as any[]).map(d => [d._id?.toString(), d.completedAt as Date | null]));

    // ── Round 2: batch-fetch offers (need uoMap first for offerIds) ───────
    const uniqueOfferIds = [...new Set((userOfferDocs as any[]).map(uo => uo.offerId?.toString()).filter(Boolean))];
    const offerDocs = uniqueOfferIds.length > 0
      ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean()
      : [];
    const offerMap = new Map((offerDocs as any[]).map(o => [o._id.toString(), o]));

    // ── Build response — pure in-memory, zero additional DB calls ─────────
    const items = sessions.map((s) => {
      const uoDoc    = mongoose.isValidObjectId(s.userOfferId) ? uoMap.get(s.userOfferId) : null;
      const offerDoc = uoDoc ? offerMap.get(uoDoc.offerId?.toString()) : null;
      const breq     = breqBySession.get(s.id);
      const lastCompleted = uoDoc ? lastCompletedMap.get(uoDoc._id.toString()) ?? null : null;

      const intervalDays = (offerDoc?.sessionIntervalDays ?? 0) as number;
      const intervalMet =
        !lastCompleted || intervalDays === 0
          ? true
          : new Date(s.scheduledAt) >= new Date(new Date(lastCompleted).getTime() + intervalDays * 24 * 60 * 60 * 1000);

      const user = userMap.get(s.userId);
      return {
        ...s,
        customerName: (user as any)?.fullName ?? null,
        customerPhone: (user as any)?.phone ?? null,
        offerName: breq?.standaloneName ?? (offerDoc as any)?.name ?? null,
        bookingRequestId: breq?._id?.toString() ?? null,
        clinicPaymentStatus: breq?.clinicPaymentStatus ?? "pending",
        sessionPriceKwd: breq?.sessionPriceKwd ?? null,
        cashbackDeductedKwd: breq?.cashbackDeductedKwd ?? null,
        membershipType: breq?.membershipType ?? uoDoc?.membershipType ?? "none",
        isStandalone: breq?.isStandalone ?? false,
        eligibility: {
          offerActive: uoDoc?.status === "active",
          paymentConfirmed: uoDoc?.status === "active",
          intervalMet,
        },
      };
    });

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ── Clinic marks a session status (Mongo-aware) ────────────────────────────
schedulingRouter.post("/clinic/sessions/:sessionId/mark", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const parsed = MarkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const session = await sessionsStore.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });

    const uo = await loadUserOffer(session.userOfferId);
    if (!uo || uo.status !== "active") return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });

    const offer = await loadOffer(uo.offerId);
    if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });

    let cashbackUnlocked = "0.000";
    if (parsed.data.status === "completed") {
      // sessionsUsed was already incremented at confirm time; just unlock cashback here
      cashbackUnlocked = offer.cashbackPerSessionKwd ?? "0.000";
      
      if (parseFloat(cashbackUnlocked) > 0) {
        await kycStore.rewardSessionCashback({
          userId: uo.userId,
          amountKwd: cashbackUnlocked,
          sessionId: session.id,
          createdById: "system"
        });
      }
    }

    if (parsed.data.status === "completed" && parsed.data.cashbackToDeductKwd && parseFloat(parsed.data.cashbackToDeductKwd) > 0) {
      const deductionAmount = parseFloat(parsed.data.cashbackToDeductKwd);
      const resAdjust = await kycStore.deductUnlocked({
        userId: session.userId,
        amountKwd: deductionAmount.toFixed(3),
        reference: { kind: "session", id: session.id },
        createdBy: { kind: "admin", id: req.auth!.userId }
      });
      if ("error" in resAdjust) {
        return res.status(400).json({ error: resAdjust.error });
      }
      if (session.userOfferId && mongoose.isValidObjectId(session.userOfferId)) {
        const uoDoc = await UserOfferModel.findById(session.userOfferId);
        if (uoDoc && uoDoc.cashbackBalanceKwd) {
          const oldBal = parseFloat(uoDoc.cashbackBalanceKwd);
          const newBal = Math.max(0, oldBal - deductionAmount);
          await UserOfferModel.findByIdAndUpdate(uoDoc._id, { $set: { cashbackBalanceKwd: newBal.toFixed(3) } });
        }
      }
    }

    let totalBillKwd: string | undefined;
    let finalPaidKwd: string | undefined;
    if (parsed.data.status === "completed") {
       const extraSum = parsed.data.extraItems?.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0) || 0;
       totalBillKwd = extraSum.toFixed(3);
       const cbDeduct = parseFloat(parsed.data.cashbackToDeductKwd || "0");
       finalPaidKwd = Math.max(0, extraSum - cbDeduct).toFixed(3);
    }

    const updated = await sessionsStore.mark({
      sessionId: session.id,
      status: parsed.data.status,
      markedBy: req.auth!.userId,
      notes: parsed.data.notes,
      cashbackUnlockedKwd: parsed.data.status === "completed" ? cashbackUnlocked : undefined,
      extraItems: parsed.data.extraItems,
      totalBillKwd,
      finalPaidKwd
    });

    if (updated?.status === "completed") {
      notifySessionCompletedCashback(uo.userId, updated.id, cashbackUnlocked);
    }
    if (updated?.status === "cancelled") {
    if (session.userOfferId && mongoose.isValidObjectId(session.userOfferId)) {
      await UserOfferModel.findOneAndUpdate(
        { _id: session.userOfferId, sessionsUsed: { $gt: 0 } },
        { $inc: { sessionsUsed: -1 } }
      );
    }
    const breq = await bookingRequestsStore.findBySessionId(session.id);
    const csIds = await findCsUserIds();
    const financeIds = await findFinanceUserIds();
    notifyChatRelatedUsers({
      userIds: Array.from(new Set([...csIds, ...financeIds])),
      kind: "booking_cancelled",
      body: `Clinic cancelled session ${session.id}. Session quota restored for customer.`,
      payload: { bookingRequestId: breq?.id, sessionId: session.id }
    });
      notifyBookingCancelled(uo.userId, updated.id);
    }
    return res.json({ session: updated });
  } catch (e) {
    next(e);
  }
});

// ── Clinic staff: customer context for a booking request ──────────────────
schedulingRouter.get("/clinic/requests/:id/customer-context", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });

    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    const uo = await loadUserOffer(breq.userOfferId!);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    const offer = await loadOffer(uo.offerId);
    const wallet = await kycStore.getWallet(uo.userId);

    let paymentLabel: string;
    if (uo.purchaseMode === "installments") {
      const paid = uo.installmentsPaid ?? 0;
      const total = uo.installmentCount ?? 0;
      paymentLabel = total > 0 ? `installments (${paid}/${total} paid)` : "installments";
    } else if (uo.purchaseMode === "deposit") {
      paymentLabel = uo.status === "reserved" ? "deposit reserved" : "deposit paid";
    } else {
      paymentLabel = uo.status === "active" ? "paid in full" : uo.status;
    }

    return res.json({
      context: {
        paymentMode: uo.purchaseMode ?? "full",
        paymentLabel,
        paymentStatus: uo.status,
        installmentsPaid: uo.installmentsPaid ?? null,
        installmentCount: uo.installmentCount ?? null,
        sessionsUsed: uo.sessionsUsed ?? 0,
        maxSessions: offer?.maxSessions ?? null,
        cashbackUnlockedKwd: wallet?.unlockedKwd ?? "0.000",
        cashbackLockedKwd: wallet?.lockedKwd ?? "0.000"
      }
    });
  } catch (e) {
    next(e);
  }
});

// ── Clinic staff: reschedule a confirmed session ────────────────────────────
const RescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  notes: z.string().optional()
});

schedulingRouter.post("/clinic/sessions/:sessionId/reschedule", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = RescheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const session = await sessionsStore.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });

    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, session.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    if (session.status !== "scheduled") {
      return res.status(409).json({ error: "INVALID_STATE", detail: "Only scheduled sessions can be rescheduled" });
    }

    if (parsed.data.scheduledAt !== session.scheduledAt && await sessionsStore.isSlotTaken(session.clinicId, parsed.data.scheduledAt)) {
      return res.status(409).json({ error: "SLOT_TAKEN" });
    }

    const updated = await sessionsStore.reschedule({
      sessionId: session.id,
      scheduledAt: parsed.data.scheduledAt,
      rescheduledBy: req.auth!.userId,
      notes: parsed.data.notes
    });

    const breq = await bookingRequestsStore.findBySessionId(session.id);
    if (breq?.conversationId) {
      postSystemMessage(
        breq.conversationId,
        "slot_proposed",
        `Session rescheduled to ${parsed.data.scheduledAt}${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
        { sessionId: session.id, scheduledAt: parsed.data.scheduledAt },
        req.auth!.userId
      );
    }

    notifyChatRelatedUsers({
      userIds: [session.userId],
      kind: "booking_slot_proposed",
      body: `Your session has been rescheduled to ${parsed.data.scheduledAt}`,
      payload: { sessionId: session.id }
    });

    return res.json({ session: updated });
  } catch (e) {
    next(e);
  }
});

// ── Admin overview of all booking requests ────────────────────────────────
schedulingRouter.get("/admin/requests", authRequired, requireRole(["admin"]), async (req, res) => {
  const status = (typeof req.query.status === "string" ? req.query.status : "all") as BookingRequestStatus | "all" | "open";
  const clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
  const items = await bookingRequestsStore.list({ status, clinicId });
  const enriched = await Promise.all(
    items.map(async (it) => {
      const c = await getClinicNames(it.clinicId);
      return { ...it, clinicNameEn: c.nameEn, clinicNameAr: c.nameAr };
    })
  );
  return res.json({ items: enriched });
});

// ── Admin / CS: manually adjust sessionsUsed on a membership ────────────────
schedulingRouter.post("/admin/user-offers/:uoId/adjust-sessions", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const delta = typeof req.body?.delta === "number" ? Math.round(req.body.delta) : 0;
    const dateStr = typeof req.body?.date === "string" ? req.body.date : null;
    
    if (delta === 0 || Math.abs(delta) > 1) return res.status(400).json({ error: "INVALID_DELTA" });
    if (!mongoose.isValidObjectId(req.params.uoId)) return res.status(400).json({ error: "INVALID_ID" });

    const uo = await UserOfferModel.findById(req.params.uoId).lean();
    if (!uo) return res.status(404).json({ error: "NOT_FOUND" });

    const current = (uo as any).sessionsUsed ?? 0;
    const nextVal = Math.max(0, current + delta);
    if (nextVal === current) return res.json({ ok: true, sessionsUsed: current });

    await UserOfferModel.findByIdAndUpdate(req.params.uoId, { $set: { sessionsUsed: nextVal } });

    if (delta > 0 && dateStr) {
      let clinicId = (uo as any).clinicId;
      if (!clinicId) {
        const { ClinicModel } = await import("../../models/clinic.model.js");
        const defaultClinic = await ClinicModel.findOne().lean();
        clinicId = (defaultClinic as any)?._id;
      }
      
      if (clinicId) {
        await BookingSessionModel.create({
          userId: (uo as any).userId,
          offerId: (uo as any).offerId,
          userOfferId: req.params.uoId,
          clinicId: clinicId,
          status: "completed",
          scheduledAt: new Date(dateStr),
          completedAt: new Date(dateStr),
          scheduledBy: req.auth!.userId,
          notes: "Historical/Manual session increment"
        });
      }
    }

    return res.json({ ok: true, sessionsUsed: nextVal });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.post("/admin/grant-session", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      clinicId: z.string().min(1),
      treatmentName: z.string().min(1),
      isPaid: z.boolean().default(false),
      priceKwd: z.string().default("0.000"),
      scheduledAt: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { userId, clinicId, treatmentName, isPaid, priceKwd, scheduledAt } = parsed.data;

    let offer = await OfferModel.findOne({ name: treatmentName, status: "hidden", offerKind: "treatment" });
    if (!offer) {
      offer = await OfferModel.create({
        name: treatmentName,
        type: "A",
        offerKind: "treatment",
        status: "hidden",
        active: true,
        maxSessions: 1,
        subscriptionPriceKwd: priceKwd,
        category: "all"
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const uo = await UserOfferModel.create({
      userId,
      offerId: offer._id,
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
      purchaseMode: "full",
      isStandalone: true,
      sessionsUsed: 0,
      activatedAt: now,
      expiresAt,
      paymentAmountKwd: priceKwd,
      paymentMethod: isPaid ? "cash" : "free",
      paymentConfirmedBy: req.auth!.userId,
      paymentConfirmedAt: now
    });

    const schedDate = scheduledAt ? new Date(scheduledAt) : now;
    const session = await BookingSessionModel.create({
      userOfferId: uo._id,
      userId,
      offerId: offer._id,
      clinicId: new mongoose.Types.ObjectId(clinicId),
      scheduledAt: schedDate,
      status: "scheduled",
      scheduledBy: req.auth!.userId,
    });

    return res.status(201).json({ ok: true, userOfferId: String(uo._id), sessionId: String(session._id) });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.post("/admin/sessions/:sessionId/change-clinic", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      clinicId: z.string().min(1),
      isPaid: z.boolean().default(false),
      feeAmount: z.string().default("5.000")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { clinicId, isPaid, feeAmount } = parsed.data;
    if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });

    const session = await BookingSessionModel.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "SESSION_NOT_FOUND" });

    if (isPaid) {
      const resAdjust = await kycStore.adjustUnlocked({
        userId: session.userId,
        amountKwd: `-${feeAmount}`,
        reason: `Clinic change fee for session: ${session.shortId || session._id}`,
        createdById: req.auth!.userId
      });
      if (resAdjust && "error" in resAdjust) {
        if (resAdjust.error === "UNLOCKED_BELOW_ZERO") {
          return res.status(400).json({ error: "INSUFFICIENT_FUNDS" });
        }
        return res.status(400).json({ error: resAdjust.error });
      }
    }

    session.clinicId = new mongoose.Types.ObjectId(clinicId);
    await session.save();

    return res.json({ ok: true, clinicId: String(session.clinicId) });
  } catch (e) {
    next(e);
  }
});

schedulingRouter.post("/admin/requests/:requestId/change-clinic", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      clinicId: z.string().min(1),
      isPaid: z.boolean().default(false),
      feeAmount: z.string().default("5.000")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { clinicId, isPaid, feeAmount } = parsed.data;
    if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });

    const breq = await BookingRequestModel.findById(req.params.requestId);
    if (!breq) return res.status(404).json({ error: "REQUEST_NOT_FOUND" });

    if (isPaid) {
      const resAdjust = await kycStore.adjustUnlocked({
        userId: breq.userId,
        amountKwd: `-${feeAmount}`,
        reason: `Clinic change fee for booking request: ${breq.shortId || breq._id}`,
        createdById: req.auth!.userId
      });
      if (resAdjust && "error" in resAdjust) {
        if (resAdjust.error === "UNLOCKED_BELOW_ZERO") {
          return res.status(400).json({ error: "INSUFFICIENT_FUNDS" });
        }
        return res.status(400).json({ error: resAdjust.error });
      }
    }

    breq.clinicId = new mongoose.Types.ObjectId(clinicId);
    await breq.save();

    return res.json({ ok: true, clinicId: String(breq.clinicId) });
  } catch (e) {
    next(e);
  }
});

// `resolveUserOffer` retained for backwards compatibility — exposed for any
// downstream callers that depend on the richer UserOfferRecord shape.
export { resolveUserOffer };
