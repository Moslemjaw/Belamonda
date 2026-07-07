import mongoose from "mongoose";
import { UserOfferModel, type UserOfferDoc } from "../models/userOffer.model.js";
import { OfferModel } from "../models/offer.model.js";
import { serializeUserOffer } from "../utils/serialize.js";
import { deriveMembershipType } from "./offer.service.js";

function kwdMils(s: string | undefined): number {
  if (!s) return 0;
  const [a, b = "000"] = String(s).split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

/**
 * After activation, copy offer.membershipType and seed cashback session budget for TYPE-1 offers.
 */
export async function applyOfferMembershipToUserOffer(userOfferId: string, offerId: string) {
  if (!mongoose.isValidObjectId(userOfferId) || !mongoose.isValidObjectId(offerId)) return;
  const offer = await OfferModel.findById(offerId).lean() as any;
  if (!offer) return;
  const currentUo = await UserOfferModel.findById(userOfferId).lean() as any;
  const branch = (offer.branchSessionPrices ?? []).map((b: any) => ({
    clinicId: String(b.clinicId),
    sessionPriceKwd: String(b.sessionPriceKwd)
  }));
  const mt =
    offer.membershipType ||
    deriveMembershipType({
      isGroupOffer: offer.isGroupOffer,
      isCashbackOnly: offer.isCashbackOnly,
      signupCashbackKwd: offer.signupCashbackKwd,
      cashbackPerSessionKwd: offer.cashbackPerSessionKwd,
      payPerSession: offer.payPerSession,
      branchSessionPrices: branch,
      maxSessions: offer.maxSessions ?? undefined
    });
  const extra: Record<string, unknown> = {};
  if (mt) extra.membershipType = mt;
  if (mt === "cashback") {
    const signup = offer.signupCashbackKwd ?? "0.000";
    // Removed eager cashbackBalanceKwd initialization.
    // It is now handled correctly by grantCashbackForPayment during checkout and installment payments.
  }
  // Store total signup cashback for per-installment tracking
  const signupCb = offer.signupCashbackKwd ?? "0.000";
  if (kwdMils(signupCb) > 0) {
    extra.totalSignupCashbackKwd = signupCb;
  }
  if (Object.keys(extra).length) {
    await UserOfferModel.findByIdAndUpdate(userOfferId, { $set: extra });
  }
}

async function attachOfferNames<T extends { offerId: string }>(
  rows: T[]
): Promise<(T & { offerName?: string; offerCategory?: string; cashbackPerSessionKwd?: string; isCashbackOnly?: boolean; signupCashbackKwd?: string })[]> {
  const ids = Array.from(new Set(rows.map((r) => r.offerId).filter((s) => mongoose.isValidObjectId(s))));
  if (!ids.length) return rows;
  const offers = await OfferModel.find({ _id: { $in: ids } })
    .select("_id name category cashbackPerSessionKwd isCashbackOnly signupCashbackKwd")
    .lean();
  const map = new Map(offers.map((o) => [String(o._id), o as any]));
  return rows.map((r) => {
    const o = map.get(r.offerId);
    return {
      ...r,
      offerName: o?.name,
      offerCategory: o?.category,
      cashbackPerSessionKwd: o?.cashbackPerSessionKwd ?? "0.000",
      isCashbackOnly: o?.isCashbackOnly ?? false,
      signupCashbackKwd: o?.signupCashbackKwd ?? "0.000",
    };
  });
}

export async function expireStalePendingPayments(): Promise<void> {
  await UserOfferModel.updateMany(
    { status: "pending_payment", pendingExpiresAt: { $lt: new Date() } },
    { $set: { status: "expired" }, $unset: { pendingExpiresAt: 1 } }
  );
}

export async function createPending(input: { userId: string; offerId: string; clinicId: string }) {
  await expireStalePendingPayments();
  const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const doc = await UserOfferModel.create({
    userId: input.userId,
    offerId: new mongoose.Types.ObjectId(input.offerId),
    clinicId: new mongoose.Types.ObjectId(input.clinicId),
    status: "pending_payment",
    pendingExpiresAt,
    sessionsUsed: 0
  });
  return serializeUserOffer(doc.toObject() as any);
}

export async function getUserOffer(id: string) {
  await expireStalePendingPayments();
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await UserOfferModel.findById(id).lean();
  return doc ? serializeUserOffer(doc as any) : null;
}

export async function listUserOffersByUser(userId: string) {
  await expireStalePendingPayments();
  const rows = await UserOfferModel.find({ userId }).sort({ createdAt: -1 }).lean();
  const serialized = rows.map((r) => serializeUserOffer(r as any));
  return attachOfferNames(serialized);
}

export async function listPendingPaymentsQueue() {
  await expireStalePendingPayments();
  const rows = await UserOfferModel.find({ 
    status: "pending_payment",
    paymentMethod: { $exists: true, $ne: null }
  }).sort({ createdAt: 1 }).lean();
  return rows.map((r) => serializeUserOffer(r as any));
}

export async function countActiveAndPendingForOffer(offerId: string) {
  await expireStalePendingPayments();
  if (!mongoose.isValidObjectId(offerId)) return 0;
  return UserOfferModel.countDocuments({
    offerId: new mongoose.Types.ObjectId(offerId),
    status: { $in: ["pending_payment", "active"] }
  });
}

export async function confirmPaymentAndActivate(input: {
  userOfferId: string;
  confirmedBy: string;
  proofRef: string;
  method: string;
  amountKwd: string;
  activatedAt: string;
  expiresAt: string;
  paymentId: string;
}) {
  await expireStalePendingPayments();
  if (!mongoose.isValidObjectId(input.userOfferId)) return null;

  const doc = await UserOfferModel.findOne({ _id: input.userOfferId, status: "pending_payment" }).lean() as any;
  if (!doc) {
    const exists = await UserOfferModel.findById(input.userOfferId).lean();
    if (!exists) return null;
    return { error: "NOT_PENDING" as const };
  }

  const updates: any = {
    $unset: { pendingExpiresAt: "" }
  };

  if (doc.purchaseMode === "installments") {
    const schedule = [...(doc.installmentSchedule || [])];
    const paidSoFar = doc.installmentsPaid ?? 0;
    const idx = paidSoFar;
    if (schedule[idx]) {
      schedule[idx].paid = true;
      schedule[idx].paidAt = new Date();
      schedule[idx].paymentId = new mongoose.Types.ObjectId(input.paymentId);
    }
    const newPaid = paidSoFar + 1;
    updates.$set = {
      status: "active",
      paymentConfirmedBy: input.confirmedBy,
      paymentConfirmedAt: new Date(),
      paymentProofRef: input.proofRef,
      paymentMethod: input.method,
      paymentAmountKwd: input.amountKwd,
      activatedAt: doc.activatedAt || new Date(input.activatedAt),
      expiresAt: doc.expiresAt || new Date(input.expiresAt),
      paymentId: new mongoose.Types.ObjectId(input.paymentId),
      installmentsPaid: newPaid,
      installmentSchedule: schedule,
      nextInstallmentDueAt: schedule[newPaid]?.dueDate || null
    };
  } else if (doc.purchaseMode === "deposit") {
    updates.$set = {
      status: "reserved",
      depositPaidAt: new Date(),
      depositPaymentId: new mongoose.Types.ObjectId(input.paymentId),
      paymentMethod: input.method
    };
  } else {
    // "full" or empty
    updates.$set = {
      status: "active",
      paymentConfirmedBy: input.confirmedBy,
      paymentConfirmedAt: new Date(),
      paymentProofRef: input.proofRef,
      paymentMethod: input.method,
      paymentAmountKwd: input.amountKwd,
      activatedAt: new Date(input.activatedAt),
      expiresAt: new Date(input.expiresAt),
      paymentId: new mongoose.Types.ObjectId(input.paymentId)
    };
  }

  const updated = await UserOfferModel.findByIdAndUpdate(
    input.userOfferId,
    updates,
    { new: true }
  ).lean();

  return updated ? serializeUserOffer(updated as any) : null;
}

export async function incrementSessionsUsed(userOfferId: string) {
  if (!mongoose.isValidObjectId(userOfferId)) return null;
  const doc = await UserOfferModel.findByIdAndUpdate(
    userOfferId,
    { $inc: { sessionsUsed: 1 } },
    { new: true }
  ).lean();
  return doc ? serializeUserOffer(doc as any) : null;
}

let _userOffersPromise: Promise<any[]> | null = null;
let _userOffersCache: { data: any[]; ts: number } | null = null;
const USER_OFFERS_TTL = 30_000;

export async function listAllUserOffers() {
  if (_userOffersCache && Date.now() - _userOffersCache.ts < USER_OFFERS_TTL) {
    return _userOffersCache.data;
  }
  if (_userOffersPromise) return _userOffersPromise;

  const promise = (async () => {
    await expireStalePendingPayments();
    const rows = await UserOfferModel.find({}).sort({ createdAt: -1 }).lean();
    const serialized = rows.map((r) => serializeUserOffer(r as any));
    const result = await attachOfferNames(serialized);
    _userOffersCache = { data: result, ts: Date.now() };
    _userOffersPromise = null;
    return result;
  })();

  _userOffersPromise = promise;
  return promise;
}

export async function deleteUserOffer(id: string): Promise<"ok" | "not_found" | "already_cancelled"> {
  if (!mongoose.isValidObjectId(id)) return "not_found";
  const doc = await UserOfferModel.findById(id).lean<UserOfferDoc | null>();
  if (!doc) return "not_found";

  // Check for cashback to reverse
  const { WalletModel, WalletTxnModel } = await import("../models/kyc.model.js");
  
  const walletTxns = await WalletTxnModel.find({
    userId: doc.userId,
    $or: [
      { "reference.id": id },
      { "reference.id": new RegExp(`^${id}_inst_`) }
    ]
  }).lean();

  if (walletTxns.length > 0) {
    const idsToDelete = walletTxns.map(t => t._id);
    await WalletTxnModel.deleteMany({ _id: { $in: idsToDelete } });
    
    // Recalculate wallet for the user
    const wallet = await WalletModel.findOne({ userId: doc.userId });
    if (wallet) {
      const allTxns = await WalletTxnModel.find({ userId: doc.userId }).sort({ createdAt: 1 }).lean();
      let ceiling = 0, locked = 0, unlocked = 0;
      for (const txn of allTxns as any[]) {
        const amt = typeof txn.amountKwd === "string" ? kwdMils(txn.amountKwd) : 0;
        switch (txn.type) {
          case "offer_cashback_credit":
            locked += amt; ceiling += amt; break;
          case "installment_unlock":
          case "signup_bonus":
          case "unlock":
            locked -= amt; unlocked += amt; break;
          case "deduction":
            unlocked -= amt; break;
          case "adjustment":
            unlocked += amt; break;
          case "session_reward":
          case "invoice_reward":
            unlocked += amt; ceiling += amt; break;
        }
      }
      wallet.lockedKwd = (Math.max(0, locked) / 1000).toFixed(3);
      wallet.unlockedKwd = (Math.max(0, unlocked) / 1000).toFixed(3);
      wallet.ceilingKwd = (Math.max(0, ceiling) / 1000).toFixed(3);
      await wallet.save();
    }
  }

  const { BookingRequestModel } = await import("../models/bookingRequest.model.js");
  const { BookingSessionModel } = await import("../models/bookingSession.model.js");
  const { PaymentModel } = await import("../models/payment.model.js");
  const { ClinicChangeRequestModel } = await import("../models/clinicChangeRequest.model.js");

  await BookingRequestModel.deleteMany({ userOfferId: id });
  await BookingSessionModel.deleteMany({ userOfferId: id });
  await PaymentModel.deleteMany({ userOfferId: id });
  await ClinicChangeRequestModel.deleteMany({ userOfferId: id });

  await UserOfferModel.findByIdAndDelete(id);
  return "ok";
}

export async function listDepositReservationsByUser(userId: string) {
  const rows = await UserOfferModel.find({
    userId,
    depositPaymentId: { $exists: true }
  }).sort({ createdAt: -1 }).lean();
  const serialized = rows.map((r) => serializeUserOffer(r as any));
  return attachOfferNames(serialized);
}

export async function listAllDepositReservations() {
  const rows = await UserOfferModel.find({
    depositPaymentId: { $exists: true }
  }).sort({ createdAt: -1 }).lean();
  const serialized = rows.map((r) => serializeUserOffer(r as any));
  return attachOfferNames(serialized);
}
