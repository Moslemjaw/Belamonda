// Characterisation tests for the customer journey outside booking: identity verification,
// buying a membership (with its e-form), CS payment confirmation and the clinic card scan.
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { UserModel } from "../src/models/user.model.js";
import { WalletModel, KycSubmissionModel } from "../src/models/kyc.model.js";
import { EFormModel } from "../src/models/eform.model.js";
import { OfferModel } from "../src/models/offer.model.js";
import { ClinicModel } from "../src/models/clinic.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { ScanLogModel } from "../src/models/scanLog.model.js";
import { api, laterToday, makeClinicStaff, makeMembership, makeUser, walletUnlocked } from "./helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const TEST_CIVIL_ID = "000000000000"; // obviously fake 12-digit fixture
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const allChecks = { termsAndConditions: true, dataPrivacyConsent: true, serviceLiabilityWaiver: true, age18Plus: true, paymentTermsAcknowledgment: true };

async function unverifiedCustomer() {
  const c = await makeUser("customer");
  await UserModel.updateOne({ _id: c.id }, { $set: { verificationStatus: "unverified" } });
  return c;
}

describe("identity verification (KYC)", () => {
  it("submit puts the customer under review; admin approval verifies them and creates the wallet", async () => {
    const customer = await unverifiedCustomer();
    const admin = await makeUser("admin");
    const sub = await api().post("/kyc/submit").set(auth(customer.token)).send({
      civilIdNumber: TEST_CIVIL_ID, civilIdFrontRef: "https://img.test/front.png", civilIdBackRef: "https://img.test/back.png", checkboxes: allChecks
    });
    expect(sub.status).toBe(201);
    expect((await UserModel.findById(customer.id).lean<{ verificationStatus: string }>())?.verificationStatus).toBe("pending");
    expect(await WalletModel.countDocuments({ userId: customer.id })).toBe(0);

    const subId = (await KycSubmissionModel.findOne({ userId: customer.id }).lean<{ _id: unknown }>())!._id;
    const ok = await api().post(`/kyc/cs/${subId}/approve`).set(auth(admin.token)).send({});
    expect(ok.status).toBe(200);
    expect((await UserModel.findById(customer.id).lean<{ verificationStatus: string }>())?.verificationStatus).toBe("approved");
    expect(await WalletModel.countDocuments({ userId: customer.id })).toBe(1);
  });

  it("a second submission while one is pending is refused", async () => {
    const customer = await unverifiedCustomer();
    const body = { civilIdNumber: TEST_CIVIL_ID, civilIdFrontRef: "https://img.test/f.png", civilIdBackRef: "https://img.test/b.png", checkboxes: allChecks };
    expect((await api().post("/kyc/submit").set(auth(customer.token)).send(body)).status).toBe(201);
    const again = await api().post("/kyc/submit").set(auth(customer.token)).send(body);
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(await KycSubmissionModel.countDocuments({ userId: customer.id })).toBe(1);
  });

  it("an unverified customer cannot buy a membership", async () => {
    const customer = await unverifiedCustomer();
    const clinic = await ClinicModel.create({ nameEn: "C", active: true });
    const offer = await OfferModel.create({ name: "O", type: "A", subscriptionPriceKwd: "18.900", validityDays: 60, clinicId: clinic._id, status: "active", active: true, allowFullPayment: true });
    const res = await api().post("/checkout/full").set(auth(customer.token)).send({ offerId: String(offer._id), clinicId: String(clinic._id) });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("KYC_REQUIRED");
  });
});

describe("buying a membership with an e-form, then CS confirms payment", () => {
  async function setup(signupCashbackKwd = "50.000") {
    const customer = await makeUser("customer");
    await WalletModel.create({ userId: customer.id });
    const cs = await makeUser("cs");
    const clinic = await ClinicModel.create({ nameEn: "C", active: true });
    const form = await EFormModel.create({
      title: "Contract",
      fields: [
        { key: "full_name", type: "short_text", labelEn: "Full Name", required: true, order: 1 },
        { key: "signature", type: "signature", labelEn: "Signature", required: true, order: 2 }
      ]
    });
    const offer = await OfferModel.create({
      name: "One session", type: "A", subscriptionPriceKwd: "18.900", validityDays: 60, maxSessions: 1,
      clinicId: clinic._id, status: "active", active: true, allowFullPayment: true,
      fullPaymentEFormId: form._id, signupCashbackKwd, membershipType: "free_sessions"
    });
    return { customer, cs, clinicId: String(clinic._id), offerId: String(offer._id), formId: String(form._id) };
  }

  it("the e-form must be signed before paying; then payment waits for CS", async () => {
    const s = await setup();
    const first = await api().post("/checkout/full").set(auth(s.customer.token)).send({ offerId: s.offerId, clinicId: s.clinicId });
    expect(first.status).toBe(409);
    expect(first.body.error).toBe("EFORMS_REQUIRED");
    expect(first.body.forms[0].id).toBe(s.formId);

    const signed = await api().post("/eforms/submit").set(auth(s.customer.token)).send({
      formId: s.formId, userOfferId: first.body.userOfferId, answers: [{ key: "full_name", value: "Test Customer" }], signatureDataUrl: PNG
    });
    expect(signed.status).toBeLessThan(300);

    const paid = await api().post("/checkout/full").set(auth(s.customer.token)).send({ offerId: s.offerId, clinicId: s.clinicId, userOfferId: first.body.userOfferId });
    expect(paid.status).toBe(200);
    expect(paid.body.userOffer.status).toBe("pending_payment");
    expect(await UserOfferModel.countDocuments({ userId: s.customer.id })).toBe(1);
  });

  async function pendingMembership(s: Awaited<ReturnType<typeof setup>>) {
    const first = await api().post("/checkout/full").set(auth(s.customer.token)).send({ offerId: s.offerId, clinicId: s.clinicId });
    await api().post("/eforms/submit").set(auth(s.customer.token)).send({
      formId: s.formId, userOfferId: first.body.userOfferId, answers: [{ key: "full_name", value: "T" }], signatureDataUrl: PNG
    });
    const paid = await api().post("/checkout/full").set(auth(s.customer.token)).send({ offerId: s.offerId, clinicId: s.clinicId, userOfferId: first.body.userOfferId });
    return paid.body.userOffer.id as string;
  }

  it("CS confirm activates it, records the payment and grants the signup cashback", async () => {
    const s = await setup();
    const uoId = await pendingMembership(s);
    const res = await api().post("/payments/cs/confirm").set(auth(s.cs.token)).send({ userOfferId: uoId, proofRef: "TRX-1", method: "bank_transfer", amountKwd: "18.900" });
    expect(res.status).toBe(200);
    expect(res.body.userOffer.status).toBe("active");
    const pays = await PaymentModel.find({ userOfferId: uoId }).lean<{ status: string; amountKwd: string }[]>();
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ status: "paid", amountKwd: "18.900" });
    expect(await walletUnlocked(s.customer.id)).toBe("50.000");
    const uo = await UserOfferModel.collection.findOne({ _id: new mongoose.Types.ObjectId(uoId) });
    expect(uo?.cashbackBalanceKwd).toBe("50.000");
  });

  it("a double-clicked confirm activates once: one payment, cashback granted once", async () => {
    const s = await setup();
    const uoId = await pendingMembership(s);
    const send = () => api().post("/payments/cs/confirm").set(auth(s.cs.token)).send({ userOfferId: uoId, proofRef: "TRX-1", method: "bank_transfer", amountKwd: "18.900" });
    const statuses = (await Promise.all([send(), send()])).map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(await PaymentModel.countDocuments({ userOfferId: uoId })).toBe(1);
    expect(await walletUnlocked(s.customer.id)).toBe("50.000");
  });
});

describe("clinic scans the customer's card", () => {
  async function scheduledToday() {
    const customer = await makeUser("customer");
    await UserModel.updateOne({ _id: customer.id }, { $set: { publicToken: `tok${customer.id}` } });
    const admin = await makeUser("admin");
    const m = await makeMembership(customer.id);
    const staff = await makeClinicStaff(m.clinicId);
    const breq = await api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: m.userOfferId });
    const conf = await api().post(`/scheduling/clinic/requests/${breq.body.request.id}/confirm`).set(auth(staff.token)).send({ scheduledAt: laterToday() });
    return { customer, admin, staff, m, token: `tok${customer.id}`, sessionId: conf.body.session.id as string };
  }

  it("a scan logs attendance against the scheduled session", async () => {
    const s = await scheduledToday();
    const res = await api().get(`/public/clinic/scan/${s.token}`).set(auth(s.staff.token));
    expect(res.status).toBe(200);
    expect(res.body.clinicSessions.some((x: { id: string; status: string }) => x.id === s.sessionId && x.status === "scheduled")).toBe(true);
    const logs = await ScanLogModel.find({ userId: s.customer.id }).lean<{ status: string; hadScheduledSession: boolean; clinicId: string }[]>();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: "attended", hadScheduledSession: true, clinicId: s.m.clinicId });
  });

  it("a refresh (?refresh=1) does not log another scan", async () => {
    const s = await scheduledToday();
    await api().get(`/public/clinic/scan/${s.token}`).set(auth(s.staff.token));
    await api().get(`/public/clinic/scan/${s.token}?refresh=1`).set(auth(s.staff.token));
    expect(await ScanLogModel.countDocuments({ userId: s.customer.id })).toBe(1);
  });

  it("after the scan, clinic staff may complete the session", async () => {
    const s = await scheduledToday();
    await api().get(`/public/clinic/scan/${s.token}`).set(auth(s.staff.token));
    const res = await api().post(`/scheduling/clinic/sessions/${s.sessionId}/mark`).set(auth(s.staff.token)).send({ status: "completed" });
    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe("completed");
  });

  it("a scan with nothing scheduled is logged as no_scheduled_session", async () => {
    const customer = await makeUser("customer");
    await UserModel.updateOne({ _id: customer.id }, { $set: { publicToken: `tok${customer.id}` } });
    const m = await makeMembership(customer.id);
    const staff = await makeClinicStaff(m.clinicId);
    const res = await api().get(`/public/clinic/scan/tok${customer.id}`).set(auth(staff.token));
    expect(res.status).toBe(200);
    expect((await ScanLogModel.findOne({ userId: customer.id }).lean<{ status: string }>())?.status).toBe("no_scheduled_session");
  });

  it("an unknown card is refused", async () => {
    const staff = await makeClinicStaff(String(new mongoose.Types.ObjectId()));
    const res = await api().get(`/public/clinic/scan/nope123456`).set(auth(staff.token));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("CUSTOMER_NOT_FOUND");
  });
});
