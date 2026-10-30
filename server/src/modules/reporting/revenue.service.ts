import { PaymentModel } from "../../models/payment.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { kwdToMils, milsToKwd } from "../../utils/money.js";
import { kwDateRange } from "../../utils/kwDate.js";
import { PAID_STATUSES, isGrant, isPackageRevenue, isRefund } from "../../services/financeRevenue.js";

/** Memberships in these states count as sold. Pending/rejected were never sold; cancelled are reported separately. */
const SOLD_STATUSES = ["active", "expired", "reserved"];

type RevenuePayment = {
  userOfferId?: unknown;
  offerId?: unknown;
  status?: unknown;
  purpose?: unknown;
  method?: unknown;
  amountKwd?: unknown;
  createdAt?: Date | string;
};

export type RevenueGranularity = "daily" | "weekly" | "monthly";

/** Bucket key in Kuwait time (UTC+3): YYYY-MM-DD, the Monday of the week, or YYYY-MM. */
export function revenueBucket(date: Date | string, granularity: RevenueGranularity): string {
  const d = new Date(new Date(date).getTime() + 3 * 3600_000);
  if (granularity === "monthly") return d.toISOString().slice(0, 7);
  if (granularity === "weekly") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
type RevenueMembership = {
  _id: unknown;
  offerId?: unknown;
  status: string;
  purchaseMode?: string;
  installmentSchedule?: { amountKwd?: string; paid?: boolean; dueDate?: Date | string }[];
  depositAmountKwd?: string;
  refundedKwd?: string;
};

export type PackageRevenueSummary = {
  revenueKwd: string;
  collectedKwd: string;
  refundsKwd: string;
  paymentsCount: number;
  refundsCount: number;
  byMethod: { method: string; count: number; totalKwd: string }[];
  packagesSold: number;
  outstandingKwd: string;
  outstandingCount: number;
  lateKwd: string;
  lateCount: number;
  granted: { count: number; listValueKwd: string };
  cancelled: { count: number; refundedKwd: string };
  /** Revenue (collected − refunds) per period bucket; sums to revenueKwd. */
  points: { bucket: string; revenueKwd: string }[];
  /** Packages by revenue (collected − refunds), highest first. */
  topPackages: { offerId: string; offerName: string; count: number; revenueKwd: string }[];
};

/**
 * Pure aggregation, kept separate from the queries so it can be tested.
 *  - payments: package payments and refunds recorded in the period
 *  - memberships: memberships created in the period (sold, granted, cancelled)
 *  - membershipPayments: every paid payment of those memberships, any date
 */
export function summarizePackageRevenue(input: {
  payments: RevenuePayment[];
  memberships: RevenueMembership[];
  membershipPayments: RevenuePayment[];
  offerPrices: Map<string, string>;
  offerNames?: Map<string, string>;
  granularity?: RevenueGranularity;
  now?: Date;
}): PackageRevenueSummary {
  const granularity = input.granularity ?? "daily";
  const buckets = new Map<string, number>();
  const byOffer = new Map<string, { count: number; mils: number }>();
  const addToSeries = (p: RevenuePayment, mils: number, isSale: boolean) => {
    if (p.createdAt) {
      const k = revenueBucket(p.createdAt, granularity);
      buckets.set(k, (buckets.get(k) ?? 0) + mils);
    }
    const offerId = p.offerId ? String(p.offerId) : "";
    const cur = byOffer.get(offerId) ?? { count: 0, mils: 0 };
    cur.mils += mils;
    if (isSale) cur.count++;
    byOffer.set(offerId, cur);
  };
  const now = input.now ?? new Date();
  let collected = 0;
  let refunds = 0;
  let paymentsCount = 0;
  let refundsCount = 0;
  const byMethod = new Map<string, { count: number; mils: number }>();

  for (const p of input.payments) {
    const mils = kwdToMils(p.amountKwd as string);
    if (isRefund(p)) {
      refunds += mils;
      refundsCount++;
      addToSeries(p, -mils, false);
      continue;
    }
    if (!isPackageRevenue(p, mils)) continue;
    collected += mils;
    paymentsCount++;
    addToSeries(p, mils, true);
    const m = String(p.method || "other");
    const cur = byMethod.get(m) ?? { count: 0, mils: 0 };
    cur.count++;
    cur.mils += mils;
    byMethod.set(m, cur);
  }

  const paidByMembership = new Map<string, number>();
  const hasGrantPayment = new Set<string>();
  for (const p of input.membershipPayments) {
    const id = String(p.userOfferId);
    const mils = kwdToMils(p.amountKwd as string);
    if (isPackageRevenue(p, mils)) paidByMembership.set(id, (paidByMembership.get(id) ?? 0) + mils);
    if (isGrant(p, mils)) hasGrantPayment.add(id);
  }

  let packagesSold = 0;
  let outstanding = 0;
  let outstandingCount = 0;
  let late = 0;
  let lateCount = 0;
  let grantedCount = 0;
  let grantedValue = 0;
  let cancelledCount = 0;
  let cancelledRefunds = 0;

  for (const uo of input.memberships) {
    const id = String(uo._id);
    if (uo.status === "cancelled") {
      cancelledCount++;
      cancelledRefunds += kwdToMils(uo.refundedKwd);
      continue;
    }
    if (!SOLD_STATUSES.includes(uo.status)) continue;

    const paid = paidByMembership.get(id) ?? 0;
    if (paid === 0 && (uo.purchaseMode === "free" || hasGrantPayment.has(id))) {
      grantedCount++;
      grantedValue += kwdToMils(input.offerPrices.get(String(uo.offerId)));
      continue;
    }
    packagesSold++;

    let unpaid = 0;
    const schedule = uo.installmentSchedule ?? [];
    if (schedule.length) {
      for (const inst of schedule) {
        if (inst.paid) continue;
        const mils = kwdToMils(inst.amountKwd);
        unpaid += mils;
        if (inst.dueDate && new Date(inst.dueDate).getTime() < now.getTime()) {
          late += mils;
          lateCount++;
        }
      }
    } else if (uo.status === "reserved") {
      const price = kwdToMils(input.offerPrices.get(String(uo.offerId)));
      unpaid = Math.max(0, price - paid);
    }
    if (unpaid > 0) {
      outstanding += unpaid;
      outstandingCount++;
    }
  }

  return {
    revenueKwd: milsToKwd(collected - refunds),
    collectedKwd: milsToKwd(collected),
    refundsKwd: milsToKwd(refunds),
    paymentsCount,
    refundsCount,
    byMethod: [...byMethod.entries()]
      .sort((a, b) => b[1].mils - a[1].mils)
      .map(([method, v]) => ({ method, count: v.count, totalKwd: milsToKwd(v.mils) })),
    packagesSold,
    outstandingKwd: milsToKwd(outstanding),
    outstandingCount,
    lateKwd: milsToKwd(late),
    lateCount,
    granted: { count: grantedCount, listValueKwd: milsToKwd(grantedValue) },
    cancelled: { count: cancelledCount, refundedKwd: milsToKwd(cancelledRefunds) },
    points: [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, mils]) => ({ bucket, revenueKwd: milsToKwd(mils) })),
    topPackages: [...byOffer.entries()]
      .filter(([, v]) => v.mils !== 0)
      .sort((a, b) => b[1].mils - a[1].mils)
      .slice(0, 5)
      .map(([offerId, v]) => ({
        offerId,
        offerName: input.offerNames?.get(offerId) || (offerId ? offerId : "Other"),
        count: v.count,
        revenueKwd: milsToKwd(v.mils),
      })),
  };
}

/** Package revenue for a period (Kuwait dates, inclusive). No dates = all time. */
export async function computePackageRevenue(filters: { from?: string; to?: string; granularity?: RevenueGranularity } = {}) {
  const range = kwDateRange(filters.from, filters.to);

  const paymentQ: Record<string, unknown> = {
    $or: [
      { status: { $in: [...PAID_STATUSES] }, purpose: { $ne: "session_payment" } },
      { status: "refunded" },
    ],
  };
  const membershipQ: Record<string, unknown> = { isStandalone: { $ne: true } };
  if (range) {
    paymentQ.createdAt = range;
    membershipQ.createdAt = range;
  }

  const [payments, memberships] = await Promise.all([
    PaymentModel.find(paymentQ).select("userOfferId offerId status purpose method amountKwd createdAt").lean(),
    UserOfferModel.find(membershipQ)
      .select("offerId status purchaseMode installmentSchedule depositAmountKwd refundedKwd")
      .lean(),
  ]);

  const membershipIds = (memberships as any[]).map((m) => m._id);
  const offerIds = [
    ...new Set([...(memberships as any[]), ...(payments as any[])].map((m) => (m.offerId ? String(m.offerId) : "")).filter(Boolean)),
  ];
  const [membershipPayments, offers] = await Promise.all([
    membershipIds.length
      ? PaymentModel.find({ userOfferId: { $in: membershipIds }, status: { $in: [...PAID_STATUSES] } })
          .select("userOfferId status purpose method amountKwd")
          .lean()
      : Promise.resolve([]),
    offerIds.length ? OfferModel.find({ _id: { $in: offerIds } }).select("name subscriptionPriceKwd").lean() : Promise.resolve([]),
  ]);

  return summarizePackageRevenue({
    payments: payments as any[],
    memberships: memberships as any[],
    membershipPayments: membershipPayments as any[],
    offerPrices: new Map((offers as any[]).map((o) => [String(o._id), o.subscriptionPriceKwd || "0.000"])),
    offerNames: new Map((offers as any[]).map((o) => [String(o._id), String(o.name ?? "")])),
    granularity: filters.granularity,
  });
}
