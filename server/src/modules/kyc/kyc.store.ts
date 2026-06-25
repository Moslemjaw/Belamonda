import type { VerificationStatus } from "@belamonda/shared";
import mongoose from "mongoose";
import { UserModel, type UserDoc } from "../../models/user.model.js";
import { KycSubmissionModel, WalletModel, WalletTxnModel, type KycSubmissionDoc, type WalletDoc, type WalletTxnDoc } from "../../models/kyc.model.js";
import { env } from "../../config/env.js";
import { getSettings } from "../settings/settings.router.js";

export type KycCheckboxes = {
  termsAndConditions: boolean;
  dataPrivacyConsent: boolean;
  serviceLiabilityWaiver: boolean;
  age18Plus: boolean;
  paymentTermsAcknowledgment: boolean;
};

function parseKwd(s: string) {
  const [a, b = "000"] = s.split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

function fmtKwd(mils: number) {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  const a = Math.floor(abs / 1000);
  const b = String(abs % 1000).padStart(3, "0");
  return `${sign}${a}.${b}`;
}

function maskCivilId(civilId: string) {
  return civilId;
}

export const kycStore = {
  async ensureUser(userId: string, role: string) {
    // User already created in auth router. Just ensure wallet if needed, but wallet is created on approval.
    // User already created in auth router. Just ensure wallet if needed, but wallet is created on approval.
  },

  async getUser(userId: string) {
    if (!mongoose.isValidObjectId(userId)) return null;
    const u = await UserModel.findById(userId).lean<UserDoc | null>();
    if (!u) return null;
    return {
      id: u._id.toString(),
      role: u.role,
      verificationStatus: u.verificationStatus as VerificationStatus,
      createdAt: (u.createdAt as Date).toISOString(),
      civilIdNumberMasked: u.civilIdNumberMasked
    };
  },

  async createSubmission(input: {
    userId: string;
    civilIdNumber: string;
    civilIdFrontRef: string;
    civilIdBackRef: string;
    checkboxes: KycCheckboxes;
  }) {
    // Prevent duplicate submissions — only allow one pending KYC at a time
    const existingPending = await KycSubmissionModel.findOne({ userId: input.userId, status: "pending" }).lean();
    if (existingPending) {
      throw new Error("ALREADY_PENDING");
    }

    const doc = await KycSubmissionModel.create({
      userId: input.userId,
      status: "pending",
      civilIdNumberMasked: maskCivilId(input.civilIdNumber),
      civilIdFrontRef: input.civilIdFrontRef,
      civilIdBackRef: input.civilIdBackRef,
      checkboxes: input.checkboxes
    });

    await UserModel.findByIdAndUpdate(input.userId, { verificationStatus: "pending" });

    return { ...doc.toObject(), id: doc._id.toString(), createdAt: (doc.createdAt as Date).toISOString() };
  },

  async listSubmissions(status?: "pending" | "approved" | "rejected") {
    const filter = status ? { status } : {};
    const docs = await KycSubmissionModel.find(filter).sort({ createdAt: -1 }).lean<KycSubmissionDoc[]>();
    
    const validUserIds = [...new Set(docs.map(d => d.userId))].filter(id => mongoose.isValidObjectId(id));
    const objectIds = validUserIds.map(id => new mongoose.Types.ObjectId(id));
    const users = await UserModel.find({ _id: { $in: objectIds } }).select("fullName username email phone").lean();
    const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), u]));

    return docs.map(d => {
      const user = userMap[d.userId] as any || {};
      return {
        ...d,
        id: d._id.toString(),
        createdAt: (d.createdAt as Date).toISOString(),
        userName: user.fullName || user.username || user.phone || (userMap[d.userId] ? "Unknown Name" : "Deleted User"),
        userPhone: user.phone || undefined,
        userEmail: user.email || undefined
      };
    });
  },

  async approveSubmission(id: string, reviewedBy: string, expiryDate?: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    const sub = await KycSubmissionModel.findByIdAndUpdate(id, {
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy,
      ...(expiryDate ? { expiryDate: new Date(expiryDate) } : {}),
      $unset: { rejectionReason: "" }
    }, { new: true }).lean<KycSubmissionDoc | null>();
    
    if (!sub) return null;

    // Mark ALL other pending submissions for this user as approved too,
    // so the user doesn't get stuck in "pending" state
    await KycSubmissionModel.updateMany(
      { userId: sub.userId, status: "pending", _id: { $ne: sub._id } },
      { status: "approved", reviewedAt: new Date(), reviewedBy }
    );

    // Always set user to verified
    await UserModel.findByIdAndUpdate(sub.userId, {
      verificationStatus: "approved",
      civilIdNumberMasked: sub.civilIdNumberMasked,
      ...(expiryDate ? { civilIdExpiryDate: new Date(expiryDate) } : {})
    });

    const w = await WalletModel.findOne({ userId: sub.userId });
    if (!w) {
      await WalletModel.create({
        userId: sub.userId,
        ceilingKwd: "0.000",
        lockedKwd: "0.000",
        unlockedKwd: "0.000"
      });
    }

    return { ...sub, id: sub._id.toString() };
  },

  async rejectSubmission(id: string, reviewedBy: string, reason: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    const sub = await KycSubmissionModel.findByIdAndUpdate(id, {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy,
      rejectionReason: reason
    }, { new: true }).lean<KycSubmissionDoc | null>();

    if (!sub) return null;

    await UserModel.findByIdAndUpdate(sub.userId, { verificationStatus: "rejected" });

    return { ...sub, id: sub._id.toString() };
  },

  async unverifyUser(userId: string, actionBy: string) {
    if (!mongoose.isValidObjectId(userId)) return null;
    const user = await UserModel.findByIdAndUpdate(userId, {
      verificationStatus: "unverified",
      $unset: { civilIdNumberMasked: "" }
    }, { new: true });
    
    if (!user) return null;

    // Optional: Also mark all pending/approved KYC submissions as rejected or expired?
    // Let's just reject any pending or approved ones to be safe
    await KycSubmissionModel.updateMany(
      { userId, status: { $in: ["pending", "approved"] } },
      { 
        $set: { 
          status: "rejected", 
          rejectionReason: "Account unverified by admin",
          reviewedAt: new Date(),
          reviewedBy: actionBy
        } 
      }
    );

    return { ok: true };
  },

  async listApprovedUserIds() {
    const users = await UserModel.find({ verificationStatus: "approved" }).select("_id").lean<UserDoc[]>();
    return users.map(u => u._id.toString());
  },

  async getWallet(userId: string) {
    const w = await WalletModel.findOne({ userId }).lean<WalletDoc | null>();
    return w ? { ...w, id: w._id.toString() } : null;
  },

  async listWalletTxns(userId: string) {
    const docs = await WalletTxnModel.find({ userId }).sort({ createdAt: -1 }).lean<WalletTxnDoc[]>();
    return docs.map(d => ({ ...d, id: d._id.toString(), createdAt: (d.createdAt as Date).toISOString() }));
  },

  async unlockCashbackFromLocked(input: { userId: string; amountKwd: string; sessionId: string; createdById: string }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const ceiling = parseKwd(wallet.ceilingKwd);
    const locked = parseKwd(wallet.lockedKwd);
    const unlocked = parseKwd(wallet.unlockedKwd);
    const total = locked + unlocked;
    const requested = parseKwd(input.amountKwd);
    if (requested <= 0) return { ok: true as const, unlockedKwd: "0.000", forfeitedKwd: "0.000" };

    const headroom = Math.max(0, ceiling - total);
    const actual = Math.max(0, Math.min(requested, locked, headroom));
    const forfeited = requested - actual;

    wallet.lockedKwd = fmtKwd(locked - actual);
    wallet.unlockedKwd = fmtKwd(unlocked + actual);
    await wallet.save();

    if (actual > 0) {
      await WalletTxnModel.create({
        userId: input.userId,
        type: "unlock",
        amountKwd: fmtKwd(actual),
        reference: { kind: "session", id: input.sessionId },
        createdBy: { kind: "system", id: input.createdById }
      });
    }
    if (forfeited > 0) {
      await WalletTxnModel.create({
        userId: input.userId,
        type: "forfeited_due_to_ceiling",
        amountKwd: fmtKwd(forfeited),
        reference: { kind: "session", id: input.sessionId },
        createdBy: { kind: "system", id: input.createdById }
      });
    }

    return { ok: true as const, unlockedKwd: fmtKwd(actual), forfeitedKwd: fmtKwd(Math.max(0, forfeited)) };
  },

  async deductUnlocked(input: {
    userId: string;
    amountKwd: string;
    reference: { kind: "session" | "userOffer"; id: string };
    createdBy: { kind: "cs" | "admin"; id: string };
  }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const unlocked = parseKwd(wallet.unlockedKwd);
    const amount = parseKwd(input.amountKwd);
    if (amount <= 0) return { error: "INVALID_AMOUNT" as const };
    if (unlocked < amount) return { error: "INSUFFICIENT_UNLOCKED" as const };

    wallet.unlockedKwd = fmtKwd(unlocked - amount);
    await wallet.save();

    await WalletTxnModel.create({
      userId: input.userId,
      type: "deduction",
      amountKwd: fmtKwd(amount),
      reference: { kind: input.reference.kind, id: input.reference.id },
      createdBy: { kind: input.createdBy.kind, id: input.createdBy.id }
    });

    return { ok: true as const, wallet, deductedKwd: fmtKwd(amount) };
  },

  /**
   * Credit offer cashback to wallet's locked pool.
   * Called once when an offer is activated — increases both locked and ceiling
   * by the offer's total signup cashback amount.
   */
  async creditOfferCashback(input: { userId: string; amountKwd: string; userOfferId: string; createdById: string }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const amount = parseKwd(input.amountKwd);
    if (amount <= 0) return { ok: true as const };

    // Dedup: only credit once per userOffer
    const alreadyCredited = await WalletTxnModel.exists({
      userId: input.userId,
      type: "offer_cashback_credit",
      "reference.id": input.userOfferId
    });
    if (alreadyCredited) return { ok: true as const, duplicate: true };

    const locked = parseKwd(wallet.lockedKwd);
    const ceiling = parseKwd(wallet.ceilingKwd);

    const settings = await getSettings();
    const maxCapStr = String(settings.maxCashbackCapacityKwd || 10000);
    const maxCapacityMils = parseKwd(maxCapStr.includes(".") ? maxCapStr : maxCapStr + ".000");
    const allowedAmount = Math.max(0, Math.min(amount, maxCapacityMils - ceiling));
    
    if (allowedAmount <= 0) return { ok: true as const };

    wallet.lockedKwd = fmtKwd(locked + allowedAmount);
    wallet.ceilingKwd = fmtKwd(ceiling + allowedAmount);
    await wallet.save();

    await WalletTxnModel.create({
      userId: input.userId,
      type: "offer_cashback_credit",
      amountKwd: fmtKwd(allowedAmount),
      reference: { kind: "userOffer", id: input.userOfferId },
      createdBy: { kind: "system", id: input.createdById },
      reason: "Offer cashback credited to wallet"
    });

    return { ok: true as const, creditedKwd: fmtKwd(allowedAmount) };
  },

  /**
   * Reward per-session cashback directly to the unlocked pool (e.g. Naomi Plus).
   * Increases both ceiling and unlocked directly.
   */
  async rewardSessionCashback(input: { userId: string; amountKwd: string; sessionId: string; createdById: string }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const amount = parseKwd(input.amountKwd);
    if (amount <= 0) return { ok: true as const, rewardedKwd: "0.000" };

    const alreadyRewarded = await WalletTxnModel.exists({
      userId: input.userId,
      type: "session_reward",
      "reference.id": input.sessionId
    });
    if (alreadyRewarded) return { ok: true as const, duplicate: true };

    const unlocked = parseKwd(wallet.unlockedKwd);
    const ceiling = parseKwd(wallet.ceilingKwd);

    const settings = await getSettings();
    const maxCapStr = String(settings.maxCashbackCapacityKwd || 10000);
    const maxCapacityMils = parseKwd(maxCapStr.includes(".") ? maxCapStr : maxCapStr + ".000");
    const allowedAmount = Math.max(0, Math.min(amount, maxCapacityMils - ceiling));
    
    if (allowedAmount <= 0) return { ok: true as const, rewardedKwd: "0.000" };

    wallet.unlockedKwd = fmtKwd(unlocked + allowedAmount);
    wallet.ceilingKwd = fmtKwd(ceiling + allowedAmount);
    await wallet.save();

    await WalletTxnModel.create({
      userId: input.userId,
      type: "session_reward",
      amountKwd: fmtKwd(allowedAmount),
      reference: { kind: "session", id: input.sessionId },
      createdBy: { kind: "system", id: input.createdById },
      reason: "Cashback earned from completing a session"
    });

    return { ok: true as const, rewardedKwd: fmtKwd(allowedAmount) };
  },

  /**
   * Reward cashback directly to the unlocked pool from an approved invoice.
   * Increases both ceiling and unlocked directly.
   */
  async rewardInvoiceCashback(input: { userId: string; amountKwd: string; requestId: string; createdById: string }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const amount = parseKwd(input.amountKwd);
    if (amount <= 0) return { ok: true as const, rewardedKwd: "0.000" };

    const alreadyRewarded = await WalletTxnModel.exists({
      userId: input.userId,
      type: "invoice_reward" as any,
      "reference.id": input.requestId
    });
    if (alreadyRewarded) return { ok: true as const, duplicate: true };

    const unlocked = parseKwd(wallet.unlockedKwd);
    const ceiling = parseKwd(wallet.ceilingKwd);

    const settings = await getSettings();
    const maxCapStr = String(settings.maxCashbackCapacityKwd || 10000);
    const maxCapacityMils = parseKwd(maxCapStr.includes(".") ? maxCapStr : maxCapStr + ".000");
    const allowedAmount = Math.max(0, Math.min(amount, maxCapacityMils - ceiling));
    
    if (allowedAmount <= 0) return { ok: true as const, rewardedKwd: "0.000" };

    wallet.unlockedKwd = fmtKwd(unlocked + allowedAmount);
    wallet.ceilingKwd = fmtKwd(ceiling + allowedAmount);
    await wallet.save();

    await WalletTxnModel.create({
      userId: input.userId,
      type: "invoice_reward" as any,
      amountKwd: fmtKwd(allowedAmount),
      reference: { kind: "invoice" as any, id: input.requestId },
      createdBy: { kind: "system", id: input.createdById },
      reason: "Cashback earned from approved invoice (Belmondo Pro)"
    });

    return { ok: true as const, rewardedKwd: fmtKwd(allowedAmount) };
  },

  /**
   * Unlock a portion of locked cashback (move from locked → unlocked).
   * Supports per-installment dedup via optional installmentNumber.
   */
  async grantSignupCashback(input: { userId: string; amountKwd: string; userOfferId: string; createdById: string; createdByKind?: "system" | "cs" | "admin"; installmentNumber?: number }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    // Dedup key includes installment number when provided
    const dedupRefId = input.installmentNumber != null
      ? `${input.userOfferId}_inst_${input.installmentNumber}`
      : input.userOfferId;

    const txnType = input.installmentNumber != null ? "installment_unlock" : "signup_bonus";

    const alreadyGranted = await WalletTxnModel.exists({
      userId: input.userId,
      type: txnType,
      "reference.id": dedupRefId
    });
    if (alreadyGranted) return { ok: true as const, duplicate: true };

    const locked = parseKwd(wallet.lockedKwd);
    const unlocked = parseKwd(wallet.unlockedKwd);
    const amount = parseKwd(input.amountKwd);
    if (amount <= 0) return { ok: true as const };

    const actual = Math.min(amount, locked);
    if (actual <= 0) return { ok: true as const };

    wallet.lockedKwd = fmtKwd(locked - actual);
    wallet.unlockedKwd = fmtKwd(unlocked + actual);
    await wallet.save();

    await WalletTxnModel.create({
      userId: input.userId,
      type: txnType,
      amountKwd: fmtKwd(actual),
      reference: { kind: "userOffer", id: dedupRefId },
      createdBy: { kind: input.createdByKind ?? "system", id: input.createdById },
      reason: input.installmentNumber != null
        ? `Cashback unlocked for installment ${input.installmentNumber}`
        : "Signup cashback bonus"
    });

    return { ok: true as const, grantedKwd: fmtKwd(actual) };
  },

  async adjustUnlocked(input: { userId: string; amountKwd: string; reason: string; createdById: string }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const locked = parseKwd(wallet.lockedKwd);
    const unlocked = parseKwd(wallet.unlockedKwd);
    const ceiling = parseKwd(wallet.ceilingKwd);
    const delta = parseKwd(input.amountKwd);

    const nextUnlocked = unlocked + delta;
    if (nextUnlocked < 0) return { error: "UNLOCKED_BELOW_ZERO" as const };

    // Auto-expand ceiling when admin adds cashback so adjustment is never blocked
    const nextTotal = locked + nextUnlocked;
    let nextCeiling = ceiling;
    if (nextTotal > ceiling) {
      nextCeiling = nextTotal;
      wallet.ceilingKwd = fmtKwd(nextCeiling);
    }

    wallet.unlockedKwd = fmtKwd(nextUnlocked);
    await wallet.save();

    await WalletTxnModel.create({
      userId: input.userId,
      type: "adjustment",
      amountKwd: fmtKwd(delta),
      reference: { kind: "admin", id: input.createdById },
      createdBy: { kind: "admin", id: input.createdById },
      reason: input.reason
    });

    return { ok: true as const, wallet };
  }
};
