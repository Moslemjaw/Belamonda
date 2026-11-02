// A membership's first N sessions carry no session fee; the fee applies after that.
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { api, makeClinicStaff, makeMembership, makeUser } from "./helpers.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { computeBookingRequestFinancials, isNextSessionFree } from "../src/modules/scheduling/scheduling.helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const paid = { payPerSession: true, sessionPriceKwd: "5.000", maxSessions: undefined };

async function setup(freeSessionsCount: number, sessionsUsed = 0) {
  const customer = await makeUser("customer");
  const m = await makeMembership(customer.id, { offer: { ...paid, freeSessionsCount } });
  if (sessionsUsed) await UserOfferModel.updateOne({ _id: m.userOfferId }, { $set: { sessionsUsed } });
  const book = (body: Record<string, unknown> = {}) =>
    api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: m.userOfferId, ...body });
  const quote = async () => (await api().get(`/scheduling/me/booking-quote?userOfferId=${m.userOfferId}`).set(auth(customer.token))).body;
  return { customer, m, book, quote };
}

describe("free first sessions", () => {
  it("the rule: free while sessions used are below the count", () => {
    expect(isNextSessionFree({ freeSessionsCount: 3 }, 0)).toBe(true);
    expect(isNextSessionFree({ freeSessionsCount: 3 }, 2)).toBe(true);
    expect(isNextSessionFree({ freeSessionsCount: 3 }, 3)).toBe(false);
    expect(isNextSessionFree({ freeSessionsCount: 0 }, 0)).toBe(false);
  });

  it("a free session has no fee and no payment, even if the client sends a price", async () => {
    const s = await setup(3);
    expect((await s.quote())).toMatchObject({ isFreeSession: true, clinicPayKwd: "0.000", sessionGrossKwd: "0.000" });
    const res = await s.book({ sessionGrossKwd: "25.000", cashbackAppliedKwd: "2.000" });
    expect(res.status).toBe(201);
    expect(res.body.sessionPaymentRequired).toBeUndefined();
    const breq = await BookingRequestModel.findById(res.body.request.id).lean<any>();
    expect(breq).toMatchObject({ isFreeSession: true, sessionPriceKwd: "0.000", hadCashback: false });
    expect(await PaymentModel.countDocuments({ userOfferId: s.m.userOfferId })).toBe(0);
  });

  it("the last free session is free, the one after it is charged", async () => {
    const last = await setup(3, 2);
    expect((await last.book()).body.request.isFreeSession).toBe(true);

    const next = await setup(3, 3);
    expect(await next.quote()).toMatchObject({ isFreeSession: false, clinicPayKwd: "5.000" });
    const res = await next.book();
    expect(res.status).toBe(201);
    expect(res.body.sessionPaymentRequired).toBe(true);
    expect(res.body.sessionPriceKwd).toBe("5.000");
    expect(await PaymentModel.countDocuments({ userOfferId: next.m.userOfferId, purpose: "session_payment" })).toBe(1);
  });

  it("sessions already booked count, and cancelling one gives the free session back", async () => {
    const s = await setup(1);
    const session = await BookingSessionModel.create({
      userOfferId: s.m.userOfferId, userId: s.customer.id, offerId: new mongoose.Types.ObjectId(), clinicId: s.m.clinicId,
      status: "completed", scheduledBy: "x", scheduledAt: new Date(),
    });
    expect((await s.quote()).isFreeSession).toBe(false);
    await BookingSessionModel.updateOne({ _id: session._id }, { $set: { status: "cancelled" } });
    expect((await s.quote()).isFreeSession).toBe(true);
  });

  it("the clinic collects nothing, with the offer's price and cashback ignored", () => {
    const offer: any = { payPerSession: true, sessionPriceKwd: "5.000", branchSessionPrices: [], branchExtraSessionPrices: [], cashbackPerSessionKwd: "2.000" };
    expect(computeBookingRequestFinancials({ clinicId: "c", isFreeSession: true, membershipType: "cashback", sessionPriceKwd: "0.000" }, offer)).toMatchObject({
      sessionGrossKwd: "0.000", clinicTakeKwd: "0.000", cashbackDeductedKwd: "0.000", usesCashback: false,
    });
    expect(computeBookingRequestFinancials({ clinicId: "c" }, offer).clinicTakeKwd).toBe("5.000");
  });

  it("from booking to the clinic's POS, a free session collects nothing", async () => {
    const s = await setup(1);
    const admin = await makeUser("admin");
    const staff = await makeClinicStaff(s.m.clinicId);
    const id = (await s.book()).body.request.id;

    const list = await api().get("/scheduling/cs/requests").set(auth(admin.token));
    const row = list.body.items.find((i: any) => i.id === id);
    expect(row).toMatchObject({ sessionGrossKwd: "0.000", clinicTakeKwd: "0.000", isFreeSession: true });

    const when = new Date(Date.now() + 2 * 3600_000).toISOString();
    expect((await api().post(`/scheduling/clinic/requests/${id}/confirm`).set(auth(staff.token)).send({ scheduledAt: when })).status).toBe(201);
    const paidRes = await api().post(`/scheduling/requests/${id}/mark-paid`).set(auth(staff.token)).send({});
    expect(paidRes.status).toBe(200);
    const breq = await BookingRequestModel.findById(id).lean<any>();
    expect(breq).toMatchObject({ totalBillKwd: "0.000", finalPaidKwd: "0.000" });
    expect(await PaymentModel.countDocuments({ userOfferId: s.m.userOfferId })).toBe(0);
  });

  it("the customer's membership shows how many are left", async () => {
    const s = await setup(3, 1);
    const offers = await api().get("/commerce/me/offers").set(auth(s.customer.token));
    const item = offers.body.items.find((i: any) => i.id === s.m.userOfferId);
    expect(item).toMatchObject({ freeSessionsCount: 3, freeSessionsLeft: 2 });
  });

  it("an admin can set it on a package", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id, { offer: paid });
    const res = await api().patch(`/offers/admin/${m.offerId}`).set(auth(admin.token)).send({ freeSessionsCount: 2 });
    expect(res.status).toBe(200);
    expect(res.body.offer.freeSessionsCount).toBe(2);
    expect((await api().patch(`/offers/admin/${m.offerId}`).set(auth(admin.token)).send({ freeSessionsCount: -1 })).status).toBe(400);
  });
});
