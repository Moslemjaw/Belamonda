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
