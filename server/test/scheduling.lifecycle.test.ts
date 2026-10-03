// Characterisation tests: pin down the booking life cycle exactly as the live site behaves,
// so the code can be moved into services without changing what it does.
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { api, laterToday, makeClinicStaff, makeMembership, makeUser } from "./helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const sessionsUsed = async (id: string) =>
  (await UserOfferModel.collection.findOne({ _id: new mongoose.Types.ObjectId(id) }))?.sessionsUsed;

async function book(customer: { token: string }, userOfferId: string) {
  return api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId, notes: "test" });
}

describe("customer books a session", () => {
  it("admin-handled membership: request goes to CS as request_received", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    const res = await book(customer, m.userOfferId);
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("request_received");
    expect(res.body.request.bookingRoute).toBe("cs");
  });

  it("clinic-handled membership: request goes straight to the clinic as slot_assigned", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id, { bookingFlow: "direct_clinic" });
    const res = await book(customer, m.userOfferId);
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("slot_assigned");
    expect(res.body.request.bookingRoute).toBe("clinic");
  });

  it("a second open request for the same membership is refused", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    expect((await book(customer, m.userOfferId)).status).toBe(201);
    await new Promise((r) => setTimeout(r, 4100)); // the per-user 4s booking throttle
    const again = await book(customer, m.userOfferId);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("ALREADY_HAVE_OPEN_REQUEST");
  }, 15_000);

  it("an expired membership cannot book", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    await UserOfferModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(m.userOfferId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    const res = await book(customer, m.userOfferId);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("MEMBERSHIP_EXPIRED");
  });
});

describe("admin-handled flow: forward to clinic, clinic confirms", () => {
  it("records the admin suggested date, then the clinic scheduled date, and creates one session", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    const m = await makeMembership(customer.id);
    const staff = await makeClinicStaff(m.clinicId);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const when = laterToday();

    const fwd = await api().post(`/scheduling/cs/requests/${breqId}/propose`).set(auth(admin.token)).send({ scheduledAt: when });
    expect(fwd.status).toBe(200);
    expect(fwd.body.request.status).toBe("slot_assigned");
    expect(new Date(fwd.body.request.adminSuggestedAt).toISOString()).toBe(when);

    const conf = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: when });
    expect(conf.status).toBe(201);
    expect(conf.body.request.status).toBe("scheduled");
    expect(new Date(conf.body.request.clinicScheduledAt).toISOString()).toBe(when);
    expect(conf.body.request.clinicPaymentStatus).toBe("payment_pending");
    expect(conf.body.session.status).toBe("scheduled");
    expect(await sessionsUsed(m.userOfferId)).toBe(1);
    expect(await BookingSessionModel.countDocuments({ userOfferId: m.userOfferId })).toBe(1);
  });

  it("CS/admin confirming on the clinic's behalf marks the clinic payment paid", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    const m = await makeMembership(customer.id);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const conf = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(admin.token)).send({ scheduledAt: laterToday() });
    expect(conf.status).toBe(201);
    expect(conf.body.request.clinicPaymentStatus).toBe("paid");
  });

  it("clinic staff of another clinic are refused", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    const other = await makeClinicStaff(String(new mongoose.Types.ObjectId()));
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const conf = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(other.token)).send({ scheduledAt: laterToday() });
    expect(conf.status).toBe(403);
    expect(conf.body.error).toBe("FORBIDDEN_CLINIC");
  });

  it("a double-clicked clinic confirm creates only one session and uses one session", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    const staff = await makeClinicStaff(m.clinicId);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const when = laterToday();
    const send = () => api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: when });
    const statuses = (await Promise.all([send(), send()])).map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);
    expect(await BookingSessionModel.countDocuments({ userOfferId: m.userOfferId })).toBe(1);
    expect(await sessionsUsed(m.userOfferId)).toBe(1);
  });
});

describe("clinic-handled flow (e.g. Sawa)", () => {
  it("clinic confirms directly, no forwarding step", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id, { bookingFlow: "direct_clinic" });
    const staff = await makeClinicStaff(m.clinicId);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const conf = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: laterToday() });
    expect(conf.status).toBe(201);
    expect(conf.body.request.status).toBe("scheduled");
    expect(conf.body.request.adminSuggestedAt ?? null).toBeNull();
  });
});

describe("customer accepts a proposed slot", () => {
  it("schedules the session and uses one session", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    const m = await makeMembership(customer.id);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    await api().post(`/scheduling/cs/requests/${breqId}/propose`).set(auth(admin.token)).send({ scheduledAt: laterToday() });

    const acc = await api().post(`/scheduling/me/requests/${breqId}/accept`).set(auth(customer.token)).send({});
    expect(acc.status).toBe(200);
    expect(acc.body.request.status).toBe("scheduled");
    expect(acc.body.session.status).toBe("scheduled");
    expect(await sessionsUsed(m.userOfferId)).toBe(1);
  });
});

describe("clinic marks the session", () => {
  async function scheduled() {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    const m = await makeMembership(customer.id);
    const staff = await makeClinicStaff(m.clinicId);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const conf = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: laterToday() });
    return { customer, admin, staff, m, breqId, sessionId: conf.body.session.id as string };
  }

  it("clinic staff cannot complete without a card scan", async () => {
    const s = await scheduled();
    const res = await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.staff.token)).send({ status: "completed" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("SCAN_REQUIRED");
  });

  it("completing (admin) syncs the booking request to completed", async () => {
    const s = await scheduled();
    const res = await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.admin.token)).send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe("completed");
    const breq = await BookingRequestModel.findById(s.breqId).lean<{ status: string; shownAt?: string }>();
    expect(breq?.status).toBe("completed");
    expect(breq?.shownAt).toBeTruthy();
  });

  it("no-show syncs the booking request to no_show", async () => {
    const s = await scheduled();
    const res = await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.admin.token)).send({ status: "no_show" });
    expect(res.status).toBe(200);
    expect((await BookingRequestModel.findById(s.breqId).lean<{ status: string }>())?.status).toBe("no_show");
  });

  it("clinic cancelling the session returns the used session", async () => {
    const s = await scheduled();
    expect(await sessionsUsed(s.m.userOfferId)).toBe(1);
    const res = await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.staff.token)).send({ status: "cancelled" });
    expect(res.status).toBe(200);
    expect(await sessionsUsed(s.m.userOfferId)).toBe(0);
    expect((await BookingRequestModel.findById(s.breqId).lean<{ status: string }>())?.status).toBe("cancelled");
  });
});

describe("interval warning keeps its exact response shape", () => {
  it("clinic confirm before the cooldown end returns the check object unchanged", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id, { offer: { sessionIntervalDays: 25 } });
    const staff = await makeClinicStaff(m.clinicId);
    const breqId = (await book(customer, m.userOfferId)).body.request.id;
    const cooldownEnd = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    await UserOfferModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(m.userOfferId) },
      { $set: { bookingCooldownEndOverrideAt: cooldownEnd } }
    );
    const res = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: laterToday() });
    expect(res.status).toBe(409);
    expect(Object.keys(res.body).sort()).toEqual(["allowed", "code", "error", "message", "messageAr", "nextEligibleAt", "requiredIntervalDays"]);
    expect(res.body).toMatchObject({ allowed: false, code: "INTERVAL_WARNING", error: "INTERVAL_WARNING", requiredIntervalDays: 25 });
    expect(await BookingSessionModel.countDocuments({ userOfferId: m.userOfferId })).toBe(0);
  });
});

describe("CS schedules a session directly from a membership", () => {
  it("creates the session", async () => {
    const customer = await makeUser("customer");
    const cs = await makeUser("cs");
    const m = await makeMembership(customer.id, { offer: { payPerSession: false } });
    const res = await api().post("/scheduling/cs/schedule").set(auth(cs.token)).send({ userOfferId: m.userOfferId, scheduledAt: laterToday() });
    expect(res.status).toBe(201);
    expect(res.body.session.status).toBe("scheduled");
    expect(await BookingSessionModel.countDocuments({ userOfferId: m.userOfferId })).toBe(1);
  });

  it("a double-clicked Schedule creates only one session", async () => {
    const customer = await makeUser("customer");
    const cs = await makeUser("cs");
    const m = await makeMembership(customer.id, { offer: { payPerSession: false } });
    const when = laterToday();
    const send = () => api().post("/scheduling/cs/schedule").set(auth(cs.token)).send({ userOfferId: m.userOfferId, scheduledAt: when });
    const statuses = (await Promise.all([send(), send()])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(await BookingSessionModel.countDocuments({ userOfferId: m.userOfferId })).toBe(1);
  });
});

describe("Book button throttle (4 seconds per customer)", () => {
  it("two simultaneous bookings: one succeeds, the other gets 429", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    const statuses = (await Promise.all([book(customer, m.userOfferId), book(customer, m.userOfferId)])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 429]);
    expect(await BookingRequestModel.countDocuments({ userOfferId: m.userOfferId })).toBe(1);
  });

  it("the throttle is stored in the database (shared by every server)", async () => {
    const customer = await makeUser("customer");
    const m = await makeMembership(customer.id);
    await book(customer, m.userOfferId);
    const lock = await mongoose.connection.collection("job_locks").findOne({ _id: `booking:${customer.id}` as any });
    expect(lock).toBeTruthy();
  });
});
