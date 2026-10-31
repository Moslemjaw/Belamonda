// Cancelling a membership with a refund, the clinic sessions download, and overdue installments.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import mongoose from "mongoose";
import { api, makeMembership, makeUser } from "./helpers.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
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

  it("the PDF copes with Arabic letters the font can't position", async () => {
    const { renderReportPdf } = await import("../src/modules/reporting/reportRender.js");
    const names = ["آيه كمال حمود", "مرآة قرآن", "ۀ ۂ ۖ", "مُحَمَّد"];
    const pdf = await renderReportPdf({
      type: "payments_ledger",
      title: { en: "Test", ar: "آيه" },
      from: today,
      to: today,
      generatedAt: new Date().toISOString(),
      cards: [],
      notes: [],
      tables: [{ id: "t", title: { en: "T", ar: "T" }, columns: [{ key: "name", label: { en: "Name", ar: "الاسم" } }], rows: names.map((name) => ({ name })) }],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("the Arabic PDF font is installed (without it Arabic names print as garbage)", () => {
    const require = createRequire(import.meta.url);
    expect(require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff")).toBeTruthy();
    expect(require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff")).toBeTruthy();
  });
});

describe("manual entries", () => {
  it("package payments staff recorded are not manual entries and can't be deleted from there", async () => {
    const s = await paidMembership();
    const fin = await makeUser("finance");
    const pkg = await s.pay({ isManual: true, provider: "manual" });
    const entry = await api().post("/reporting/finance/manual-payment").set(auth(fin.token)).send({ amountKwd: "50", method: "cash" });
    expect(entry.status).toBe(201);

    const list = await api().get(`/reporting/finance/manual-payments?from=${today}&to=${today}`).set(auth(fin.token));
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([entry.body.payment.id]);
    const tab = await api().get(`/reporting/finance/payments-breakdown?type=manual&from=${today}&to=${today}`).set(auth(fin.token));
    expect(tab.body.items).toHaveLength(1);

    const ledger = await api().get(`/reporting/finance/report?type=payments_ledger&from=${today}&to=${today}`).set(auth(fin.token));
    const types = Object.fromEntries(ledger.body.tables[0].rows.map((r: { id: string; type: string }) => [r.id, r.type]));
    expect(types[String(pkg._id)]).toBe("Package");
    expect(types[entry.body.payment.id]).toBe("Manual entry");

    expect((await api().delete(`/reporting/finance/manual-payment/${pkg._id}`).set(auth(fin.token))).status).toBe(404);
    expect(await PaymentModel.countDocuments({ _id: pkg._id })).toBe(1);
    expect((await api().delete(`/reporting/finance/manual-payment/${entry.body.payment.id}`).set(auth(fin.token))).status).toBe(200);
  });
});

describe("paying clinics per session", () => {
  async function setup() {
    const s = await paidMembership();
    const fin = await makeUser("finance");
    const when = new Date();
    const add = (status: string) =>
      BookingSessionModel.create({ userOfferId: s.m.userOfferId, userId: s.customer.id, offerId: new mongoose.Types.ObjectId(), clinicId: s.m.clinicId, status, scheduledBy: "x", scheduledAt: when, sessionPriceKwd: "10.000" });
    const toggle = (id: unknown, paid: boolean, token = fin.token) =>
      api().put(`/reporting/finance/clinic-sessions/${id}/paid-to-clinic`).set(auth(token)).send({ paid });
    const report = async () => (await api().get(`/reporting/finance/clinic-sessions?from=${today}&to=${today}`).set(auth(fin.token))).body;
    return { ...s, fin, add, toggle, report };
  }

  it("ticking and unticking updates the session, the totals and the audit log", async () => {
    const s = await setup();
    const a = await s.add("completed");
    await s.add("completed");
    expect((await s.toggle(a._id, true)).status).toBe(200);
    let r = await s.report();
    expect(r.totals).toMatchObject({ completed: 2, paidToClinicCount: 1 });
    expect(r.clinics[0]).toMatchObject({ paidToClinicCount: 1 });
    expect(r.rows.filter((x: { paidToClinic: boolean }) => x.paidToClinic)).toHaveLength(1);
    const saved = await BookingSessionModel.findById(a._id).lean<{ paidToClinicBy?: string; paidToClinicAt?: Date }>();
    expect(saved?.paidToClinicBy).toBe(s.fin.id);
    expect(await mongoose.connection.collection("auditlogs").countDocuments({ actionType: "session_paid_to_clinic" })).toBe(1);

    expect((await s.toggle(a._id, false)).status).toBe(200);
    r = await s.report();
    expect(r.totals).toMatchObject({ paidToClinicCount: 0 });
    expect(await mongoose.connection.collection("auditlogs").countDocuments({ actionType: "session_paid_to_clinic_undone" })).toBe(1);
  });

  it("ticking twice records it once", async () => {
    const s = await setup();
    const a = await s.add("completed");
    await s.toggle(a._id, true);
    await s.toggle(a._id, true);
    expect(await mongoose.connection.collection("auditlogs").countDocuments({ actionType: "session_paid_to_clinic" })).toBe(1);
  });

  it("only completed sessions, only finance and admin", async () => {
    const s = await setup();
    const noShow = await s.add("no_show");
    const done = await s.add("completed");
    expect((await s.toggle(noShow._id, true)).status).toBe(409);
    const cs = await makeUser("cs");
    expect((await s.toggle(done._id, true, cs.token)).status).toBe(403);
    expect((await s.toggle(done._id, true, s.customer.token)).status).toBe(403);
    expect((await s.toggle(new mongoose.Types.ObjectId(), true)).status).toBe(404);
    expect((await api().put(`/reporting/finance/clinic-sessions/${done._id}/paid-to-clinic`).set(auth(s.fin.token)).send({})).status).toBe(400);
  });

  it("the downloads include it", async () => {
    const s = await setup();
    const a = await s.add("completed");
    await s.toggle(a._id, true);
    const doc = (await api().get(`/reporting/finance/report?type=clinic_sessions&from=${today}&to=${today}`).set(auth(s.fin.token))).body;
    expect(doc.tables[1].rows[0].paidToClinic).toBe("Yes");
    expect(doc.cards.find((c: { label: { en: string } }) => c.label.en === "Paid to clinics").value).toBe("1 / 1");
    for (const url of [`/reporting/finance/clinic-sessions/export?from=${today}&to=${today}`, `/reporting/finance/report/export?type=clinic_sessions&from=${today}&to=${today}&format=pdf`]) {
      expect((await api().get(url).set(auth(s.fin.token))).status).toBe(200);
    }
  });
});
