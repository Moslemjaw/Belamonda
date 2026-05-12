import type { VerificationStatus } from "@belamonda/shared";
import mongoose from "mongoose";
import { UserModel, type UserDoc } from "../../models/user.model.js";
import { KycSubmissionModel, WalletModel, WalletTxnModel, type KycSubmissionDoc, type WalletDoc, type WalletTxnDoc } from "../../models/kyc.model.js";
import { env } from "../../config/env.js";

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
  const digits = civilId.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "*");
  return `********${last4}`;
}

export const kycStore = {
  async ensureUser(userId: string, role: string) {
    // User already created in auth router. Just ensure wallet if needed, but wallet is created on approval.
    // However, for testing:
    if (userId === "cust1" && env.NODE_ENV !== "production") {
      await UserModel.findByIdAndUpdate(userId, { verificationStatus: "approved" });
      const w = await WalletModel.findOne({ userId });
      if (!w) {
        await WalletModel.create({
          userId,
          ceilingKwd: "500.000",
          lockedKwd: "500.000",
          unlockedKwd: "25.000"
        });
      }
    }
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
    signatureRef: string;
    checkboxes: KycCheckboxes;
  }) {
    const doc = await KycSubmissionModel.create({
      userId: input.userId,
      status: "pending",
      civilIdNumberMasked: maskCivilId(input.civilIdNumber),
      civilIdFrontRef: input.civilIdFrontRef,
      civilIdBackRef: input.civilIdBackRef,
      signatureRef: input.signatureRef,
      checkboxes: input.checkboxes
    });

    await UserModel.findByIdAndUpdate(input.userId, { verificationStatus: "pending" });

    return { ...doc.toObject(), id: doc._id.toString(), createdAt: (doc.createdAt as Date).toISOString() };
  },

  async listSubmissions(status?: "pending" | "approved" | "rejected") {
    const filter = status ? { status } : {};
    const docs = await KycSubmissionModel.find(filter).sort({ createdAt: -1 }).lean<KycSubmissionDoc[]>();
    return docs.map(d => ({ ...d, id: d._id.toString(), createdAt: (d.createdAt as Date).toISOString() }));
  },

  async approveSubmission(id: string, reviewedBy: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    const sub = await KycSubmissionModel.findByIdAndUpdate(id, {
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy,
      $unset: { rejectionReason: "" }
    }, { new: true }).lean<KycSubmissionDoc | null>();
    
    if (!sub) return null;

    await UserModel.findByIdAndUpdate(sub.userId, {
      verificationStatus: "approved",
      civilIdNumberMasked: sub.civilIdNumberMasked
    });

    const w = await WalletModel.findOne({ userId: sub.userId });
    if (!w) {
      await WalletModel.create({
        userId: sub.userId,
        ceilingKwd: "500.000",
        lockedKwd: "500.000",
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

  async grantSignupCashback(input: { userId: string; amountKwd: string; userOfferId: string; createdById: string; createdByKind?: "system" | "cs" | "admin" }) {
    const wallet = await WalletModel.findOne({ userId: input.userId });
    if (!wallet) return { error: "NO_WALLET" as const };

    const alreadyGranted = await WalletTxnModel.exists({
      userId: input.userId,
      type: "signup_bonus",
      "reference.id": input.userOfferId
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
      type: "signup_bonus",
      amountKwd: fmtKwd(actual),
      reference: { kind: "userOffer", id: input.userOfferId },
      createdBy: { kind: input.createdByKind ?? "system", id: input.createdById },
      reason: "Signup cashback bonus"
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
    if (locked + nextUnlocked > ceiling) return { error: "CEILING_EXCEEDED" as const };

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
