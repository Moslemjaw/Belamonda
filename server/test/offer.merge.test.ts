// Merging duplicate memberships (offers): everything moves to the kept offer, the duplicates
// are retired, and customers whose memberships were on a duplicate keep working normally.
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { OfferModel } from "../src/models/offer.model.js";
import { ClinicModel } from "../src/models/clinic.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { PromotionModel } from "../src/models/promotion.model.js";
import { EFormModel, EFormSubmissionModel } from "../src/models/eform.model.js";
import { AuditLogModel } from "../src/models/auditLog.model.js";
import { api, makeUser, makeUserOffer } from "./helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const oid = (x: unknown) => new mongoose.Types.ObjectId(String(x));

async function threeCopies(overrides: Array<Record<string, unknown>> = [{}, {}, {}]) {
  const clinic = await ClinicModel.create({ nameEn: "Qibla Clinic", active: true });
  const base = { name: "One Session", type: "A", subscriptionPriceKwd: "18.900", validityDays: 60, maxSessions: 1, sessionIntervalDays: 0, clinicId: clinic._id, status: "active", active: true, allowFullPayment: true };
  const offers = [];
  for (const o of overrides) offers.push(await OfferModel.create({ ...base, ...o }));
  return { clinicId: String(clinic._id), keep: String(offers[0]._id), dups: offers.slice(1).map((o) => String(o._id)) };
}
const merge = (adminToken: string, body: Record<string, unknown>) => api().post("/offers/admin/merge").set(auth(adminToken)).send(body);

describe("merge duplicate offers", () => {
  it("dry run reports what would move and changes nothing", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    const c = await threeCopies();
    const uo = await makeUserOffer(customer.id, { offerId: oid(c.dups[0]), clinicId: oid(c.clinicId), status: "active" });
    await BookingRequestModel.create({ userId: customer.id, userOfferId: uo, offerId: c.dups[0], clinicId: c.clinicId });
    await PaymentModel.create({ userId: customer.id, offerId: oid(c.dups[1]), amountKwd: "18.900", method: "cash", purpose: "enrollment_full", status: "paid" });

    const res = await merge(admin.token, { keepId: c.keep, mergeIds: c.dups, dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.moves).toMatchObject({ memberships: 1, activeMemberships: 1, bookingRequests: 1, payments: 1 });
    expect(res.body.needsConfirmation).toBe(false); // identical settings
    expect(String((await UserOfferModel.collection.findOne({ _id: oid(uo) }))?.offerId)).toBe(c.dups[0]);
    expect((await OfferModel.findById(c.dups[0]).lean<any>())?.status).toBe("active");
  });

  it("moves every reference, retires the duplicates and records an audit entry", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    const c = await threeCopies();
    const uo = await makeUserOffer(customer.id, { offerId: oid(c.dups[0]), clinicId: oid(c.clinicId), status: "active" });
    await BookingRequestModel.create({ userId: customer.id, userOfferId: uo, offerId: c.dups[0], clinicId: c.clinicId });
    await BookingSessionModel.create({ userId: customer.id, userOfferId: oid(uo), offerId: oid(c.dups[1]), clinicId: oid(c.clinicId), scheduledAt: new Date(), scheduledBy: admin.id });
    await PaymentModel.create({ userId: customer.id, offerId: oid(c.dups[1]), amountKwd: "18.900", method: "cash", purpose: "enrollment_full", status: "paid" });
    await PromotionModel.collection.insertOne({ title: "P", slug: "p", offerIds: [oid(c.keep), oid(c.dups[0]), oid(c.dups[1])] });
    const form = await EFormModel.create({ title: "Contract", targets: [{ kind: "offer", refId: c.dups[0] }, { kind: "offer", refId: c.keep }] });
    await EFormSubmissionModel.create({ formId: form._id, formVersion: 1, formTitle: "Contract", userId: customer.id, targetKind: "offer", targetRefId: c.dups[0] });

    const res = await merge(admin.token, { keepId: c.keep, mergeIds: c.dups });
    expect(res.status).toBe(200);
    expect(res.body.merged).toBe(true);

    expect(String((await UserOfferModel.collection.findOne({ _id: oid(uo) }))?.offerId)).toBe(c.keep);
    expect(await BookingRequestModel.countDocuments({ offerId: c.keep })).toBe(1);
    expect(await BookingSessionModel.countDocuments({ offerId: oid(c.keep) })).toBe(1);
    expect(await PaymentModel.countDocuments({ offerId: oid(c.keep) })).toBe(1);
    const promo = await PromotionModel.collection.findOne({ slug: "p" });
    expect(promo?.offerIds.map(String)).toEqual([c.keep]); // swapped and de-duplicated
    const f = await EFormModel.findById(form._id).lean<any>();
    expect(f.targets).toEqual([{ kind: "offer", refId: c.keep }]);
    expect(await EFormSubmissionModel.countDocuments({ targetRefId: c.keep })).toBe(1);
    for (const d of c.dups) {
      const doc = await OfferModel.findById(d).lean<any>();
      expect(doc).toMatchObject({ status: "hidden", active: false });
      expect(String(doc.mergedInto)).toBe(c.keep);
    }
    expect(await AuditLogModel.countDocuments({ actionType: "offers_merged" })).toBe(1);

    // Admin list no longer shows the duplicates; the public list shows one "One Session"
    const adminList = await api().get("/offers/admin").set(auth(admin.token));
    expect((adminList.body.items ?? adminList.body).filter((o: any) => o.name === "One Session")).toHaveLength(1);
    expect((await api().get("/offers")).body.items.filter((o: any) => o.name === "One Session")).toHaveLength(1);
  });

  it("an old link to a duplicate opens the kept offer", async () => {
    const admin = await makeUser("admin");
    const c = await threeCopies();
    await merge(admin.token, { keepId: c.keep, mergeIds: c.dups });
    const res = await api().get(`/offers/${c.dups[0]}`);
    expect(res.status).toBe(200);
    expect((res.body.offer ?? res.body).id).toBe(c.keep);
  });

  it("a customer whose membership was on a duplicate can still book", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    const c = await threeCopies();
    const uo = await makeUserOffer(customer.id, {
      offerId: oid(c.dups[0]), clinicId: oid(c.clinicId), status: "active", membershipType: "free_sessions", sessionsUsed: 0,
      activatedAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() + 30 * 86400000)
    });
    await merge(admin.token, { keepId: c.keep, mergeIds: c.dups });
    const booked = await api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: uo });
    expect(booked.status).toBe(201);
    expect(booked.body.request.offerId).toBe(c.keep);
  });

  it("a payment still awaiting confirmation can be confirmed after the merge", async () => {
    const admin = await makeUser("admin");
    const cs = await makeUser("cs");
    const customer = await makeUser("customer");
    const c = await threeCopies();
    const uo = await makeUserOffer(customer.id, { offerId: oid(c.dups[1]), clinicId: oid(c.clinicId), status: "pending_payment", purchaseMode: "full" });
    await merge(admin.token, { keepId: c.keep, mergeIds: c.dups });
    const res = await api().post("/payments/cs/confirm").set(auth(cs.token)).send({ userOfferId: uo, proofRef: "T1", method: "cash", amountKwd: "18.900" });
    expect(res.status).toBe(200);
    expect(res.body.userOffer.status).toBe("active");
  });

  it("refuses when moved customers would get different session rules, unless confirmed", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    const c = await threeCopies([{ maxSessions: 1 }, { maxSessions: 3 }, {}]);
    await makeUserOffer(customer.id, { offerId: oid(c.dups[0]), clinicId: oid(c.clinicId), status: "active" });
    const dry = await merge(admin.token, { keepId: c.keep, mergeIds: c.dups, dryRun: true });
    expect(dry.body.needsConfirmation).toBe(true);
    expect(dry.body.differences.affectsExisting.map((d: any) => d.field)).toContain("maxSessions");

    const refused = await merge(admin.token, { keepId: c.keep, mergeIds: c.dups });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("MERGE_CHANGES_EXISTING_MEMBERSHIPS");
    expect((await OfferModel.findById(c.dups[0]).lean<any>())?.status).toBe("active"); // nothing changed

    const ok = await merge(admin.token, { keepId: c.keep, mergeIds: c.dups, acceptDifferences: true });
    expect(ok.status).toBe(200);
  });

  it("purchase-only differences (e-form, deposit) don't block when they can't affect existing customers", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    const c = await threeCopies([{ allowDeposit: true, depositAmountKwd: "1.000" }, {}, {}]);
    await makeUserOffer(customer.id, { offerId: oid(c.dups[0]), clinicId: oid(c.clinicId), status: "active" });
    const dry = await merge(admin.token, { keepId: c.keep, mergeIds: c.dups, dryRun: true });
    expect(dry.body.needsConfirmation).toBe(false);
    expect(dry.body.differences.purchaseOnly.map((d: any) => d.field)).toContain("allowDeposit");
    expect((await merge(admin.token, { keepId: c.keep, mergeIds: c.dups })).status).toBe(200);
  });

  it("only admins can merge, and the kept offer can't be in the merge list", async () => {
    const cs = await makeUser("cs");
    const admin = await makeUser("admin");
    const c = await threeCopies();
    expect((await merge(cs.token, { keepId: c.keep, mergeIds: c.dups })).status).toBe(403);
    expect((await merge(admin.token, { keepId: c.keep, mergeIds: [c.keep] })).status).toBe(400);
  });
});
