import { describe, expect, it } from "vitest";
import { summarizePackageRevenue } from "../src/modules/reporting/revenue.service.js";

const now = new Date("2026-10-30T12:00:00Z");
const prices = new Map([["offerA", "300.000"], ["offerFree", "150.000"]]);

function summarize(input: Partial<Parameters<typeof summarizePackageRevenue>[0]>) {
  return summarizePackageRevenue({ payments: [], memberships: [], membershipPayments: [], offerPrices: prices, now, ...input });
}

describe("package revenue", () => {
  it("counts paid and legacy completed package payments, not sessions or pending", () => {
    const r = summarize({
      payments: [
        { status: "paid", purpose: "enrollment_full", method: "cash", amountKwd: "300.000" },
        { status: "completed", purpose: "installment", method: "k-net", amountKwd: "100.000" },
        { status: "paid", purpose: "session_payment", method: "pos", amountKwd: "25.000" },
        { status: "payment_pending", purpose: "enrollment_full", method: "cash", amountKwd: "300.000" },
        { status: "failed", purpose: "enrollment_full", method: "cash", amountKwd: "300.000" },
      ],
    });
    expect(r.collectedKwd).toBe("400.000");
    expect(r.revenueKwd).toBe("400.000");
    expect(r.paymentsCount).toBe(2);
    expect(r.byMethod).toEqual([
      { method: "cash", count: 1, totalKwd: "300.000" },
      { method: "k-net", count: 1, totalKwd: "100.000" },
    ]);
  });

  it("subtracts refunds in the period", () => {
    const r = summarize({
      payments: [
        { status: "paid", purpose: "enrollment_full", method: "cash", amountKwd: "300.000" },
        { status: "refunded", purpose: "refund", method: "bank_transfer", amountKwd: "120.000" },
      ],
    });
    expect(r.collectedKwd).toBe("300.000");
    expect(r.refundsKwd).toBe("120.000");
    expect(r.revenueKwd).toBe("180.000");
  });

  it("only paid installments are revenue; the rest is outstanding, and overdue ones are late", () => {
    const r = summarize({
      payments: [{ userOfferId: "m1", status: "paid", purpose: "installment", method: "cash", amountKwd: "100.000" }],
      memberships: [
        {
          _id: "m1",
          offerId: "offerA",
          status: "active",
          purchaseMode: "installments",
          installmentSchedule: [
            { amountKwd: "100.000", paid: true },
            { amountKwd: "100.000", paid: false, dueDate: "2026-10-01T00:00:00Z" },
            { amountKwd: "100.000", paid: false, dueDate: "2026-11-30T00:00:00Z" },
          ],
        },
      ],
      membershipPayments: [{ userOfferId: "m1", status: "paid", purpose: "installment", method: "cash", amountKwd: "100.000" }],
    });
    expect(r.revenueKwd).toBe("100.000");
    expect(r.packagesSold).toBe(1);
    expect(r.outstandingKwd).toBe("200.000");
    expect(r.outstandingCount).toBe(1);
    expect(r.lateKwd).toBe("100.000");
    expect(r.lateCount).toBe(1);
  });

  it("0 KWD and free packages are granted, not revenue or sales", () => {
    const r = summarize({
      payments: [
        { userOfferId: "g1", status: "paid", purpose: "enrollment_full", method: "bank_transfer", amountKwd: "0.000" },
      ],
      memberships: [
        { _id: "g1", offerId: "offerA", status: "active", purchaseMode: "full" },
        { _id: "g2", offerId: "offerFree", status: "active", purchaseMode: "free" },
      ],
      membershipPayments: [
        { userOfferId: "g1", status: "paid", purpose: "enrollment_full", method: "bank_transfer", amountKwd: "0.000" },
      ],
    });
    expect(r.revenueKwd).toBe("0.000");
    expect(r.packagesSold).toBe(0);
    expect(r.granted).toEqual({ count: 2, listValueKwd: "450.000" });
  });

  it("cancelled memberships are counted separately with their refunds", () => {
    const r = summarize({
      memberships: [
        { _id: "c1", offerId: "offerA", status: "cancelled", refundedKwd: "50.000" },
        { _id: "p1", offerId: "offerA", status: "pending_payment" },
      ],
    });
    expect(r.cancelled).toEqual({ count: 1, refundedKwd: "50.000" });
    expect(r.packagesSold).toBe(0);
  });
});

describe("revenue chart and top packages", () => {
  const payments = [
    { offerId: "offerA", status: "paid", purpose: "enrollment_full", method: "cash", amountKwd: "300.000", createdAt: "2026-10-01T10:00:00Z" },
    { offerId: "offerA", status: "completed", purpose: "installment", method: "cash", amountKwd: "100.000", createdAt: "2026-10-01T22:30:00Z" },
    { offerId: "offerB", status: "paid", purpose: "enrollment_full", method: "k-net", amountKwd: "150.000", createdAt: "2026-10-09T09:00:00Z" },
    { offerId: "offerB", status: "paid", purpose: "session_payment", method: "pos", amountKwd: "20.000", createdAt: "2026-10-09T09:00:00Z" },
    { offerId: "offerA", status: "refunded", purpose: "refund", method: "cash", amountKwd: "50.000", createdAt: "2026-10-20T09:00:00Z" },
    { offerId: "offerB", status: "paid", purpose: "enrollment_full", method: "cash", amountKwd: "0.000", createdAt: "2026-10-21T09:00:00Z" },
  ];
  const names = new Map([["offerA", "Gold"], ["offerB", "Silver"]]);
  const sum = (pts: { revenueKwd: string }[]) => pts.reduce((s, p) => s + Math.round(parseFloat(p.revenueKwd) * 1000), 0);

  for (const granularity of ["daily", "weekly", "monthly"] as const) {
    it(`${granularity} chart total equals the revenue card`, () => {
      const r = summarize({ payments, granularity, offerNames: names });
      expect(r.revenueKwd).toBe("500.000");
      expect(sum(r.points)).toBe(500_000);
    });
  }

  it("buckets by Kuwait date, not UTC", () => {
    const r = summarize({ payments, granularity: "daily" });
    // 22:30 UTC on 1 Oct is 01:30 on 2 Oct in Kuwait
    expect(r.points.map((p) => p.bucket)).toEqual(["2026-10-01", "2026-10-02", "2026-10-09", "2026-10-20"]);
    expect(summarize({ payments, granularity: "weekly" }).points[0].bucket).toBe("2026-09-28");
    expect(summarize({ payments, granularity: "monthly" }).points).toEqual([{ bucket: "2026-10", revenueKwd: "500.000" }]);
  });

  it("ranks packages by revenue net of refunds, excluding sessions", () => {
    const r = summarize({ payments, offerNames: names });
    expect(r.topPackages).toEqual([
      { offerId: "offerA", offerName: "Gold", count: 2, revenueKwd: "350.000" },
      { offerId: "offerB", offerName: "Silver", count: 1, revenueKwd: "150.000" },
    ]);
  });
});

describe("paid via label", () => {
  it("shows every package payment as the Belamonda payment link, whatever method was stored", async () => {
    const { paidViaLabel } = await import("../src/services/financeRevenue.js");
    for (const method of ["bank_transfer", "link", "k-net", "cash", "pos", "enet", "other"]) {
      expect(paidViaLabel({ status: "paid", purpose: "enrollment_full", method })).toBe("Payment link (Belamonda team)");
    }
    expect(paidViaLabel({ status: "paid", purpose: "session_payment", method: "pos" })).toBe("At clinic");
    expect(paidViaLabel({ status: "refunded", purpose: "refund", method: "link" })).toBe("Refund");
    expect(paidViaLabel({ status: "paid", purpose: "enrollment_full", method: "free_package" })).toBe("Granted");
    expect(paidViaLabel({ status: "paid", purpose: "installment", method: "wallet" })).toBe("Cashback");
  });
});
