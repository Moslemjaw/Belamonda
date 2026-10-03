// The card scan sets the session time: whenever the customer is scanned (early, on time or
// late) the session moves to the scan time, and the next session's minimum gap counts from
// the scan. The admin's suggested date and the clinic's scheduled date stay as history.
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { UserModel } from "../src/models/user.model.js";
import { api, laterToday, makeClinicStaff, makeMembership, makeUser } from "./helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const DAY = 24 * 3600 * 1000;

async function forwardedAndConfirmed(bookedAt: string, adminSuggested: string, intervalDays = 25) {
  const customer = await makeUser("customer");
  await UserModel.updateOne({ _id: customer.id }, { $set: { publicToken: `card${customer.id}` } });
  const admin = await makeUser("admin");
  const m = await makeMembership(customer.id, { offer: { sessionIntervalDays: intervalDays } });
  const staff = await makeClinicStaff(m.clinicId);
  const breqId = (await api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: m.userOfferId })).body.request.id;
  await api().post(`/scheduling/cs/requests/${breqId}/propose`).set(auth(admin.token)).send({ scheduledAt: adminSuggested });
  const conf = await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: bookedAt });
  return { customer, admin, staff, m, breqId, sessionId: conf.body.session.id as string };
}

describe("scan sets the session time", () => {
  it.each([
    ["early arrival (booked later today)", +2 * 3600 * 1000],
    ["late arrival (booked earlier today)", -2 * 3600 * 1000]
  ])("%s: session moves to the scan time; admin/clinic dates kept", async (_label, offset) => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 0, 0);
    const booked = new Date(Math.min(Math.max(Date.now() + (offset as number), startOfToday.getTime() + 60_000), endOfToday.getTime())).toISOString();
    const suggested = new Date(Date.parse(booked) - 3600 * 1000).toISOString();
    const s = await forwardedAndConfirmed(booked, suggested);

    const before = Date.now();
    expect((await api().get(`/public/clinic/scan/card${s.customer.id}`).set(auth(s.staff.token))).status).toBe(200);
    const after = Date.now();

    const sess = await BookingSessionModel.findById(s.sessionId).lean<{ scheduledAt: Date; scannedAt?: Date }>();
    const scanTime = new Date(sess!.scheduledAt).getTime();
    expect(scanTime).toBeGreaterThanOrEqual(before - 5);
    expect(scanTime).toBeLessThanOrEqual(after + 5);
    expect(new Date(sess!.scannedAt!).getTime()).toBe(scanTime);

    const breq = await BookingRequestModel.findById(s.breqId).lean<any>();
    expect(new Date(breq.shownAt).getTime()).toBe(scanTime);
    expect(new Date(breq.proposedAt).getTime()).toBe(scanTime);
    expect(new Date(breq.adminSuggestedAt).toISOString()).toBe(suggested); // admin's date kept
    expect(new Date(breq.clinicScheduledAt).toISOString()).toBe(booked); // clinic's date kept
  });

  it("a refresh (?refresh=1) does not move the time again", async () => {
    const s = await forwardedAndConfirmed(laterToday(), new Date().toISOString());
    await api().get(`/public/clinic/scan/card${s.customer.id}`).set(auth(s.staff.token));
    const first = (await BookingSessionModel.findById(s.sessionId).lean<{ scheduledAt: Date }>())!.scheduledAt;
    await new Promise((r) => setTimeout(r, 50));
    await api().get(`/public/clinic/scan/card${s.customer.id}?refresh=1`).set(auth(s.staff.token));
    expect((await BookingSessionModel.findById(s.sessionId).lean<{ scheduledAt: Date }>())!.scheduledAt).toEqual(first);
  });
});

describe("next session gap counts from the scan", () => {
  it("completed later, the session's completion time is still the scan time", async () => {
    const s = await forwardedAndConfirmed(laterToday(), new Date().toISOString());
    await api().get(`/public/clinic/scan/card${s.customer.id}`).set(auth(s.staff.token));
    const scannedAt = (await BookingSessionModel.findById(s.sessionId).lean<{ scannedAt: Date }>())!.scannedAt;
    await new Promise((r) => setTimeout(r, 1200)); // staff marks it a little later
    await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.admin.token)).send({ status: "completed" });
    const sess = await BookingSessionModel.findById(s.sessionId).lean<{ completedAt: Date }>();
    expect(new Date(sess!.completedAt).getTime()).toBe(new Date(scannedAt).getTime());
  });

  it("the customer can book again 25 days after the scan, not after the suggested/booked date", async () => {
    const s = await forwardedAndConfirmed(laterToday(), new Date(Date.now() - 10 * DAY).toISOString());
    await api().get(`/public/clinic/scan/card${s.customer.id}`).set(auth(s.staff.token));
    await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.staff.token)).send({ status: "completed" });
    const scannedAt = new Date((await BookingSessionModel.findById(s.sessionId).lean<{ scannedAt: Date }>())!.scannedAt).getTime();

    await new Promise((r) => setTimeout(r, 4100)); // booking throttle
    const again = await api().post("/scheduling/me/request").set(auth(s.customer.token)).send({ userOfferId: s.m.userOfferId });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("INTERVAL_NOT_MET");
    expect(new Date(again.body.nextEligibleAt).getTime()).toBe(scannedAt + 25 * DAY);
  }, 20_000);

  it("staff scheduling is checked against the scan date too", async () => {
    const s = await forwardedAndConfirmed(laterToday(), new Date().toISOString());
    await api().get(`/public/clinic/scan/card${s.customer.id}`).set(auth(s.staff.token));
    await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.staff.token)).send({ status: "completed" });
    const cs = await makeUser("cs");
    await UserModel.updateOne({ _id: new mongoose.Types.ObjectId(cs.id) }, { $set: {} });
    const tooSoon = new Date(Date.now() + 10 * DAY).toISOString();
    const res = await api().post("/scheduling/cs/schedule").set(auth(cs.token)).send({ userOfferId: s.m.userOfferId, scheduledAt: tooSoon });
    expect(res.status).toBe(409);
    expect(res.body.code ?? res.body.error).toMatch(/INTERVAL/);
  });
});

describe("Request History columns after a scan", () => {
  async function history(adminToken: string, clinicId: string, breqId: string) {
    const r = await api().get(`/scheduling/admin/requests?clinicId=${clinicId}`).set(auth(adminToken));
    return (r.body.items ?? []).find((x: any) => (x.id ?? x._id) === breqId);
  }

  it("admin-handled: shows the admin's date and the clinic's date, not the scan time", async () => {
    const booked = laterToday();
    const suggested = new Date(Date.parse(booked) - 3600 * 1000).toISOString();
    const s = await forwardedAndConfirmed(booked, suggested);
    await api().get(`/public/clinic/scan/card${s.customer.id}`).set(auth(s.staff.token));
    const row = await history(s.admin.token, s.m.clinicId, s.breqId);
    expect(new Date(row.adminSuggestedAt).toISOString()).toBe(suggested);
    expect(new Date(row.clinicScheduledAt).toISOString()).toBe(booked);
    expect(row.shownAt).toBeTruthy();
  });

  it("clinic-handled: no admin date at all, clinic's date kept", async () => {
    const customer = await makeUser("customer");
    await UserModel.updateOne({ _id: customer.id }, { $set: { publicToken: `card${customer.id}` } });
    const admin = await makeUser("admin");
    const m = await makeMembership(customer.id, { bookingFlow: "direct_clinic" });
    const staff = await makeClinicStaff(m.clinicId);
    const breqId = (await api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: m.userOfferId })).body.request.id;
    const booked = laterToday();
    await api().post(`/scheduling/clinic/requests/${breqId}/confirm`).set(auth(staff.token)).send({ scheduledAt: booked });
    await api().get(`/public/clinic/scan/card${customer.id}`).set(auth(staff.token));
    const row = await history(admin.token, m.clinicId, breqId);
    expect(row.adminSuggestedAt ?? null).toBeNull();
    expect(new Date(row.clinicScheduledAt).toISOString()).toBe(booked);
  });

  it("older requests that only stored proposedAt still show it", async () => {
    const admin = await makeUser("admin");
    const at = new Date("2026-09-01T10:00:00.000Z");
    const legacy = await BookingRequestModel.create({ userId: "u-legacy", clinicId: "c-legacy", status: "scheduled", bookingRoute: "cs", proposedAt: at });
    const row = await history(admin.token, "c-legacy", String(legacy._id));
    expect(new Date(row.adminSuggestedAt).toISOString()).toBe(at.toISOString());
    expect(new Date(row.clinicScheduledAt).toISOString()).toBe(at.toISOString());
  });
});
