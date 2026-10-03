// Read caches must never serve stale data after a write, whichever way the write happens.
import { describe, expect, it } from "vitest";
import { OfferModel } from "../src/models/offer.model.js";
import { ClinicModel } from "../src/models/clinic.model.js";
import { loadOffer } from "../src/modules/scheduling/scheduling.helpers.js";

async function offer() {
  const clinic = await ClinicModel.create({ nameEn: "C", active: true });
  return OfferModel.create({ name: "O", type: "A", subscriptionPriceKwd: "10.000", validityDays: 30, clinicId: clinic._id, sessionIntervalDays: 10 });
}

describe("offer cache", () => {
  it.each([
    ["findByIdAndUpdate", (id: unknown) => OfferModel.findByIdAndUpdate(id, { $set: { sessionIntervalDays: 25 } })],
    ["updateOne", (id: unknown) => OfferModel.updateOne({ _id: id }, { $set: { sessionIntervalDays: 25 } })],
    ["updateMany", (_id: unknown) => OfferModel.updateMany({}, { $set: { sessionIntervalDays: 25 } })],
    ["document save", async (id: unknown) => { const d = await OfferModel.findById(id); d!.set("sessionIntervalDays", 25); await d!.save(); }]
  ])("an edit via %s is visible immediately", async (_how, edit) => {
    const o = await offer();
    expect((await loadOffer(String(o._id)))!.sessionIntervalDays).toBe(10);
    await edit(o._id);
    expect((await loadOffer(String(o._id)))!.sessionIntervalDays).toBe(25);
  });

  it("a deleted offer is not served from the cache", async () => {
    const o = await offer();
    await loadOffer(String(o._id));
    await OfferModel.findByIdAndDelete(o._id);
    expect(await loadOffer(String(o._id))).toBeNull();
  });

  it("callers get their own copy (changing it doesn't affect the next read)", async () => {
    const o = await offer();
    const a = await loadOffer(String(o._id));
    a!.sessionIntervalDays = 999;
    a!.branchSessionPrices.push({ clinicId: "x", sessionPriceKwd: "1.000" });
    const b = await loadOffer(String(o._id));
    expect(b!.sessionIntervalDays).toBe(10);
    expect(b!.branchSessionPrices).toHaveLength(0);
  });
});

describe("staff clinic cache", () => {
  it("moving staff to another clinic changes their access immediately", async () => {
    const { UserModel } = await import("../src/models/user.model.js");
    const { canActOnClinic } = await import("../src/modules/scheduling/scheduling.helpers.js");
    const a = await ClinicModel.create({ nameEn: "A", active: true });
    const b = await ClinicModel.create({ nameEn: "B", active: true });
    const staff = await UserModel.create({ role: "clinicStaff", passwordHash: "x", clinicId: a._id });
    const actor = { userId: String(staff._id), role: "clinicStaff" };
    expect(await canActOnClinic(actor, String(a._id))).toBe(true);
    expect(await canActOnClinic(actor, String(b._id))).toBe(false);
    await UserModel.updateOne({ _id: staff._id }, { $set: { clinicId: b._id } });
    expect(await canActOnClinic(actor, String(a._id))).toBe(false);
    expect(await canActOnClinic(actor, String(b._id))).toBe(true);
  });
});

describe("public catalog cache", () => {
  it("a new, edited or deactivated offer shows in the public list immediately", async () => {
    const { api } = await import("./helpers.js");
    const clinic = await ClinicModel.create({ nameEn: "C", active: true });
    const before = (await api().get("/offers")).body.items.length;
    const o = await OfferModel.create({ name: "Brand New", type: "A", subscriptionPriceKwd: "10.000", validityDays: 30, clinicId: clinic._id, status: "active", active: true });
    expect((await api().get("/offers")).body.items.length).toBe(before + 1);
    await OfferModel.updateOne({ _id: o._id }, { $set: { name: "Renamed" } });
    expect((await api().get("/offers")).body.items.some((x: any) => x.name === "Renamed")).toBe(true);
    await OfferModel.updateOne({ _id: o._id }, { $set: { status: "hidden", active: false } });
    expect((await api().get("/offers")).body.items.some((x: any) => x.name === "Renamed")).toBe(false);
  });

  it("different filters don't share a cached list", async () => {
    const { api } = await import("./helpers.js");
    const a = await ClinicModel.create({ nameEn: "A", active: true });
    const b = await ClinicModel.create({ nameEn: "B", active: true });
    await OfferModel.create({ name: "At A", type: "A", subscriptionPriceKwd: "10.000", validityDays: 30, clinicId: a._id, status: "active", active: true });
    await OfferModel.create({ name: "At B", type: "A", subscriptionPriceKwd: "10.000", validityDays: 30, clinicId: b._id, status: "active", active: true });
    const la = (await api().get(`/offers?clinicId=${a._id}`)).body.items.map((x: any) => x.name);
    const lb = (await api().get(`/offers?clinicId=${b._id}`)).body.items.map((x: any) => x.name);
    expect(la).toContain("At A");
    expect(la).not.toContain("At B");
    expect(lb).toContain("At B");
  });

  it("clinic list reflects a deactivated clinic immediately", async () => {
    const { api } = await import("./helpers.js");
    const c = await ClinicModel.create({ nameEn: "Closing Soon", active: true });
    expect((await api().get("/clinics")).body.items.some((x: any) => x.nameEn === "Closing Soon")).toBe(true);
    await ClinicModel.updateOne({ _id: c._id }, { $set: { active: false } });
    expect((await api().get("/clinics")).body.items.some((x: any) => x.nameEn === "Closing Soon")).toBe(false);
  });
});
