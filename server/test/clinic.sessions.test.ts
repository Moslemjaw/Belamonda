import { describe, expect, it } from "vitest";
import { buildSessionRow, summarizeClinicSessions } from "../src/modules/reporting/clinicSessions.service.js";

const clinicA = { nameEn: "Clinic A", nameAr: "مركز أ" };
const clinicB = { nameEn: "Clinic B", nameAr: "مركز ب" };

describe("clinic sessions report rows", () => {
  it("uses the full bill, cashback from the request and the final paid amount", () => {
    const row = buildSessionRow({
      session: { _id: "s1", clinicId: "A", userId: "u1", status: "completed", scheduledAt: "2026-10-05T10:00:00Z", totalBillKwd: "35.000", finalPaidKwd: "15.000", clinicPaymentStatus: "paid" },
      request: { cashbackDeductedKwd: "20.000" },
      clinic: clinicA,
      customer: { fullName: "Azza", phone: "98083417" },
      offerName: "Cashback Pkg",
    });
    expect(row).toMatchObject({
      clinicNameEn: "Clinic A",
      customerName: "Azza",
      customerPhone: "98083417",
      packageName: "Cashback Pkg",
      sessionValueKwd: "35.000",
      cashbackKwd: "20.000",
      paidAtClinicKwd: "15.000",
      clinicMarkedPaid: true,
    });
  });

  it("falls back to price + extras, and paid = value - cashback", () => {
    const row = buildSessionRow({
      session: { _id: "s2", clinicId: "A", status: "completed", sessionPriceKwd: "20.000", extraItems: [{ name: "Mask", priceKwd: "5.000", qty: 2 }] },
      payment: { cashbackAppliedKwd: "8.000" },
      clinic: clinicA,
    });
    expect(row.sessionValueKwd).toBe("30.000");
    expect(row.cashbackKwd).toBe("8.000");
    expect(row.paidAtClinicKwd).toBe("22.000");
    expect(row.extras).toBe("Mask x2");
  });

  it("no-shows carry no money; standalone and cancelled memberships are labelled", () => {
    const row = buildSessionRow({
      session: { _id: "s3", clinicId: "A", status: "no_show", sessionPriceKwd: "20.000" },
      request: { isStandalone: true, standaloneName: "Laser" },
      membership: { status: "cancelled" },
      clinic: clinicA,
    });
    expect(row.sessionValueKwd).toBe("0.000");
    expect(row.paidAtClinicKwd).toBe("0.000");
    expect(row.packageName).toBe("Laser");
    expect(row.membershipCancelled).toBe(true);
  });
});

describe("clinic session value from real records", () => {
  it("a stored 0.000 bill doesn't hide the session price", () => {
    const row = buildSessionRow({
      session: { _id: "s4", clinicId: "A", status: "completed", totalBillKwd: "0.000", finalPaidKwd: "0.000" },
      request: { sessionPriceKwd: "25.000" },
      clinic: clinicA,
    });
    expect(row.sessionValueKwd).toBe("25.000");
    expect(row.paidAtClinicKwd).toBe("25.000");
  });

  it("an extras-only bill on the session adds to the price; its cashback is kept", () => {
    const row = buildSessionRow({
      session: { _id: "s5", clinicId: "A", status: "completed", totalBillKwd: "10.000", finalPaidKwd: "4.000", extraItems: [{ name: "Mask", priceKwd: "10.000", qty: 1 }] },
      request: { sessionPriceKwd: "25.000" },
      clinic: clinicA,
    });
    expect(row.sessionValueKwd).toBe("35.000");
    expect(row.cashbackKwd).toBe("6.000");
    expect(row.paidAtClinicKwd).toBe("29.000");
  });

  it("the full bill from the clinic POS is used", () => {
    const row = buildSessionRow({
      session: { _id: "s6", clinicId: "A", status: "completed", totalBillKwd: "0.000", finalPaidKwd: "0.000" },
      request: { sessionPriceKwd: "25.000", totalBillKwd: "40.000", finalPaidKwd: "30.000", cashbackDeductedKwd: "10.000" },
      clinic: clinicA,
    });
    expect(row.sessionValueKwd).toBe("40.000");
    expect(row.cashbackKwd).toBe("10.000");
    expect(row.paidAtClinicKwd).toBe("30.000");
  });
});

describe("clinic sessions summary", () => {
  it("totals per clinic and overall", () => {
    const rows = [
      buildSessionRow({ session: { _id: "1", clinicId: "A", status: "completed", sessionPriceKwd: "10.000" }, clinic: clinicA }),
      buildSessionRow({ session: { _id: "2", clinicId: "A", status: "no_show", sessionPriceKwd: "10.000" }, clinic: clinicA }),
      buildSessionRow({ session: { _id: "3", clinicId: "B", status: "completed", sessionPriceKwd: "40.000" }, request: { cashbackDeductedKwd: "15.000" }, clinic: clinicB }),
    ];
    const r = summarizeClinicSessions(rows);
    expect(r.clinics.map((c) => c.clinicId)).toEqual(["B", "A"]);
    expect(r.clinics[1]).toMatchObject({ completed: 1, noShow: 1, sessionValueKwd: "10.000", paidAtClinicKwd: "10.000" });
    expect(r.clinics[0]).toMatchObject({ completed: 1, noShow: 0, sessionValueKwd: "40.000", cashbackKwd: "15.000", paidAtClinicKwd: "25.000" });
    expect(r.totals).toEqual({ completed: 2, noShow: 1, sessionValueKwd: "50.000", cashbackKwd: "15.000", paidAtClinicKwd: "35.000", paidToClinicCount: 0 });
  });
});
