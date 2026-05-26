import mongoose from "mongoose";
import { OfferModel, type OfferDoc } from "../models/offer.model.js";
import { UserOfferModel, type UserOfferDoc } from "../models/userOffer.model.js";
import { PaymentModel } from "../models/payment.model.js";
import { EFormModel, EFormSubmissionModel } from "../models/eform.model.js";
import { ClinicModel, type ClinicDoc } from "../models/clinic.model.js";

type InstallmentEntry = {
  number: number;
  amountKwd: string;
  dueDate?: Date | null;
  paid: boolean;
  paidAt?: Date | null;
  paymentId?: mongoose.Types.ObjectId | null;
};
type HttpError = Error & { status: number; code: string };
import { kycStore } from "../modules/kyc/kyc.store.js";
import { listRequiredFormsForUser } from "../modules/eforms/eforms.router.js";
import { serializeUserOffer, serializePayment } from "../utils/serialize.js";
import { applyOfferMembershipToUserOffer } from "./userOffer.service.js";
import { getProviderForMethod } from "./paymentProvider.service.js";
import {
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyEnetApproved,
  notifyEnetRejected,
  notifyDepositReserved,
  notifyInstallmentPaid,
  notifyMembershipActivated
} from "../modules/notifications/notifications.service.js";

// ---- KWD math helpers (mils) ----
function mils(s: string): number {
  if (!s) return 0;
  const [a, b = "000"] = s.split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}
function fmt(m: number): string {
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
}

function isWithinWindow(
  o: { startDate?: Date | null; endDate?: Date | null; offerExpirationDate?: Date | null },
  now: Date
) {
  if (o.startDate && now < new Date(o.startDate)) return false;
  if (o.endDate && now > new Date(o.endDate)) return false;
  if (o.offerExpirationDate && now > new Date(o.offerExpirationDate)) return false;
  return true;
}

async function loadOfferOrThrow(offerId: string): Promise<OfferDoc> {
  if (!mongoose.isValidObjectId(offerId)) throw httpErr(400, "INVALID_OFFER_ID");
  const offer = await OfferModel.findById(offerId).lean<OfferDoc | null>();
  if (!offer) throw httpErr(404, "OFFER_NOT_FOUND");
  if (!offer.active) throw httpErr(400, "OFFER_INACTIVE");
  if (!isWithinWindow(offer, new Date())) throw httpErr(400, "OFFER_OUTSIDE_WINDOW");

  return offer;
}

/** Branches where this membership may be redeemed (primary + additional). */
export function allowedPurchaseClinicIds(offer: { clinicId?: unknown; clinicIds?: unknown }): string[] {
  const s = new Set<string>();
  if (offer.clinicId) s.add(String(offer.clinicId));
  const extras = (offer as { clinicIds?: unknown[] }).clinicIds;
  if (Array.isArray(extras)) {
    for (const x of extras) {
      if (x) s.add(String(x));
    }
  }
  return [...s];
}

/**
 * Resolves the clinic locked in at purchase.
 *
 * - clinicLocked === true   →  customer picks ANY active clinic at checkout; their choice is then
 *                              locked in. Future changes require escalating CS-approved fees.
 * - clinicLocked === false  →  customer picks ANY active clinic; they can switch freely (no fee).
 * - clinicLocked undefined  →  legacy behaviour — customer must pick from the offer's allowed list.
 */
export function resolvePurchaseClinicObjectId(
  offer: { clinicId?: unknown; clinicIds?: unknown; clinicLocked?: unknown; requireBranchSelection?: unknown },
  inputClinicId?: string
): mongoose.Types.ObjectId | undefined {
  // No branch selection required — use the offer's primary clinicId automatically.
  if (offer.requireBranchSelection === false) {
    const id = offer.clinicId;
    if (!id || !mongoose.isValidObjectId(String(id))) return undefined;
    return new mongoose.Types.ObjectId(String(id));
  }

  // Both locked and unlocked new-style offers: customer picks any clinic — validate it's a real ObjectId.
  if (offer.clinicLocked === true || offer.clinicLocked === false) {
    if (!inputClinicId || !mongoose.isValidObjectId(inputClinicId)) {
      throw httpErr(400, "CLINIC_CHOICE_REQUIRED");
    }
    return new mongoose.Types.ObjectId(inputClinicId);
  }

  // Legacy offers (clinicLocked undefined): customer must pick from the offer's allowed list.
  const allowed = allowedPurchaseClinicIds(offer);
  if (!allowed.length) throw httpErr(400, "OFFER_MISSING_CLINIC");
  if (allowed.length === 1) {
    const only = allowed[0];
    if (inputClinicId && String(inputClinicId) !== only) {
      throw httpErr(400, "CLINIC_NOT_ALLOWED_FOR_OFFER");
    }
    return new mongoose.Types.ObjectId(only);
  }
  if (!inputClinicId || !mongoose.isValidObjectId(inputClinicId)) {
    throw httpErr(400, "CLINIC_CHOICE_REQUIRED");
  }
  if (!allowed.includes(String(inputClinicId))) throw httpErr(400, "CLINIC_NOT_ALLOWED_FOR_OFFER");
  return new mongoose.Types.ObjectId(inputClinicId);
}

/** Resolves the effective membership price, preferring the branch-specific override if one exists. */
export function getEffectiveSubscriptionPrice(offer: OfferDoc, clinicId?: unknown): string {
  if (clinicId && Array.isArray((offer as any).branchSubscriptionPrices)) {
    const override = (offer as any).branchSubscriptionPrices.find((b: any) => b.clinicId === String(clinicId));
    if (override) return override.priceKwd;
  }
  return offer.subscriptionPriceKwd;
}


/** Customer must be KYC-approved before purchasing. */
async function assertCustomerCanPurchase(userId: string) {
  const user = await kycStore.getUser(userId);
  if (!user || user.verificationStatus !== "approved") {
    throw httpErr(403, "KYC_REQUIRED");
  }
}

/** Cap concurrent active/pending purchases of the same offer per user (1). */
async function assertNotAlreadyEnrolled(userId: string, offerId: string, excludeUserOfferId?: string) {
  const query: any = {
    userId,
    offerId: new mongoose.Types.ObjectId(offerId),
    status: { $in: ["pending_payment", "active", "reserved", "enet_pending"] }
  };
  if (excludeUserOfferId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeUserOfferId) };
  }
  const existing = await UserOfferModel.countDocuments(query);
  if (existing > 0) throw httpErr(409, "ALREADY_ENROLLED");
}

/** Enforce per-offer global enrollmentCap when configured. */
async function assertEnrollmentCap(offer: OfferDoc | null | undefined, offerId: string, excludeUserOfferId?: string) {
  const cap = offer?.enrollmentCap;
  if (cap == null) return;
  const query: any = {
    offerId: new mongoose.Types.ObjectId(offerId),
    status: { $in: ["pending_payment", "active", "reserved", "enet_pending"] }
  };
  if (excludeUserOfferId) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeUserOfferId) };
  }
  const reserved = await UserOfferModel.countDocuments(query);
  if (reserved >= cap) throw httpErr(409, "ENROLLMENT_CAP_REACHED");
}

function httpErr(status: number, code: string, data?: any): HttpError {
  const e = new Error(code) as HttpError & { data?: any };
  e.status = status;
  e.code = code;
  if (data) e.data = data;
  return e;
}

async function assertRequiredEForm(userId: string, eFormId?: string | mongoose.Types.ObjectId | null) {
  if (!eFormId) return;
  const formStr = String(eFormId);
  const form = await EFormModel.findById(formStr).lean();
  if (!form) return;
  
  const signed = await EFormSubmissionModel.exists({ formId: formStr, userId });
  if (!signed) {
    throw httpErr(409, "EFORMS_REQUIRED", { forms: [{ id: formStr, title: (form as any).title }] });
  }
}

async function assertNoPendingForms(userId: string, targets: Array<{ kind: string; refId: string }>, excludeIds: any[] = []) {
  let pending = await listRequiredFormsForUser(userId, targets, "first_payment");
  if (excludeIds.length > 0) {
    const excludeSet = new Set(excludeIds.filter(Boolean).map(String));
    pending = pending.filter(f => !excludeSet.has(String(f.id)));
  }
  if (pending.length > 0) {
    throw httpErr(409, "EFORMS_REQUIRED", { forms: pending });
  }
}

type CashbackPolicy = { eligible?: boolean; capKwd?: string | null };

/** Apply unlocked-cashback discount; returns { netAmountKwd, cashbackAppliedKwd }. */
async function applyCashback(
  grossKwd: string,
  requestedCashbackKwd: string,
  userId: string,
  policy: CashbackPolicy = {}
) {
  if (!requestedCashbackKwd || requestedCashbackKwd === "0.000") {
    return { netAmountKwd: grossKwd, cashbackAppliedKwd: "0.000", deduct: async () => {} };
  }
  if (policy.eligible === false) throw httpErr(400, "CASHBACK_NOT_ELIGIBLE");
  const wallet = await kycStore.getWallet(userId);
  if (!wallet) throw httpErr(409, "NO_WALLET");
  const available = mils(wallet.unlockedKwd);
  const requested = mils(requestedCashbackKwd);
  const gross = mils(grossKwd);
  const offerCap = policy.capKwd ? mils(policy.capKwd) : Number.POSITIVE_INFINITY;
  const applied = Math.max(0, Math.min(requested, available, gross, offerCap));
  const net = gross - applied;
  return {
    netAmountKwd: fmt(net),
    cashbackAppliedKwd: fmt(applied),
    deduct: async (refKind: "userOffer" | "session", refId: string) => {
      if (applied <= 0) return;
      await kycStore.deductUnlocked({
        userId,
        amountKwd: fmt(applied),
        reference: { kind: refKind, id: refId },
        createdBy: { kind: "cs", id: "system_checkout" }
      });
    }
  };
}

async function createPayment(input: {
  userId: string;
  offerId: string;
  userOfferId: string;
  amountKwd: string;
  cashbackAppliedKwd: string;
  grossAmountKwd: string;
  method: "card_mock" | "enet" | "bank_transfer" | "cash" | "pos" | "other" | string;
  purpose: "enrollment_full" | "installment" | "deposit" | "deposit_balance" | "enrollment_enet";
  provider: "mock" | "enet" | "manual" | string;
  providerRef: string;
  installmentNumber?: number;
  status: "completed" | "failed" | "pending";
  failureReason?: string;
}) {
  const doc = await PaymentModel.create({
    userId: input.userId,
    offerId: new mongoose.Types.ObjectId(input.offerId),
    userOfferId: new mongoose.Types.ObjectId(input.userOfferId),
    amountKwd: input.amountKwd,
    cashbackAppliedKwd: input.cashbackAppliedKwd,
    grossAmountKwd: input.grossAmountKwd,
    currency: "KWD",
    method: input.method,
    purpose: input.purpose,
    provider: input.provider,
    providerRef: input.providerRef,
    installmentNumber: input.installmentNumber,
    status: input.status,
    failureReason: input.failureReason,
    confirmedAt: input.status === "completed" ? new Date() : undefined,
    confirmedBy: input.status === "completed" ? "system_checkout" : undefined
  });
  return doc;
}

async function snapshotWalletToPayment(paymentId: mongoose.Types.ObjectId, userId: string) {
  const wallet = await kycStore.getWallet(userId);
  if (wallet) {
    await PaymentModel.findByIdAndUpdate(paymentId, { $set: { customerWalletBalanceAfterKwd: wallet.unlockedKwd } });
  }
}

function buildSchedule(perAmount: string, count: number, firstDueOffsetDays = 0, intervalDays = 30) {
  const sched = [];
  for (let i = 0; i < count; i++) {
    const due = new Date(Date.now() + (firstDueOffsetDays + i * intervalDays) * 24 * 60 * 60 * 1000);
    sched.push({ number: i + 1, amountKwd: perAmount, dueDate: due, paid: false });
  }
  return sched;
}

/**
 * Grant proportional cashback for a specific installment payment.
 *
 * Flow:
 *   1. On the FIRST installment (or full payment), credit the full cashback
 *      amount to the wallet's locked pool (increases locked + ceiling).
 *   2. Unlock `total / installmentCount` from locked → unlocked.
 *   3. Update the userOffer's `cashbackGrantedKwd` tracker.
 *
 * For full payment, call with installmentNumber=1, totalInstallments=1.
 */
async function grantCashbackForPayment(
  userId: string,
  offer: OfferDoc | { signupCashbackKwd?: string },
  userOfferId: string,
  installmentNumber: number,
  totalInstallments: number
) {
  const totalCashback = mils((offer as any).signupCashbackKwd ?? "0.000");
  if (totalCashback <= 0) return;

  // Step 1: Credit full amount to wallet locked pool on first payment
  if (installmentNumber === 1) {
    await kycStore.creditOfferCashback({
      userId,
      amountKwd: fmt(totalCashback),
      userOfferId,
      createdById: "system_checkout"
    });
  }

  // Step 2: Calculate this installment's proportional share
  const perInstallment = Math.floor(totalCashback / totalInstallments);
  const remainder = totalCashback - perInstallment * totalInstallments;
  // First installment absorbs rounding remainder
  const thisAmount = perInstallment + (installmentNumber === 1 ? remainder : 0);

  if (thisAmount > 0) {
    await kycStore.grantSignupCashback({
      userId,
      amountKwd: fmt(thisAmount),
      userOfferId,
      createdById: "system_checkout",
      installmentNumber: totalInstallments > 1 ? installmentNumber : undefined
    });
  }

  // Step 3: Update userOffer cashbackGrantedKwd tracker + spendable balance
  const currentUo = await UserOfferModel.findById(userOfferId).lean();
  const currentGranted = mils((currentUo as any)?.cashbackGrantedKwd ?? "0.000");
  const currentBalance = mils((currentUo as any)?.cashbackBalanceKwd ?? "0.000");
  await UserOfferModel.findByIdAndUpdate(userOfferId, {
    $set: {
      cashbackGrantedKwd: fmt(currentGranted + thisAmount),
      cashbackBalanceKwd: fmt(currentBalance + thisAmount)
    }
  });
}

// =============================
// Full payment
// =============================
export async function checkoutFull(input: {
  userId: string;
  offerId: string;
  userOfferId?: string;
  applyCashbackKwd?: string;
  groupInviteCode?: string;
  clinicId?: string;
}) {
  await assertCustomerCanPurchase(input.userId);
  const offer = await loadOfferOrThrow(input.offerId);
  if (!offer.allowFullPayment) throw httpErr(400, "FULL_PAYMENT_NOT_ALLOWED");
  await assertNotAlreadyEnrolled(input.userId, input.offerId, input.userOfferId);
  await assertEnrollmentCap(offer, input.offerId, input.userOfferId);

  await assertRequiredEForm(input.userId, offer.fullPaymentEFormId);
  await assertNoPendingForms(input.userId, [{ kind: "offer", refId: String(offer._id) }], [
    offer.fullPaymentEFormId, offer.installmentsEFormId, offer.depositEFormId, offer.enetEFormId
  ]);

  const finalClinicId = resolvePurchaseClinicObjectId(offer, input.clinicId);
  const effectivePrice = getEffectiveSubscriptionPrice(offer, finalClinicId);

  const cb = await applyCashback(effectivePrice, input.applyCashbackKwd ?? "0.000", input.userId, { eligible: offer.cashbackEligible !== false, capKwd: offer.maxCashbackPerPurchaseKwd });

  const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const isGroup = offer.isGroupOffer || offer.membershipType === "group";
  const groupInviteCode = isGroup ? (input.groupInviteCode || require("crypto").randomBytes(4).toString("hex").toUpperCase()) : undefined;

  const uoData = {
    userId: input.userId,
    offerId: offer._id,
    clinicId: finalClinicId,
    status: "pending_payment",
    pendingExpiresAt,
    purchaseMode: "full",
    cashbackAppliedKwd: cb.cashbackAppliedKwd,
    paymentAmountKwd: cb.netAmountKwd,
    paymentMethod: "bank_transfer",
    membershipType: offer.membershipType,
    groupInviteCode
  };

  let uo: UserOfferDoc;
  if (input.userOfferId) {
    const updated = await UserOfferModel.findOneAndUpdate(
      { _id: input.userOfferId, userId: input.userId },
      { $set: uoData },
      { new: true }
    ).lean<UserOfferDoc | null>();
    if (!updated) throw httpErr(400, "INVALID_USER_OFFER_ID");
    uo = updated as any;
  } else {
    uo = await UserOfferModel.create(uoData) as any;
  }

  // Fast-path: cashback covers 100% — activate immediately without waiting for CS
  if (cb.netAmountKwd === "0.000") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + offer.validityDays * 24 * 60 * 60 * 1000);
    await cb.deduct("userOffer", String(uo._id));
    const payment = await createPayment({
      userId: input.userId,
      offerId: String(offer._id),
      userOfferId: String(uo._id),
      amountKwd: "0.000",
      cashbackAppliedKwd: cb.cashbackAppliedKwd,
      grossAmountKwd: effectivePrice,
      method: "card_mock",
      purpose: "enrollment_full",
      provider: "mock",
      providerRef: "cashback_full_coverage",
      status: "completed"
    });
    await UserOfferModel.findByIdAndUpdate(uo._id, {
      $set: {
        status: "active",
        activatedAt: now,
        expiresAt,
        paymentAmountKwd: "0.000",
        paymentId: payment._id,
        paymentConfirmedAt: now,
        paymentConfirmedBy: "system_cashback"
      },
      $unset: { pendingExpiresAt: "" }
    });
    await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));
    notifyPaymentSuccess(input.userId, String(uo._id), "0.000");
    notifyMembershipActivated(input.userId, String(uo._id), offer.name, expiresAt.toISOString());
    await grantCashbackForPayment(input.userId, offer, String(uo._id), 1, 1);
    await snapshotWalletToPayment(payment._id, input.userId);
    const activated = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
    return { userOffer: serializeUserOffer(activated!) };
  }

  const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
  return { userOffer: serializeUserOffer(fresh!) };
}

// =============================
// Installments (2 or 3 in-house)
// =============================
export async function checkoutInstallments(input: {
  userId: string;
  offerId: string;
  userOfferId?: string;
  count: 2 | 3;
  applyCashbackKwd?: string;
  groupInviteCode?: string;
  clinicId?: string;
}) {
  await assertCustomerCanPurchase(input.userId);
  const offer = await loadOfferOrThrow(input.offerId);
  if (!offer.allowInstallments) throw httpErr(400, "INSTALLMENTS_NOT_ALLOWED");
  if (input.count > (offer.maxInstallments ?? 1)) throw httpErr(400, "PLAN_NOT_ALLOWED");
  await assertNotAlreadyEnrolled(input.userId, input.offerId, input.userOfferId);
  await assertEnrollmentCap(offer, input.offerId, input.userOfferId);

  await assertRequiredEForm(input.userId, offer.installmentsEFormId);
  await assertNoPendingForms(input.userId, [
    { kind: "offer", refId: String(offer._id) },
    { kind: "installment_plan", refId: String(input.count) }
  ], [
    offer.fullPaymentEFormId, offer.installmentsEFormId, offer.depositEFormId, offer.enetEFormId
  ]);

  const finalClinicId = resolvePurchaseClinicObjectId(offer, input.clinicId);
  const effectivePrice = getEffectiveSubscriptionPrice(offer, finalClinicId);

  const cb = await applyCashback(effectivePrice, input.applyCashbackKwd ?? "0.000", input.userId, { eligible: offer.cashbackEligible !== false, capKwd: offer.maxCashbackPerPurchaseKwd });
  const remainingTotal = mils(cb.netAmountKwd);

  const baseEach = Math.floor(remainingTotal / input.count);
  const remainder = remainingTotal - baseEach * input.count;
  const amounts: string[] = [];
  for (let i = 0; i < input.count; i++) {
    amounts.push(fmt(baseEach + (i === 0 ? remainder : 0)));
  }

  const now = new Date();
  const schedule: InstallmentEntry[] = amounts.map((amt, i) => ({
    number: i + 1,
    amountKwd: amt,
    dueDate: new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000),
    paid: false
  }));

  const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const isGroup = offer.isGroupOffer || offer.membershipType === "group";
  const groupInviteCode = isGroup ? (input.groupInviteCode || require("crypto").randomBytes(4).toString("hex").toUpperCase()) : undefined;

  const uoData = {
    userId: input.userId,
    offerId: offer._id,
    clinicId: finalClinicId,
    status: "pending_payment",
    pendingExpiresAt,
    purchaseMode: "installments",
    cashbackAppliedKwd: cb.cashbackAppliedKwd,
    installmentCount: input.count,
    installmentsPaid: 0,
    installmentSchedule: schedule,
    nextInstallmentDueAt: schedule[0].dueDate,
    paymentMethod: "bank_transfer",
    paymentAmountKwd: amounts[0],
    membershipType: offer.membershipType,
    groupInviteCode
  };

  let uo: UserOfferDoc;
  if (input.userOfferId) {
    const updated = await UserOfferModel.findOneAndUpdate(
      { _id: input.userOfferId, userId: input.userId },
      { $set: uoData },
      { new: true }
    ).lean<UserOfferDoc | null>();
    if (!updated) throw httpErr(400, "INVALID_USER_OFFER_ID");
    uo = updated as any;
  } else {
    uo = await UserOfferModel.create(uoData) as any;
  }

  // Fast-path: cashback covers 100% — activate immediately without waiting for CS
  if (cb.netAmountKwd === "0.000") {
    const expiresAt = new Date(now.getTime() + offer.validityDays * 24 * 60 * 60 * 1000);
    await cb.deduct("userOffer", String(uo._id));
    const payment = await createPayment({
      userId: input.userId,
      offerId: String(offer._id),
      userOfferId: String(uo._id),
      amountKwd: "0.000",
      cashbackAppliedKwd: cb.cashbackAppliedKwd,
      grossAmountKwd: effectivePrice,
      method: "card_mock",
      purpose: "enrollment_full",
      provider: "mock",
      providerRef: "cashback_full_coverage",
      status: "completed"
    });
    const paidSchedule = schedule.map(s => ({ ...s, paid: true, paidAt: now, paymentId: payment._id }));
    await UserOfferModel.findByIdAndUpdate(uo._id, {
      $set: {
        status: "active",
        activatedAt: now,
        expiresAt,
        paymentAmountKwd: "0.000",
        paymentId: payment._id,
        paymentConfirmedAt: now,
        paymentConfirmedBy: "system_cashback",
        installmentsPaid: input.count,
        installmentSchedule: paidSchedule,
        nextInstallmentDueAt: null
      },
      $unset: { pendingExpiresAt: "" }
    });
    await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));
    notifyPaymentSuccess(input.userId, String(uo._id), "0.000");
    notifyMembershipActivated(input.userId, String(uo._id), offer.name, expiresAt.toISOString());
    await grantCashbackForPayment(input.userId, offer, String(uo._id), 1, 1);
    await snapshotWalletToPayment(payment._id, input.userId);
    const activated = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
    return { userOffer: serializeUserOffer(activated!) };
  }

  const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
  return { userOffer: serializeUserOffer(fresh!) };
}

// =============================
// Pay next installment
// =============================
export async function payNextInstallment(input: { userId: string; userOfferId: string; method?: string; proofRef?: string }) {
  if (!mongoose.isValidObjectId(input.userOfferId)) throw httpErr(400, "INVALID_USER_OFFER_ID");
  const uo = await UserOfferModel.findById(input.userOfferId).lean<UserOfferDoc | null>();
  if (!uo) throw httpErr(404, "USER_OFFER_NOT_FOUND");
  if (uo.userId !== input.userId) throw httpErr(403, "FORBIDDEN");
  if (uo.purchaseMode !== "installments") throw httpErr(400, "NOT_AN_INSTALLMENT_PLAN");
  if (uo.status !== "active") throw httpErr(409, "OFFER_NOT_ACTIVE");
  const total = uo.installmentCount ?? 0;
  const paid = uo.installmentsPaid ?? 0;
  if (paid >= total) throw httpErr(409, "ALREADY_FULLY_PAID");

  const sched = (uo.installmentSchedule ?? []) as InstallmentEntry[];
  const idx = paid; // next to pay (0-based)
  const entry = sched[idx];
  if (!entry) throw httpErr(409, "NO_SCHEDULE_ENTRY");

  if (input.method === "bank_transfer") {
    if (!input.proofRef) throw httpErr(400, "PROOF_REQUIRED");
    const payment = await createPayment({
      userId: input.userId,
      offerId: String(uo.offerId),
      userOfferId: String(uo._id),
      amountKwd: entry.amountKwd,
      cashbackAppliedKwd: "0.000",
      grossAmountKwd: entry.amountKwd,
      method: "bank_transfer",
      purpose: "installment",
      provider: "manual",
      providerRef: input.proofRef,
      installmentNumber: entry.number,
      status: "pending"
    });
    return { pending: true, payment: serializePayment(payment.toObject()) };
  }

  // If no method specified (e.g. from the simple "Pay now" button), put the offer into pending_payment
  // This creates a request for Customer Service to verify the payment manually.
  await UserOfferModel.findByIdAndUpdate(uo._id, { $set: { status: "pending_payment" } });
  return { pending: true };
}

// =============================
// 4-Installment ENET
// =============================
export async function checkoutEnet4(input: {
  userId: string;
  offerId: string;
  userOfferId?: string;
  applyCashbackKwd?: string;
  groupInviteCode?: string;
  clinicId?: string;
}) {
  await assertCustomerCanPurchase(input.userId);
  const offer = await loadOfferOrThrow(input.offerId);
  if (!offer.allowInstallments) throw httpErr(400, "INSTALLMENTS_NOT_ALLOWED");
  if ((offer.maxInstallments ?? 1) < 4) throw httpErr(400, "PLAN_NOT_ALLOWED");
  await assertNotAlreadyEnrolled(input.userId, input.offerId, input.userOfferId);
  await assertEnrollmentCap(offer, input.offerId, input.userOfferId);

  await assertRequiredEForm(input.userId, offer.enetEFormId);
  await assertNoPendingForms(input.userId, [
    { kind: "offer", refId: String(offer._id) },
    { kind: "installment_plan", refId: "4_enet" }
  ]);

  const finalClinicId = resolvePurchaseClinicObjectId(offer, input.clinicId);
  const effectivePrice = getEffectiveSubscriptionPrice(offer, finalClinicId);

  const cb = await applyCashback(effectivePrice, input.applyCashbackKwd ?? "0.000", input.userId, { eligible: offer.cashbackEligible !== false, capKwd: offer.maxCashbackPerPurchaseKwd });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + offer.validityDays * 24 * 60 * 60 * 1000);

  const isGroup = offer.isGroupOffer || offer.membershipType === "group";
  const groupInviteCode = isGroup ? (input.groupInviteCode || require("crypto").randomBytes(4).toString("hex").toUpperCase()) : undefined;

  const uoData = {
    userId: input.userId,
    offerId: offer._id,
    clinicId: finalClinicId,
    status: "enet_pending",
    purchaseMode: "enet",
    cashbackAppliedKwd: cb.cashbackAppliedKwd,
    enetStatus: "pending",
    paymentMethod: "enet",
    membershipType: offer.membershipType,
    groupInviteCode
  };

  let uo: UserOfferDoc;
  if (input.userOfferId) {
    const updated = await UserOfferModel.findOneAndUpdate(
      { _id: input.userOfferId, userId: input.userId },
      { $set: uoData },
      { new: true }
    ).lean<UserOfferDoc | null>();
    if (!updated) throw httpErr(400, "INVALID_USER_OFFER_ID");
    uo = updated as any;
  } else {
    uo = await UserOfferModel.create(uoData) as any;
  }

  const provider = getProviderForMethod("enet");
  const result = await provider.charge({
    userId: input.userId,
    amountKwd: cb.netAmountKwd,
    description: `ENET 4-installments approval for ${offer.name}`
  });

  if (!result.success) {
    await UserOfferModel.findByIdAndUpdate(uo._id, {
      $set: {
        status: "enet_rejected",
        enetStatus: "rejected",
        enetTxnRef: result.providerRef,
        enetReason: result.failureReason
      }
    });
    await createPayment({
      userId: input.userId,
      offerId: String(offer._id),
      userOfferId: String(uo._id),
      amountKwd: cb.netAmountKwd,
      cashbackAppliedKwd: "0.000",
      grossAmountKwd: effectivePrice,
      method: "enet",
      purpose: "enrollment_enet",
      provider: "enet",
      providerRef: result.providerRef,
      status: "failed",
      failureReason: result.failureReason
    });
    notifyEnetRejected(input.userId, String(uo._id), result.failureReason ?? "ENET_REJECTED");
    const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
    return {
      userOffer: serializeUserOffer(fresh!),
      enet: { approved: false, reason: result.failureReason ?? "ENET_REJECTED" }
    };
  }

  // Approved → activate offer fully paid via ENET
  await cb.deduct("userOffer", String(uo._id));
  const payment = await createPayment({
    userId: input.userId,
    offerId: String(offer._id),
    userOfferId: String(uo._id),
    amountKwd: cb.netAmountKwd,
    cashbackAppliedKwd: cb.cashbackAppliedKwd,
    grossAmountKwd: effectivePrice,
    method: "enet",
    purpose: "enrollment_enet",
    provider: "enet",
    providerRef: result.providerRef,
    status: "completed"
  });

  await UserOfferModel.findByIdAndUpdate(uo._id, {
    $set: {
      status: "active",
      activatedAt: now,
      expiresAt,
      enetStatus: "approved",
      enetTxnRef: result.providerRef,
      paymentId: payment._id,
      paymentAmountKwd: cb.netAmountKwd,
      paymentConfirmedAt: now,
      paymentConfirmedBy: "system_enet"
    }
  });

  await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));

  notifyEnetApproved(input.userId, String(uo._id));
  notifyPaymentSuccess(input.userId, String(uo._id), cb.netAmountKwd);
  notifyMembershipActivated(input.userId, String(uo._id), offer.name, expiresAt.toISOString());
  await grantCashbackForPayment(input.userId, offer, String(uo._id), 1, 1);
  await snapshotWalletToPayment(payment._id, input.userId);
  const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
  return {
    userOffer: serializeUserOffer(fresh!),
    enet: { approved: true, providerRef: result.providerRef },
    payment: serializePayment(payment.toObject())
  };
}

// =============================
// Deposit reservation
// =============================
export async function reserveWithDeposit(input: {
  userId: string;
  offerId: string;
  userOfferId?: string;
  expectedCompletionDate?: string;
  preferredPlan?: "full" | "installments_2" | "installments_3" | "installments_4_enet";
  reservationDays?: number;
  applyCashbackKwd?: string;
  groupInviteCode?: string;
  clinicId?: string;
}) {
  await assertCustomerCanPurchase(input.userId);
  const offer = await loadOfferOrThrow(input.offerId);
  if (!offer.allowDeposit) throw httpErr(400, "DEPOSIT_NOT_ALLOWED");
  await assertNotAlreadyEnrolled(input.userId, input.offerId, input.userOfferId);
  await assertEnrollmentCap(offer, input.offerId, input.userOfferId);
  const depositAmt = offer.depositAmountKwd ?? "0.000";
  if (mils(depositAmt) <= 0) throw httpErr(400, "DEPOSIT_AMOUNT_INVALID");

  await assertNoPendingForms(input.userId, [
    { kind: "offer", refId: String(offer._id) },
    { kind: "installment_plan", refId: "deposit" }
  ]);

  const cb = await applyCashback(depositAmt, input.applyCashbackKwd ?? "0.000", input.userId, { eligible: offer.cashbackEligible !== false, capKwd: offer.maxCashbackPerPurchaseKwd });
  const now = new Date();
  const reservationDays = Math.max(1, Math.min(60, input.reservationDays ?? 14));
  const reservationExpires = new Date(now.getTime() + reservationDays * 24 * 60 * 60 * 1000);
  const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const isGroup = offer.isGroupOffer || offer.membershipType === "group";
  const groupInviteCode = isGroup ? (input.groupInviteCode || require("crypto").randomBytes(4).toString("hex").toUpperCase()) : undefined;

  const finalClinicId = resolvePurchaseClinicObjectId(offer, input.clinicId);
  const effectivePrice = getEffectiveSubscriptionPrice(offer, finalClinicId);

  const uoData = {
    userId: input.userId,
    offerId: offer._id,
    clinicId: finalClinicId,
    status: "pending_payment",
    pendingExpiresAt,
    purchaseMode: "deposit",
    cashbackAppliedKwd: cb.cashbackAppliedKwd,
    depositAmountKwd: depositAmt,
    reservationExpiresAt: reservationExpires,
    reservationCompletionExpectedAt: input.expectedCompletionDate
      ? new Date(input.expectedCompletionDate)
      : undefined,
    reservationPreferredPlan: input.preferredPlan,
    paymentMethod: "bank_transfer",
    paymentAmountKwd: cb.netAmountKwd,
    membershipType: offer.membershipType,
    groupInviteCode
  };

  let uo: UserOfferDoc;
  if (input.userOfferId) {
    const updated = await UserOfferModel.findOneAndUpdate(
      { _id: input.userOfferId, userId: input.userId },
      { $set: uoData },
      { new: true }
    ).lean<UserOfferDoc | null>();
    if (!updated) throw httpErr(400, "INVALID_USER_OFFER_ID");
    uo = updated as any;
  } else {
    uo = await UserOfferModel.create(uoData) as any;
  }

  const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
  return { userOffer: serializeUserOffer(fresh!) };
}

/** Convert reservation → full payment (deposit credits the balance). */
export async function convertReservation(input: {
  userId: string;
  userOfferId: string;
  payMode: "full" | "installments_2" | "installments_3" | "installments_4_enet";
  applyCashbackKwd?: string;
}) {
  await assertCustomerCanPurchase(input.userId);
  if (!mongoose.isValidObjectId(input.userOfferId)) throw httpErr(400, "INVALID_USER_OFFER_ID");
  const uo = await UserOfferModel.findById(input.userOfferId).lean<UserOfferDoc | null>();
  if (!uo) throw httpErr(404, "USER_OFFER_NOT_FOUND");
  if (uo.userId !== input.userId) throw httpErr(403, "FORBIDDEN");
  if (uo.status !== "reserved") throw httpErr(409, "NOT_RESERVED");
  if (uo.reservationExpiresAt && new Date(uo.reservationExpiresAt) < new Date()) {
    throw httpErr(409, "RESERVATION_EXPIRED");
  }

  // Re-validate offer + clinic are active and within the sales window.
  const offer = await loadOfferOrThrow(String(uo.offerId));

  // Block if the user has *another* active/pending enrollment for the same offer.
  const dupes = await UserOfferModel.countDocuments({
    _id: { $ne: uo._id },
    userId: input.userId,
    offerId: offer._id,
    status: { $in: ["pending_payment", "active", "reserved", "enet_pending"] }
  });
  if (dupes > 0) throw httpErr(409, "ALREADY_ENROLLED");

  // Validate the chosen plan against the offer's allowances.
  if (input.payMode === "full" && !offer.allowFullPayment) throw httpErr(400, "FULL_PAYMENT_NOT_ALLOWED");
  if (input.payMode === "installments_2" || input.payMode === "installments_3") {
    if (!offer.allowInstallments) throw httpErr(400, "INSTALLMENTS_NOT_ALLOWED");
    const need = input.payMode === "installments_2" ? 2 : 3;
    if (need > (offer.maxInstallments ?? 1)) throw httpErr(400, "PLAN_NOT_ALLOWED");
  }
  if (input.payMode === "installments_4_enet") {
    if (!offer.allowInstallments) throw httpErr(400, "INSTALLMENTS_NOT_ALLOWED");
    if ((offer.maxInstallments ?? 1) < 4) throw httpErr(400, "PLAN_NOT_ALLOWED");
  }

  const effectivePrice = getEffectiveSubscriptionPrice(offer, uo.clinicId);
  const totalGross = mils(effectivePrice);
  const depositPaid = mils(uo.depositAmountKwd ?? "0.000");
  const balanceGross = Math.max(0, totalGross - depositPaid);

  const cb = await applyCashback(fmt(balanceGross), input.applyCashbackKwd ?? "0.000", input.userId, { eligible: offer.cashbackEligible !== false, capKwd: offer.maxCashbackPerPurchaseKwd });
  const balanceNet = mils(cb.netAmountKwd);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + offer.validityDays * 24 * 60 * 60 * 1000);

  if (input.payMode === "installments_4_enet") {
    const provider = getProviderForMethod("enet");
    const result = await provider.charge({
      userId: input.userId,
      amountKwd: fmt(balanceNet),
      description: `ENET 4-installments approval (reservation balance) for ${offer.name}`
    });
    if (!result.success) {
      // Keep the reservation alive so the customer can retry with another plan
      // (full / installments_2 / installments_3). Record the ENET rejection
      // metadata only — do NOT flip status to "enet_rejected", which would
      // dead-end the reservation.
      await UserOfferModel.findByIdAndUpdate(uo._id, {
        $set: {
          enetStatus: "rejected",
          enetTxnRef: result.providerRef,
          enetReason: result.failureReason
        }
      });
      await createPayment({
        userId: input.userId,
        offerId: String(offer._id),
        userOfferId: String(uo._id),
        amountKwd: fmt(balanceNet),
        cashbackAppliedKwd: "0.000",
        grossAmountKwd: fmt(balanceGross),
        method: "enet",
        purpose: "enrollment_enet",
        provider: "enet",
        providerRef: result.providerRef,
        status: "failed",
        failureReason: result.failureReason
      });
      notifyEnetRejected(input.userId, String(uo._id), result.failureReason ?? "ENET_REJECTED");
      const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
      return {
        userOffer: serializeUserOffer(fresh!),
        enet: { approved: false, reason: result.failureReason ?? "ENET_REJECTED" }
      };
    }
    await cb.deduct("userOffer", String(uo._id));
    const payment = await createPayment({
      userId: input.userId,
      offerId: String(offer._id),
      userOfferId: String(uo._id),
      amountKwd: fmt(balanceNet),
      cashbackAppliedKwd: cb.cashbackAppliedKwd,
      grossAmountKwd: fmt(balanceGross),
      method: "enet",
      purpose: "enrollment_enet",
      provider: "enet",
      providerRef: result.providerRef,
      status: "completed"
    });
    await UserOfferModel.findByIdAndUpdate(uo._id, {
      $set: {
        status: "active",
        purchaseMode: "enet",
        activatedAt: now,
        expiresAt,
        enetStatus: "approved",
        enetTxnRef: result.providerRef,
        paymentId: payment._id,
        reservationConvertedAt: now
      },
      $unset: { reservationExpiresAt: "" }
    });
    await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));
    notifyEnetApproved(input.userId, String(uo._id));
    notifyPaymentSuccess(input.userId, String(uo._id), fmt(balanceNet));
    notifyMembershipActivated(input.userId, String(uo._id), offer.name, expiresAt.toISOString());
    await grantCashbackForPayment(input.userId, offer, String(uo._id), 1, 1);
    await snapshotWalletToPayment(payment._id, input.userId);
    const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
    return {
      userOffer: serializeUserOffer(fresh!),
      enet: { approved: true, providerRef: result.providerRef },
      payment: serializePayment(payment.toObject())
    };
  }

  if (input.payMode === "full") {
    const provider = getProviderForMethod("card_mock");
    const result = await provider.charge({
      userId: input.userId,
      amountKwd: fmt(balanceNet),
      description: `Reservation balance for ${offer.name}`
    });
    if (!result.success) {
      await createPayment({
        userId: input.userId,
        offerId: String(offer._id),
        userOfferId: String(uo._id),
        amountKwd: fmt(balanceNet),
        cashbackAppliedKwd: "0.000",
        grossAmountKwd: fmt(balanceGross),
        method: "card_mock",
        purpose: "deposit_balance",
        provider: "mock",
        providerRef: result.providerRef,
        status: "failed",
        failureReason: result.failureReason
      });
      notifyPaymentFailed(input.userId, String(uo._id), result.failureReason ?? "PAYMENT_FAILED");
      throw httpErr(402, result.failureReason ?? "PAYMENT_FAILED");
    }
    await cb.deduct("userOffer", String(uo._id));
    const payment = await createPayment({
      userId: input.userId,
      offerId: String(offer._id),
      userOfferId: String(uo._id),
      amountKwd: fmt(balanceNet),
      cashbackAppliedKwd: cb.cashbackAppliedKwd,
      grossAmountKwd: fmt(balanceGross),
      method: "card_mock",
      purpose: "deposit_balance",
      provider: "mock",
      providerRef: result.providerRef,
      status: "completed"
    });
    await UserOfferModel.findByIdAndUpdate(uo._id, {
      $set: {
        status: "active",
        purchaseMode: "full",
        activatedAt: now,
        expiresAt,
        reservationConvertedAt: now,
        paymentId: payment._id
      },
      $unset: { reservationExpiresAt: "" }
    });
    await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));
    notifyPaymentSuccess(input.userId, String(uo._id), fmt(balanceNet));
    notifyMembershipActivated(input.userId, String(uo._id), offer.name, expiresAt.toISOString());
    await grantCashbackForPayment(input.userId, offer, String(uo._id), 1, 1);
    await snapshotWalletToPayment(payment._id, input.userId);
    const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
    return { userOffer: serializeUserOffer(fresh!) };
  }

  // installments_2 / installments_3 → split balance into N installments
  const count = input.payMode === "installments_2" ? 2 : 3;
  const baseEach = Math.floor(balanceNet / count);
  const remainder = balanceNet - baseEach * count;
  const amounts: string[] = [];
  for (let i = 0; i < count; i++) amounts.push(fmt(baseEach + (i === 0 ? remainder : 0)));
  const schedule: InstallmentEntry[] = amounts.map((amt, i) => ({
    number: i + 1,
    amountKwd: amt,
    dueDate: new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000),
    paid: false
  }));

  const provider = getProviderForMethod("card_mock");
  const result = await provider.charge({
    userId: input.userId,
    amountKwd: amounts[0],
    description: `Installment 1/${count} (after deposit) for ${offer.name}`
  });
  if (!result.success) {
    await createPayment({
      userId: input.userId,
      offerId: String(offer._id),
      userOfferId: String(uo._id),
      amountKwd: amounts[0],
      cashbackAppliedKwd: "0.000",
      grossAmountKwd: fmt(balanceGross),
      method: "card_mock",
      purpose: "installment",
      provider: "mock",
      providerRef: result.providerRef,
      installmentNumber: 1,
      status: "failed",
      failureReason: result.failureReason
    });
    notifyPaymentFailed(input.userId, String(uo._id), result.failureReason ?? "PAYMENT_FAILED");
    throw httpErr(402, result.failureReason ?? "PAYMENT_FAILED");
  }
  await cb.deduct("userOffer", String(uo._id));
  const payment = await createPayment({
    userId: input.userId,
    offerId: String(offer._id),
    userOfferId: String(uo._id),
    amountKwd: amounts[0],
    cashbackAppliedKwd: cb.cashbackAppliedKwd,
    grossAmountKwd: fmt(balanceGross),
    method: "card_mock",
    purpose: "installment",
    provider: "mock",
    providerRef: result.providerRef,
    installmentNumber: 1,
    status: "completed"
  });
  schedule[0].paid = true;
  schedule[0].paidAt = new Date();
  schedule[0].paymentId = payment._id;
  await UserOfferModel.findByIdAndUpdate(uo._id, {
    $set: {
      status: "active",
      purchaseMode: "installments",
      activatedAt: now,
      expiresAt,
      installmentCount: count,
      installmentsPaid: 1,
      installmentSchedule: schedule,
      nextInstallmentDueAt: schedule[1]?.dueDate,
      reservationConvertedAt: now,
      paymentId: payment._id
    },
    $unset: { reservationExpiresAt: "" }
  });
  await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));
  notifyPaymentSuccess(input.userId, String(uo._id), amounts[0]);
  notifyInstallmentPaid(input.userId, String(uo._id), 1, count);
  notifyMembershipActivated(input.userId, String(uo._id), offer.name, expiresAt.toISOString());
  await grantCashbackForPayment(input.userId, offer, String(uo._id), 1, count);
  await snapshotWalletToPayment(payment._id, input.userId);
  const fresh = await UserOfferModel.findById(uo._id).lean<UserOfferDoc | null>();
  return { userOffer: serializeUserOffer(fresh!) };
}
