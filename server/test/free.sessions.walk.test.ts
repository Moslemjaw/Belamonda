// Walks real sessions one after another through booking, clinic confirm, POS and completion,
// checking the fee of each one, on unlimited and fixed-size packages.
import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { api, makeClinicStaff, makeMembership, makeUser } from "./helpers.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type Row = { session: number; quote: string; free: boolean; price: string; payment: string | null; clinicTake: string; finalPaid: string; used: number };

async function setup(offer: Record<string, unknown>) {
  const customer = await makeUser("customer");
  const admin = await makeUser("admin");
  const m = await makeMembership(customer.id, { offer });
  const staff = await makeClinicStaff(m.clinicId);
  return { customer, admin, m, staff };
}

const clearThrottle = () => mongoose.connection.collection("job_locks").deleteMany({});

/** One whole session. Returns what was charged at each step, or the refusal. */
async function runSession(s: Awaited<ReturnType<typeof setup>>, session: number): Promise<Row | { session: number; refused: string }> {
  await clearThrottle();
  const quote = (await api().get(`/scheduling/me/booking-quote?userOfferId=${s.m.userOfferId}`).set(auth(s.customer.token))).body;
  const booked = await api().post("/scheduling/me/request").set(auth(s.customer.token)).send({ userOfferId: s.m.userOfferId });
  if (booked.status !== 201) return { session, refused: booked.body.error };
  const id = booked.body.request.id;

  const payment = await PaymentModel.findOne({ bookingRequestId: id, purpose: "session_payment" }).lean<{ amountKwd: string } | null>();
  const list = await api().get("/scheduling/cs/requests").set(auth(s.admin.token));
  const row = list.body.items.find((i: { id: string }) => i.id === id);

  const when = new Date(Date.now() + session * 3600_000).toISOString();
  const confirm = await api().post(`/scheduling/clinic/requests/${id}/confirm`).set(auth(s.staff.token)).send({ scheduledAt: when });
  expect(confirm.status).toBe(201);
  const paid = await api().post(`/scheduling/requests/${id}/mark-paid`).set(auth(s.staff.token)).send({});
  expect(paid.status).toBe(200);
  const done = await api().post(`/scheduling/clinic/sessions/${confirm.body.session.id}/mark`).set(auth(s.admin.token)).send({ status: "completed" });
  expect(done.status).toBe(200);

  const breq = await BookingRequestModel.findById(id).lean<any>();
  const uo = await UserOfferModel.findById(s.m.userOfferId).lean<{ sessionsUsed?: number }>();
  return {
    session,
    quote: quote.clinicPayKwd,
    free: !!breq.isFreeSession,
    price: breq.sessionPriceKwd,
    payment: payment?.amountKwd ?? null,
    clinicTake: row.clinicTakeKwd,
    finalPaid: breq.finalPaidKwd,
    used: uo.sessionsUsed ?? 0,
  };
}

async function runAll(s: Awaited<ReturnType<typeof setup>>, count: number) {
  const rows: (Row | { session: number; refused: string })[] = [];
  for (let i = 1; i <= count; i++) rows.push(await runSession(s, i));
  return rows;
}

const free = (session: number, used = session) => ({ session, quote: "0.000", free: true, price: "0.000", payment: null, clinicTake: "0.000", finalPaid: "0.000", used });
const charged = (session: number, fee: string, used = session) => ({ session, quote: fee, free: false, price: fee, payment: fee, clinicTake: fee, finalPaid: fee, used });

describe("fee of every session", () => {
  beforeEach(clearThrottle);

  it("unlimited package, first 3 free, then the fee", async () => {
    const s = await setup({ maxSessions: undefined, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 3 });
    expect(await runAll(s, 6)).toEqual([free(1), free(2), free(3), charged(4, "5.000"), charged(5, "5.000"), charged(6, "5.000")]);
  }, 60_000);

  it("unlimited package, first 1 free", async () => {
    const s = await setup({ maxSessions: undefined, payPerSession: true, sessionPriceKwd: "9.900", freeSessionsCount: 1 });
    expect(await runAll(s, 3)).toEqual([free(1), charged(2, "9.900"), charged(3, "9.900")]);
  }, 60_000);

  it("unlimited package with no free sessions still charges from the first", async () => {
    const s = await setup({ maxSessions: undefined, payPerSession: true, sessionPriceKwd: "5.000" });
    expect(await runAll(s, 2)).toEqual([charged(1, "5.000"), charged(2, "5.000")]);
  }, 60_000);

  it("fixed package of 4, first 2 free, then the fee, then it stops", async () => {
    const s = await setup({ maxSessions: 4, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 2 });
    expect(await runAll(s, 5)).toEqual([free(1), free(2), charged(3, "5.000"), charged(4, "5.000"), { session: 5, refused: "MAX_SESSIONS_REACHED" }]);
  }, 60_000);

  it("fixed package where every session is free", async () => {
    const s = await setup({ maxSessions: 2, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 2 });
    expect(await runAll(s, 3)).toEqual([free(1), free(2), { session: 3, refused: "MAX_SESSIONS_REACHED" }]);
  }, 60_000);

  it("fixed package with paid extras: free, fee, then the extra session price", async () => {
    const s = await setup({ maxSessions: 3, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 1, allowExtraPaidSessions: true, extraSessionPriceKwd: "12.000" });
    expect(await runAll(s, 5)).toEqual([free(1), charged(2, "5.000"), charged(3, "5.000"), charged(4, "12.000"), charged(5, "12.000")]);
  }, 60_000);

  it("the clinic's own fee is used after the free sessions", async () => {
    const customer = await makeUser("customer");
    const seed = await makeMembership(customer.id, { offer: { maxSessions: undefined, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 1 } });
    await mongoose.connection.collection("offers").updateOne(
      { _id: new mongoose.Types.ObjectId(seed.offerId) },
      { $set: { branchSessionPrices: [{ clinicId: seed.clinicId, sessionPriceKwd: "7.500" }] } }
    );
    const { offerCache } = await import("../src/utils/caches.js").catch(() => ({ offerCache: null as any }));
    offerCache?.clear?.();
    const s = { customer, admin: await makeUser("admin"), m: seed, staff: await makeClinicStaff(seed.clinicId) };
    expect(await runAll(s, 2)).toEqual([free(1), charged(2, "7.500")]);
  }, 60_000);

  it("extras at the clinic are still charged on a free session", async () => {
    const s = await setup({ maxSessions: undefined, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 1 });
    const id = (await api().post("/scheduling/me/request").set(auth(s.customer.token)).send({ userOfferId: s.m.userOfferId })).body.request.id;
    await api().post(`/scheduling/clinic/requests/${id}/confirm`).set(auth(s.staff.token)).send({ scheduledAt: new Date(Date.now() + 3600_000).toISOString() });
    const res = await api().post(`/scheduling/requests/${id}/mark-paid`).set(auth(s.staff.token)).send({ extraItems: [{ name: "Mask", priceKwd: "4.000", qty: 1 }] });
    expect(res.status).toBe(200);
    expect(await BookingRequestModel.findById(id).lean<any>()).toMatchObject({ totalBillKwd: "4.000", finalPaidKwd: "4.000" });
  }, 60_000);

  it("a cancelled free session is given back", async () => {
    const s = await setup({ maxSessions: undefined, payPerSession: true, sessionPriceKwd: "5.000", freeSessionsCount: 1 });
    const id = (await api().post("/scheduling/me/request").set(auth(s.customer.token)).send({ userOfferId: s.m.userOfferId })).body.request.id;
    expect((await api().post(`/scheduling/me/requests/${id}/cancel`).set(auth(s.customer.token)).send({})).status).toBe(200);
    expect(await runAll(s, 2)).toEqual([free(1), charged(2, "5.000")]);
  }, 60_000);
});

describe("the Book button while a booking is open", () => {
  const active = async (s: Awaited<ReturnType<typeof setup>>) => {
    const res = await api().get("/commerce/me/offers").set(auth(s.customer.token));
    return res.body.items.find((i: { id: string }) => i.id === s.m.userOfferId).hasActiveBooking;
  };

  it("locks after booking, and unlocks once the request is over a day old so booking again can clear it", async () => {
    const s = await setup({ maxSessions: undefined });
    expect(await active(s)).toBe(false);
    const id = (await api().post("/scheduling/me/request").set(auth(s.customer.token)).send({ userOfferId: s.m.userOfferId })).body.request.id;
    expect(await active(s)).toBe(true);

    await BookingRequestModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { createdAt: new Date(Date.now() - 2 * 86_400_000) } }
    );
    expect(await active(s)).toBe(false);
    await clearThrottle();
    expect((await api().post("/scheduling/me/request").set(auth(s.customer.token)).send({ userOfferId: s.m.userOfferId })).status).toBe(201);
    expect((await BookingRequestModel.findById(id).lean<{ status: string }>())?.status).toBe("cancelled");
  });
});
