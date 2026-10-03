// End-to-end: a new customer through to a completed, scanned, paid session — once for an
// admin-handled membership (forwarded to the clinic) and once for a clinic-handled one
// (e.g. Sawa) — then everything must show in the admin Sessions Log, Request History
// and Scan History, exactly as the dashboards query them.
import { describe, expect, it } from "vitest";
import { UserModel } from "../src/models/user.model.js";
import { KycSubmissionModel } from "../src/models/kyc.model.js";
import { EFormModel } from "../src/models/eform.model.js";
import { OfferModel } from "../src/models/offer.model.js";
import { ClinicModel } from "../src/models/clinic.model.js";
import { api, laterToday, makeClinicStaff, makeUser, walletUnlocked } from "./helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const TEST_CIVIL_ID = "000000000000"; // obviously fake fixture
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const checks = { termsAndConditions: true, dataPrivacyConsent: true, serviceLiabilityWaiver: true, age18Plus: true, paymentTermsAcknowledgment: true };

async function runFlow(bookingFlow: "admin_forward" | "direct_clinic") {
  const admin = await makeUser("admin");
  const cs = await makeUser("cs");
  const clinic = await ClinicModel.create({ nameEn: `Clinic ${bookingFlow}`, active: true });
  const clinicId = String(clinic._id);
  const staff = await makeClinicStaff(clinicId);
  const form = await EFormModel.create({
    title: "Membership Contract",
    fields: [
      { key: "full_name", type: "short_text", labelEn: "Full Name", required: true, order: 1 },
      { key: "signature", type: "signature", labelEn: "Signature", required: true, order: 2 }
    ]
  });
  const offer = await OfferModel.create({
    name: bookingFlow === "admin_forward" ? "One session" : "Sawa-like", type: "A",
    subscriptionPriceKwd: "18.900", validityDays: 60, maxSessions: 6, sessionIntervalDays: 0,
    clinicId: clinic._id, status: "active", active: true, allowFullPayment: true,
    fullPaymentEFormId: form._id, signupCashbackKwd: "50.000", cashbackPerSessionKwd: "2.000",
    membershipType: "free_sessions", bookingFlow
  });

  // 1. Customer account (sign-up)
  const reg = await api().post("/auth/register").send({ fullName: `E2E ${bookingFlow}`, phone: bookingFlow === "admin_forward" ? "+96550000001" : "+96550000002", password: "E2E-test-pass-1", gender: "female" });
  expect(reg.status).toBe(201);
  const customer = { id: reg.body.userId as string, token: reg.body.accessToken as string };
  await UserModel.updateOne({ _id: customer.id }, { $set: { publicToken: `card${customer.id}` } });

  // 2. KYC: submit, admin approves
  expect((await api().post("/kyc/submit").set(auth(customer.token)).send({ civilIdNumber: TEST_CIVIL_ID, civilIdFrontRef: "https://img.test/f.png", civilIdBackRef: "https://img.test/b.png", checkboxes: checks })).status).toBe(201);
  const sub = await KycSubmissionModel.findOne({ userId: customer.id }).lean<{ _id: unknown }>();
  expect((await api().post(`/kyc/cs/${sub!._id}/approve`).set(auth(admin.token)).send({})).status).toBe(200);

  // 3. Buy a membership — e-form first
  const first = await api().post("/checkout/full").set(auth(customer.token)).send({ offerId: String(offer._id), clinicId });
  expect(first.body.error).toBe("EFORMS_REQUIRED");
  expect((await api().post("/eforms/submit").set(auth(customer.token)).send({ formId: String(form._id), userOfferId: first.body.userOfferId, answers: [{ key: "full_name", value: "E2E" }], signatureDataUrl: PNG })).status).toBeLessThan(300);
  const bought = await api().post("/checkout/full").set(auth(customer.token)).send({ offerId: String(offer._id), clinicId, userOfferId: first.body.userOfferId });
  expect(bought.body.userOffer.status).toBe("pending_payment");
  const userOfferId = bought.body.userOffer.id as string;

  // 4. CS confirms the payment → active, signup cashback granted
  const conf = await api().post("/payments/cs/confirm").set(auth(cs.token)).send({ userOfferId, proofRef: "TRX-E2E", method: "bank_transfer", amountKwd: "18.900" });
  expect(conf.status).toBe(200);
  expect(conf.body.userOffer.status).toBe("active");
  expect(await walletUnlocked(customer.id)).toBe("50.000");

  // 5. Customer books a session
  const booked = await api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId, notes: "e2e" });
  expect(booked.status).toBe(201);
  const requestId = booked.body.request.id as string;
  const convId = booked.body.conversationId as string;
  const when = laterToday();

  // 6. Admin forwards to the clinic (admin-handled only); clinic-handled goes straight there
  if (bookingFlow === "admin_forward") {
    expect(booked.body.request.status).toBe("request_received");
    const fwd = await api().post(`/scheduling/cs/requests/${requestId}/propose`).set(auth(admin.token)).send({ scheduledAt: when });
    expect(fwd.body.request.status).toBe("slot_assigned");
  } else {
    expect(booked.body.request.status).toBe("slot_assigned");
    expect(booked.body.request.bookingRoute).toBe("clinic");
  }

  // 7. Clinic confirms the date
  const clinicConf = await api().post(`/scheduling/clinic/requests/${requestId}/confirm`).set(auth(staff.token)).send({ scheduledAt: when });
  expect(clinicConf.status).toBe(201);
  const sessionId = clinicConf.body.session.id as string;
  if (bookingFlow === "direct_clinic") expect(clinicConf.body.request.adminSuggestedAt ?? null).toBeNull(); // no admin step

  // 8. Chat on the booking — persisted
  expect((await api().post(`/chat/conversations/${convId}/messages`).set(auth(customer.token)).send({ body: "See you soon" })).status).toBe(201);

  // 9. Clinic scans the card, completes the session with a POS cashback deduction, then checks out
  const scan = await api().get(`/public/clinic/scan/card${customer.id}`).set(auth(staff.token));
  expect(scan.status).toBe(200);
  const done = await api().post(`/scheduling/clinic/sessions/${sessionId}/mark`).set(auth(staff.token)).send({ status: "completed", cashbackToDeductKwd: "5.000" });
  expect(done.status).toBe(200);
  expect(done.body.session.status).toBe("completed");
  expect(await walletUnlocked(customer.id)).toBe("47.000"); // 50 + 2 reward − 5 used
  const paid = await api().post(`/scheduling/requests/${requestId}/mark-paid`).set(auth(staff.token)).send({});
  expect(paid.status).toBe(200);

  // 10. Everything is logged where the admin dashboards look
  const log = await api().get("/scheduling/admin/sessions-log").set(auth(admin.token));
  const logRow = log.body.items.find((i: any) => [i.id, i._id, i.sessionId].includes(sessionId) || i.bookingRequestId === requestId);
  expect(logRow, "session in Sessions Log").toBeTruthy();
  expect(String(logRow.status)).toMatch(/completed/);

  const reqs = await api().get(`/scheduling/admin/requests?clinicId=${clinicId}`).set(auth(admin.token));
  const reqItems = reqs.body.items ?? reqs.body.requests ?? [];
  const reqRow = reqItems.find((r: any) => (r.id ?? r._id) === requestId);
  expect(reqRow, "request in Request History").toBeTruthy();
  expect(reqRow.status).toBe("completed");
  expect(reqRow.clinicScheduledAt).toBeTruthy();
  // (A scan after the booked time — a late arrival — moves the booking to the scan time
  // and stamps adminSuggestedAt, by design; so the "no admin step" check is done above.)
  if (bookingFlow === "admin_forward") expect(reqRow.adminSuggestedAt).toBeTruthy();

  const scans = await api().get(`/scheduling/admin/scan-logs?clinicId=${clinicId}&limit=200`).set(auth(admin.token));
  const scanItems = scans.body.items ?? scans.body.logs ?? [];
  const scanRow = scanItems.find((s: any) => s.userId === customer.id || s.customer?.id === customer.id || s.user?.id === customer.id);
  expect(scanRow, "scan in Scan History").toBeTruthy();
  expect(JSON.stringify(scanRow)).toMatch(/attended/);

  const chat = await api().get(`/chat/conversations/${convId}/messages`).set(auth(admin.token));
  expect(chat.body.items.some((m: any) => m.body === "See you soon")).toBe(true);
}

describe("end-to-end customer → clinic flow", () => {
  it("admin-handled membership (forwarded to the clinic)", async () => {
    await runFlow("admin_forward");
  }, 60_000);

  it("clinic-handled membership (e.g. Sawa — straight to the clinic)", async () => {
    await runFlow("direct_clinic");
  }, 60_000);
});
