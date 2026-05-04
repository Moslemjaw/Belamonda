import type { UserOfferStatus } from "@belamonda/shared";

export type UserOfferRecord = {
  id: string;
  userId: string;
  offerId: string;
  clinicId: string;
  status: UserOfferStatus; // pending_payment|active|expired|cancelled
  createdAt: string;
  pendingExpiresAt?: string; // 48h hold
  activatedAt?: string;
  expiresAt?: string;
  sessionsUsed: number;
  paymentConfirmedBy?: string;
  paymentConfirmedAt?: string;
  paymentProofRef?: string;
  paymentMethod?: string;
  paymentAmountKwd?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function addHours(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const userOffers = new Map<string, UserOfferRecord>();

function expireIfNeeded(uo: UserOfferRecord, now: Date) {
  if (uo.status !== "pending_payment") return uo;
  if (!uo.pendingExpiresAt) return uo;
  if (now > new Date(uo.pendingExpiresAt)) {
    uo.status = "expired";
    userOffers.set(uo.id, uo);
  }
  return uo;
}

export const commerceStore = {
  createPending(input: { userId: string; offerId: string; clinicId: string }) {
    const id = randomId("user_offer");
    const createdAt = nowIso();
    const pendingExpiresAt = addHours(new Date(), 48).toISOString();
    const rec: UserOfferRecord = {
      id,
      userId: input.userId,
      offerId: input.offerId,
      clinicId: input.clinicId,
      status: "pending_payment",
      createdAt,
      pendingExpiresAt,
      sessionsUsed: 0
    };
    userOffers.set(id, rec);
    return rec;
  },

  get(id: string) {
    const uo = userOffers.get(id);
    if (!uo) return null;
    return expireIfNeeded(uo, new Date());
  },

  listByUser(userId: string) {
    const now = new Date();
    return Array.from(userOffers.values())
      .filter((u) => u.userId === userId)
      .map((u) => expireIfNeeded(u, now))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  listPendingPayments() {
    const now = new Date();
    return Array.from(userOffers.values())
      .map((u) => expireIfNeeded(u, now))
      .filter((u) => u.status === "pending_payment")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  countActiveAndPendingForOffer(offerId: string) {
    const now = new Date();
    return Array.from(userOffers.values())
      .map((u) => expireIfNeeded(u, now))
      .filter((u) => u.offerId === offerId)
      .filter((u) => u.status === "pending_payment" || u.status === "active").length;
  },

  confirmPaymentAndActivate(input: {
    userOfferId: string;
    confirmedBy: string;
    proofRef: string;
    method: string;
    amountKwd: string;
    activatedAt: string;
    expiresAt: string;
  }) {
    const uo = userOffers.get(input.userOfferId);
    if (!uo) return null;
    expireIfNeeded(uo, new Date());
    if (uo.status !== "pending_payment") return { error: "NOT_PENDING" as const };

    uo.status = "active";
    uo.paymentConfirmedBy = input.confirmedBy;
    uo.paymentConfirmedAt = nowIso();
    uo.paymentProofRef = input.proofRef;
    uo.paymentMethod = input.method;
    uo.paymentAmountKwd = input.amountKwd;
    uo.activatedAt = input.activatedAt;
    uo.expiresAt = input.expiresAt;
    delete uo.pendingExpiresAt;

    userOffers.set(uo.id, uo);
    return uo;
  }
  ,
  incrementSessionsUsed(userOfferId: string) {
    const uo = userOffers.get(userOfferId);
    if (!uo) return null;
    uo.sessionsUsed += 1;
    userOffers.set(uo.id, uo);
    return uo;
  }
};

