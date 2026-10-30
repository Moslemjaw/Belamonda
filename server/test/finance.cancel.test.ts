// Cancelling a membership with a refund, the clinic sessions download, and overdue installments.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import mongoose from "mongoose";
import { api, makeMembership, makeUser } from "./helpers.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const DAY = 86_400_000;

async function paidMembership() {
  const customer = await makeUser("customer");
  const admin = await makeUser("admin");
  const m = await makeMembership(customer.id);
  const offerId = (await UserOfferModel.findById(m.userOfferId).lean<{ offerId: unknown }>())!.offerId;
  const pay = (o: Record<string, unknown> = {}) =>
    PaymentModel.create({ userId: customer.id, offerId, userOfferId: m.userOfferId, method: "cash", status: "paid", purpose: "enrollment_full", amountKwd: "100.000", ...o });
  const cancel = (body: Record<string, unknown>) =>
    api().post(`/commerce/admin/user-offers/${m.userOfferId}/cancel`).set(auth(admin.token)).send(body);
  const revenue = async () => (await api().get(`/reporting/finance/revenue?from=${today}&to=${today}`).set(auth(admin.token))).body;
  const refunds = () => PaymentModel.countDocuments({ userOfferId: m.userOfferId, purpose: "refund" });
  return { customer, admin, m, pay, cancel, revenue, refunds };
}
const fullRefund = { reason: "Customer asked", refund: { type: "full", method: "cash" } };

describe("cancelling a membership with a refund", () => {
  it("a double click records one refund", async () => {
    const s = await paidMembership();
    await s.pay();
    const statuses = (await Promise.all([s.cancel(fullRefund), s.cancel(fullRefund)])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(await s.refunds()).toBe(1);
    expect((await s.revenue()).revenueKwd).toBe("0.000");
  });

  it("a full refund covers the package only, not session payments", async () => {
    const s = await paidMembership();
    await s.pay();
    await s.pay({ purpose: "session_payment", amountKwd: "20.000" });
    const r = await s.cancel(fullRefund);
    expect(r.body.refundedKwd).toBe("100.000");
    expect((await s.revenue()).revenueKwd).toBe("0.000");
  });

  it("a partial refund can't exceed what was paid for the package", async () => {
    const s = await paidMembership();
    await s.pay();
    await s.pay({ purpose: "session_payment", amountKwd: "20.000" });
    const tooMuch = await s.cancel({ reason: "x", refund: { type: "partial", amountKwd: "110", method: "cash" } });
    expect(tooMuch.status).toBe(400);
    expect(await s.refunds()).toBe(0);
    expect((await UserOfferModel.findById(s.m.userOfferId).lean<{ status: string }>())!.status).toBe("active");
  });

  it("the membership is kept as cancelled with its payments", async () => {
    const s = await paidMembership();
    await s.pay();
    const r = await s.cancel({ reason: "x", refund: { type: "partial", amountKwd: "30", method: "cash" } });
    expect(r.status).toBe(200);
    const uo = await UserOfferModel.findById(s.m.userOfferId).lean<any>();
    expect(uo).toMatchObject({ status: "cancelled", refundedKwd: "30.000", cancelReason: "x" });
    expect(await PaymentModel.countDocuments({ userOfferId: s.m.userOfferId, status: "paid" })).toBe(1);
    expect((await s.revenue()).revenueKwd).toBe("70.000");
  });
});

describe("clinic sessions download", () => {
  it("returns an Excel file", async () => {
    const fin = await makeUser("finance");
    const res = await api().get(`/reporting/finance/clinic-sessions/export?from=${today}&to=${today}`).set(auth(fin.token));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
  });
});

describe("installments list", () => {
  it("always shows overdue ones, and only those of sold memberships", async () => {
    const fin = await makeUser("finance");
    const add = (status: string) =>
      UserOfferModel.collection.insertOne({
        _id: new mongoose.Types.ObjectId(),
        userId: fin.id,
        offerId: new mongoose.Types.ObjectId(),
        status,
        purchaseMode: "installments",
        installmentSchedule: [
          { number: 1, amountKwd: "10.000", paid: false, dueDate: new Date(Date.now() - 60 * DAY) },
          { number: 2, amountKwd: "10.000", paid: false, dueDate: new Date(Date.now() + 60 * DAY) },
        ],
      } as any);
    await add("active");
    await add("pending_payment");
    const res = await api().get(`/reporting/finance/installments?from=${today}&to=${today}`).set(auth(fin.token));
    expect(res.body.summary).toMatchObject({ lateCount: 1, lateKwd: "10.000", upcomingCount: 0 });
  });
});

describe("finance reports over the API", () => {
  const types = ["monthly_summary", "package_sales", "payments_ledger", "installments_due", "clinic_sessions", "cashback"];

  it.each(types)("%s previews and downloads as Excel and PDF", async (type) => {
    const fin = await makeUser("finance");
    const q = `type=${type}&from=${today}&to=${today}`;
    const preview = await api().get(`/reporting/finance/report?${q}`).set(auth(fin.token));
    expect(preview.status).toBe(200);
    expect(preview.body.type).toBe(type);
    const xlsx = await api().get(`/reporting/finance/report/export?${q}&format=xlsx`).set(auth(fin.token));
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["content-type"]).toContain("spreadsheetml");
    const pdf = await api().get(`/reporting/finance/report/export?${q}&format=pdf`).set(auth(fin.token));
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
  });

  it("is for finance and admin only, and rejects bad input", async () => {
    const customer = await makeUser("customer");
    const cs = await makeUser("cs");
    const fin = await makeUser("finance");
    expect((await api().get("/reporting/finance/report?type=cashback").set(auth(customer.token))).status).toBe(403);
    expect((await api().get("/reporting/finance/report?type=cashback").set(auth(cs.token))).status).toBe(403);
    expect((await api().get("/reporting/finance/report?type=nope").set(auth(fin.token))).status).toBe(400);
    expect((await api().get("/reporting/finance/report?type=cashback&from=abc").set(auth(fin.token))).status).toBe(400);
    expect((await api().get("/reporting/finance/report/export?type=cashback&to=abc").set(auth(fin.token))).status).toBe(400);
    expect((await api().get("/reporting/finance/report/export?type=cashback&format=doc").set(auth(fin.token))).status).toBe(400);
  });

  it("the Arabic PDF font is installed (without it Arabic names print as garbage)", () => {
    const require = createRequire(import.meta.url);
    expect(require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff")).toBeTruthy();
    expect(require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff")).toBeTruthy();
  });
});
