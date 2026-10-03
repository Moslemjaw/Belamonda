// Customer changes the clinic of a membership whose offer doesn't ask for a branch at purchase
// (requireBranchSelection: false, e.g. the live "Abraj offer"): the chosen clinic must be used.
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { ClinicModel } from "../src/models/clinic.model.js";
import { OfferModel } from "../src/models/offer.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { api, makeUser, makeUserOffer } from "./helpers.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function abrajLike(startAt: "own" | "other") {
  const customer = await makeUser("customer");
  const qibla = await ClinicModel.create({ nameEn: "Qibla Clinic", active: true });
  const kout = await ClinicModel.create({ nameEn: "Al Kout Clinic", active: true });
  const marina = await ClinicModel.create({ nameEn: "Marina 8", active: true });
  const offer = await OfferModel.create({
    name: "Abraj offer", type: "A", subscriptionPriceKwd: "26.000", validityDays: 365, status: "active", active: true,
    clinicId: qibla._id, clinicLocked: false, requireBranchSelection: false, clinicTransferFeeKwd: "0.000",
    clinicOverrides: [{ clinicId: String(kout._id), sessionPriceKwd: "9.900" }, { clinicId: String(marina._id), sessionPriceKwd: "9.900" }]
  });
  const uoId = await makeUserOffer(customer.id, { offerId: offer._id, clinicId: startAt === "own" ? qibla._id : kout._id });
  return { customer, uoId, qibla: String(qibla._id), kout: String(kout._id), marina: String(marina._id) };
}
const clinicOf = async (uoId: string) =>
  String((await UserOfferModel.collection.findOne({ _id: new mongoose.Types.ObjectId(uoId) }))?.clinicId);
const change = (s: { customer: { token: string }; uoId: string }, newClinicId: string) =>
  api().post(`/commerce/me/user-offers/${s.uoId}/change-clinic`).set(auth(s.customer.token)).send({ newClinicId, confirmPayTransferFee: true });

describe("change clinic on an offer without branch selection", () => {
  it("from the offer's own clinic to another clinic", async () => {
    const s = await abrajLike("own");
    const res = await change(s, s.kout);
    expect(res.status).toBe(200);
    expect(res.body.clinicId).toBe(s.kout);
    expect(await clinicOf(s.uoId)).toBe(s.kout);
  });

  it("between two other clinics: goes to the chosen one, not back to the offer's clinic", async () => {
    const s = await abrajLike("other");
    const res = await change(s, s.marina);
    expect(res.status).toBe(200);
    expect(await clinicOf(s.uoId)).toBe(s.marina);
  });

  it("choosing the current clinic is refused", async () => {
    const s = await abrajLike("other");
    const res = await change(s, s.kout);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("SAME_CLINIC");
  });

  it("a clinic that doesn't exist is refused and nothing changes", async () => {
    const s = await abrajLike("own");
    const res = await change(s, String(new mongoose.Types.ObjectId()));
    expect(res.status).toBe(400);
    expect(await clinicOf(s.uoId)).toBe(s.qibla);
  });
});
