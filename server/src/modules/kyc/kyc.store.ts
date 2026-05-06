import type { VerificationStatus } from "@belamonda/shared";
import { env } from "../../config/env.js";

export type KycCheckboxes = {
  termsAndConditions: boolean;
  dataPrivacyConsent: boolean;
  serviceLiabilityWaiver: boolean;
  age18Plus: boolean;
  paymentTermsAcknowledgment: boolean;
};

export type KycSubmission = {
  id: string;
  userId: string;
  status: Exclude<VerificationStatus, "unverified">; // pending|approved|rejected
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  civilIdNumberMasked: string;
  civilIdFrontRef: string;
  civilIdBackRef: string;
  signatureRef: string;
  checkboxes: KycCheckboxes;
};

export type UserRecord = {
  id: string;
  role: string;
  verificationStatus: VerificationStatus;
  createdAt: string;
  civilIdNumberMasked?: string;
};

export type WalletRecord = {
  userId: string;
  ceilingKwd: string; // "500.000"
  lockedKwd: string; // "500.000"
  unlockedKwd: string; // "0.000"
  createdAt: string;
};

export type WalletTxn = {
  id: string;
  userId: string;
  type: "unlock" | "deduction" | "adjustment" | "reversal" | "forfeited_due_to_ceiling";
  amountKwd: string;
  reference?: { kind: "session" | "userOffer" | "admin"; id: string };
  createdBy: { kind: "system" | "cs" | "admin"; id: string };
  createdAt: string;
  reason?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function parseKwd(s: string) {
  // "500.000" -> 500000 (mils)
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

// In-memory store (local dev). Later replaced by Mongo models.
const users = new Map<string, UserRecord>();
const submissions = new Map<string, KycSubmission>();
const wallets = new Map<string, WalletRecord>();
const walletTxnsByUser = new Map<string, WalletTxn[]>();

export const kycStore = {
  ensureUser(userId: string, role: string) {
    if (!users.has(userId)) {
      users.set(userId, { id: userId, role, verificationStatus: "unverified", createdAt: nowIso() });
      
      // Auto-approve cust1 for local/testing only (not in production)
      if (userId === "cust1" && env.NODE_ENV !== "production") {
         const user = users.get(userId)!;
         user.verificationStatus = "approved";
         
         if (!wallets.has(userId)) {
            wallets.set(userId, {
               userId: userId,
               ceilingKwd: "500.000",
               lockedKwd: "500.000",
               unlockedKwd: "25.000", // Give some initial cashback
               createdAt: nowIso()
            });
         }
      }
    }
    return users.get(userId)!;
  },

  getUser(userId: string) {
    return users.get(userId) ?? null;
  },

  createSubmission(input: {
    userId: string;
    civilIdNumber: string;
    civilIdFrontRef: string;
    civilIdBackRef: string;
    signatureRef: string;
    checkboxes: KycCheckboxes;
  }) {
    const id = randomId("kyc");
    const submission: KycSubmission = {
      id,
      userId: input.userId,
      status: "pending",
      createdAt: nowIso(),
      civilIdNumberMasked: maskCivilId(input.civilIdNumber),
      civilIdFrontRef: input.civilIdFrontRef,
      civilIdBackRef: input.civilIdBackRef,
      signatureRef: input.signatureRef,
      checkboxes: input.checkboxes
    };
    submissions.set(id, submission);

    const user = users.get(input.userId);
    if (user) user.verificationStatus = "pending";

    return submission;
  },

  listSubmissions(status?: "pending" | "approved" | "rejected") {
    const all = Array.from(submissions.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return status ? all.filter((s) => s.status === status) : all;
  },

  approveSubmission(id: string, reviewedBy: string) {
    const sub = submissions.get(id);
    if (!sub) return null;
    sub.status = "approved";
    sub.reviewedAt = nowIso();
    sub.reviewedBy = reviewedBy;
    delete sub.rejectionReason;

    const user = users.get(sub.userId);
    if (user) {
      user.verificationStatus = "approved";
      user.civilIdNumberMasked = sub.civilIdNumberMasked;
    }

    // Wallet init per SRS: Locked=500, Unlocked=0, ceiling=500
    if (!wallets.has(sub.userId)) {
      wallets.set(sub.userId, {
        userId: sub.userId,
        ceilingKwd: "500.000",
        lockedKwd: "500.000",
        unlockedKwd: "0.000",
        createdAt: nowIso()
      });
    }

    return sub;
  },

  rejectSubmission(id: string, reviewedBy: string, reason: string) {
    const sub = submissions.get(id);
    if (!sub) return null;
    sub.status = "rejected";
    sub.reviewedAt = nowIso();
    sub.reviewedBy = reviewedBy;
    sub.rejectionReason = reason;

    const user = users.get(sub.userId);
    if (user) user.verificationStatus = "rejected";

    return sub;
  },

  getWallet(userId: string) {
    return wallets.get(userId) ?? null;
  },

  listWalletTxns(userId: string) {
    return walletTxnsByUser.get(userId) ?? [];
  },

  unlockCashbackFromLocked(input: { userId: string; amountKwd: string; sessionId: string; createdById: string }) {
    const wallet = wallets.get(input.userId);
    if (!wallet) return { error: "NO_WALLET" as const };

    const ceiling = parseKwd(wallet.ceilingKwd);
    const locked = parseKwd(wallet.lockedKwd);
    const unlocked = parseKwd(wallet.unlockedKwd);
    const total = locked + unlocked;
    const requested = parseKwd(input.amountKwd);
    if (requested <= 0) return { ok: true as const, unlockedKwd: "0.000", forfeitedKwd: "0.000" };

    // Available to unlock is limited by locked and ceiling headroom
    const headroom = Math.max(0, ceiling - total);
    const actual = Math.max(0, Math.min(requested, locked, headroom));
    const forfeited = requested - actual;

    wallet.lockedKwd = fmtKwd(locked - actual);
    wallet.unlockedKwd = fmtKwd(unlocked + actual);
    wallets.set(input.userId, wallet);

    const txns = walletTxnsByUser.get(input.userId) ?? [];
    if (actual > 0) {
      txns.unshift({
        id: randomId("wtxn"),
        userId: input.userId,
        type: "unlock",
        amountKwd: fmtKwd(actual),
        reference: { kind: "session", id: input.sessionId },
        createdBy: { kind: "system", id: input.createdById },
        createdAt: nowIso()
      });
    }
    if (forfeited > 0) {
      txns.unshift({
        id: randomId("wtxn"),
        userId: input.userId,
        type: "forfeited_due_to_ceiling",
        amountKwd: fmtKwd(forfeited),
        reference: { kind: "session", id: input.sessionId },
        createdBy: { kind: "system", id: input.createdById },
        createdAt: nowIso()
      });
    }
    walletTxnsByUser.set(input.userId, txns);

    return { ok: true as const, unlockedKwd: fmtKwd(actual), forfeitedKwd: fmtKwd(Math.max(0, forfeited)) };
  },

  deductUnlocked(input: {
    userId: string;
    amountKwd: string;
    reference: { kind: "session" | "userOffer"; id: string };
    createdBy: { kind: "cs" | "admin"; id: string };
  }) {
    const wallet = wallets.get(input.userId);
    if (!wallet) return { error: "NO_WALLET" as const };

    const unlocked = parseKwd(wallet.unlockedKwd);
    const amount = parseKwd(input.amountKwd);
    if (amount <= 0) return { error: "INVALID_AMOUNT" as const };
    if (unlocked < amount) return { error: "INSUFFICIENT_UNLOCKED" as const };

    wallet.unlockedKwd = fmtKwd(unlocked - amount);
    wallets.set(input.userId, wallet);

    const txns = walletTxnsByUser.get(input.userId) ?? [];
    txns.unshift({
      id: randomId("wtxn"),
      userId: input.userId,
      type: "deduction",
      amountKwd: fmtKwd(amount),
      reference: { kind: input.reference.kind, id: input.reference.id },
      createdBy: { kind: input.createdBy.kind, id: input.createdBy.id },
      createdAt: nowIso()
    });
    walletTxnsByUser.set(input.userId, txns);

    return { ok: true as const, wallet, deductedKwd: fmtKwd(amount) };
  },

  adjustUnlocked(input: { userId: string; amountKwd: string; reason: string; createdById: string }) {
    const wallet = wallets.get(input.userId);
    if (!wallet) return { error: "NO_WALLET" as const };

    const locked = parseKwd(wallet.lockedKwd);
    const unlocked = parseKwd(wallet.unlockedKwd);
    const ceiling = parseKwd(wallet.ceilingKwd);
    const delta = parseKwd(input.amountKwd);

    const nextUnlocked = unlocked + delta;
    if (nextUnlocked < 0) return { error: "UNLOCKED_BELOW_ZERO" as const };
    if (locked + nextUnlocked > ceiling) return { error: "CEILING_EXCEEDED" as const };

    wallet.unlockedKwd = fmtKwd(nextUnlocked);
    wallets.set(input.userId, wallet);

    const txns = walletTxnsByUser.get(input.userId) ?? [];
    txns.unshift({
      id: randomId("wtxn"),
      userId: input.userId,
      type: "adjustment",
      amountKwd: fmtKwd(delta),
      reference: { kind: "admin", id: input.createdById },
      createdBy: { kind: "admin", id: input.createdById },
      createdAt: nowIso(),
      reason: input.reason
    });
    walletTxnsByUser.set(input.userId, txns);

    return { ok: true as const, wallet };
  }
};

