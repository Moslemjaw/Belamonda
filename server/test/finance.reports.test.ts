import { describe, expect, it } from "vitest";
import {
  buildInstallmentsDue,
  buildLedgerRow,
  confirmerLabel,
  percentChange,
  previousPeriod,
  reconcileWithLedger,
  summarizeCashbackTxns,
  summarizeLedger,
  summarizePackageSales,
  summarizeReferrals,
  type LedgerPayment,
  type Person,
} from "../src/modules/reporting/financeReports.service.js";
import { summarizePackageRevenue } from "../src/modules/reporting/revenue.service.js";
import { visualTokens } from "../src/modules/reporting/reportRender.js";

const people = new Map<string, Person>([
  ["cs1", { name: "Sara", role: "cs" }],
  ["fin1", { name: "Omar", role: "finance" }],
  ["cust1", { name: "Azza", phone: "98083417", role: "customer" }],
]);
const ctx = { people, offerNames: new Map([["offerA", "Cashback Pkg"]]), clinicNames: new Map(), serviceNames: new Map() };

const payments: LedgerPayment[] = [
  { _id: "p1", userId: "cust1", offerId: "offerA", purpose: "enrollment_full", status: "paid", method: "cash", amountKwd: "300.000", confirmedBy: "cs1" },
  { _id: "p2", userId: "cust1", offerId: "offerA", purpose: "installment", status: "completed", method: "k-net", amountKwd: "100.000", confirmedBy: "system_checkout" },
  { _id: "p3", userId: "cust1", purpose: "session_payment", status: "paid", method: "pos", amountKwd: "25.000" },
  { _id: "p4", userId: "cust1", offerId: "offerA", purpose: "refund", status: "refunded", method: "bank_transfer", amountKwd: "50.000", confirmedBy: "fin1" },
  { _id: "p5", userId: "cust1", offerId: "offerA", purpose: "enrollment_full", status: "payment_pending", method: "cash", amountKwd: "300.000" },
  { _id: "p6", userId: "manual", purpose: "manual_entry", status: "paid", method: "cash", amountKwd: "40.000", isManual: true, manualLabel: "Walk-in", createdByUserId: "fin1" },
];

describe("periods", () => {
  it("previous period has the same length and ends the day before", () => {
    expect(previousPeriod("2026-10-01", "2026-10-31")).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(previousPeriod("2026-10-15", "2026-10-15")).toEqual({ from: "2026-10-14", to: "2026-10-14" });
  });

  it("percent change handles zero", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("payments ledger", () => {
  const rows = payments.map((p) => buildLedgerRow(p, ctx));

  it("classifies rows and says who confirmed them", () => {
    expect(rows.map((r) => r.type)).toEqual(["package", "package", "session", "refund", "package", "manual"]);
    expect(rows[0].confirmedBy).toBe("Customer Service — Sara");
    expect(rows[1].confirmedBy).toBe("Online checkout (system)");
    expect(rows[1].status).toBe("paid");
    expect(rows[3].amountKwd).toBe("-50.000");
    expect(rows[5].confirmedBy).toBe("Finance — Omar");
    expect(rows[5].item).toBe("Walk-in");
  });

  it("totals: package revenue = paid package rows − refunds; sessions and pending excluded", () => {
    const s = summarizeLedger(rows);
    expect(s.packagesKwd).toBe("440.000");
    expect(s.refundsKwd).toBe("50.000");
    expect(s.revenueKwd).toBe("390.000");
    expect(s.sessionsKwd).toBe("25.000");
    expect(s.pendingKwd).toBe("300.000");
  });

  it("matches the dashboard's package revenue for the same payments", () => {
    const dashboard = summarizePackageRevenue({ payments, memberships: [], membershipPayments: [], offerPrices: new Map() });
    expect(reconcileWithLedger(dashboard.revenueKwd, summarizeLedger(rows).revenueKwd)).toEqual({
      ok: true,
      reportTotalKwd: "390.000",
      ledgerTotalKwd: "390.000",
      diffKwd: "0.000",
    });
  });

  it("flags a mismatch", () => {
    expect(reconcileWithLedger("400.000", "390.000")).toEqual({ ok: false, reportTotalKwd: "400.000", ledgerTotalKwd: "390.000", diffKwd: "10.000" });
  });

  it("labels unknown confirmers by id", () => {
    expect(confirmerLabel("abc", people)).toBe("abc");
    expect(confirmerLabel(undefined, people)).toBe("—");
  });
});

describe("package sales", () => {
  it("per-package rows add up to the overall total", () => {
    const input = {
      payments: [
        { userOfferId: "m1", offerId: "A", status: "paid", purpose: "enrollment_full", method: "cash", amountKwd: "300.000" },
        { userOfferId: "m2", status: "paid", purpose: "installment", method: "cash", amountKwd: "100.000" },
        { userOfferId: "m3", offerId: "A", status: "refunded", purpose: "refund", method: "cash", amountKwd: "20.000" },
      ],
      memberships: [
        { _id: "m1", offerId: "A", status: "active", purchaseMode: "full" },
        {
          _id: "m2",
          offerId: "B",
          status: "active",
          purchaseMode: "installments",
          installmentSchedule: [
            { amountKwd: "100.000", paid: true },
            { amountKwd: "100.000", paid: false },
          ],
        },
        { _id: "m3", offerId: "A", status: "cancelled", refundedKwd: "20.000" },
        { _id: "g1", offerId: "B", status: "active", purchaseMode: "free" },
      ],
      membershipPayments: [
        { userOfferId: "m1", status: "paid", purpose: "enrollment_full", method: "cash", amountKwd: "300.000" },
        { userOfferId: "m2", status: "paid", purpose: "installment", method: "cash", amountKwd: "100.000" },
      ],
      offerPrices: new Map([["A", "300.000"], ["B", "200.000"]]),
      offerNames: new Map([["A", "Package A"], ["B", "Package B"]]),
    };
    const { rows, total } = summarizePackageSales(input);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.s]));
    // m2's payment has no offerId; it is matched to Package B through its membership.
    expect(byName["Package A"].revenueKwd).toBe("280.000");
    expect(byName["Package A"].cancelled.count).toBe(1);
    expect(byName["Package B"].revenueKwd).toBe("100.000");
    expect(byName["Package B"].outstandingKwd).toBe("100.000");
    expect(byName["Package B"].granted).toEqual({ count: 1, listValueKwd: "200.000" });
    expect(total.revenueKwd).toBe("380.000");
    const sum = rows.reduce((n, r) => n + Number(r.s.revenueKwd), 0);
    expect(sum.toFixed(3)).toBe(total.revenueKwd);
  });

  it("referrals count package payments of referred buyers only", () => {
    const rows = summarizeReferrals(
      [
        { userId: "b1", userOfferId: "m1", status: "paid", purpose: "enrollment_full", amountKwd: "100.000" },
        { userId: "b1", userOfferId: "m1", status: "paid", purpose: "installment", amountKwd: "50.000" },
        { userId: "b2", userOfferId: "m2", status: "paid", purpose: "session_payment", amountKwd: "30.000" },
        { userId: "b3", userOfferId: "m3", status: "paid", purpose: "enrollment_full", amountKwd: "70.000" },
      ],
      new Map([["b1", "r1"], ["b2", "r1"]])
    );
    expect(rows).toEqual([{ referrerId: "r1", sales: 1, revenueKwd: "150.000" }]);
  });
});

describe("installments due", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  it("lists every late installment and those due by the end of the period, late first", () => {
    const r = buildInstallmentsDue(
      [
        {
          _id: "m1",
          userId: "u1",
          offerId: "A",
          status: "active",
          installmentSchedule: [
            { number: 1, amountKwd: "100.000", paid: true, dueDate: "2026-08-01T00:00:00Z" },
            { number: 2, amountKwd: "100.000", paid: false, dueDate: "2026-09-30T12:00:00Z" },
            { number: 3, amountKwd: "100.000", paid: false, dueDate: "2026-10-31T00:00:00Z" },
            { number: 4, amountKwd: "100.000", paid: false, dueDate: "2026-12-01T00:00:00Z" },
          ],
        },
        { _id: "m2", status: "cancelled", installmentSchedule: [{ number: 1, amountKwd: "50.000", paid: false, dueDate: "2026-09-01T00:00:00Z" }] },
      ],
      now,
      new Date("2026-10-31T20:59:59Z")
    );
    expect(r.rows.map((x) => [x.number, x.status, x.daysLate])).toEqual([
      [2, "late", 30],
      [3, "upcoming", 0],
    ]);
    expect(r.lateKwd).toBe("100.000");
    expect(r.upcomingKwd).toBe("100.000");
  });
});

describe("cashback", () => {
  it("groups by type and lists what staff did", () => {
    const s = summarizeCashbackTxns([
      { userId: "u1", type: "signup_bonus", amountKwd: "10.000", createdBy: { kind: "system", id: "system" } },
      { userId: "u1", type: "adjustment", amountKwd: "100.000", reason: "reffral", createdBy: { kind: "admin", id: "a1" } },
      { userId: "u2", type: "deduction", amountKwd: "5.000", createdBy: { kind: "system", id: "system" } },
      { userId: "u2", type: "session_reward", amountKwd: "2.000", createdBy: { kind: "cs", id: "cs1" } },
    ]);
    expect(s.byType[0]).toMatchObject({ type: "adjustment", count: 1, totalKwd: "100.000" });
    expect(s.staff.map((t) => t.type)).toEqual(["adjustment", "session_reward"]);
    expect(s.usedKwd).toBe("5.000");
    expect(s.staffAddedKwd).toBe("102.000");
  });
});

describe("PDF word order", () => {
  it("keeps plain text as is", () => {
    expect(visualTokens("Azza Mohamed 98083417")).toEqual(["Azza", "Mohamed", "98083417"]);
  });
  it("reverses an Arabic sentence word by word", () => {
    expect(visualTokens("عزة محمد علي")).toEqual(["علي", "محمد", "عزة"]);
  });
  it("keeps English runs in order inside Arabic text and vice versa", () => {
    expect(visualTokens("باقة Cashback Pkg الذهبية")).toEqual(["الذهبية", "Cashback", "Pkg", "باقة"]);
    // As in browsers (Unicode bidi): a number right after Arabic joins the Arabic run.
    expect(visualTokens("Azza عزة محمد 98083417")).toEqual(["Azza", "98083417", "محمد", "عزة"]);
  });
});
