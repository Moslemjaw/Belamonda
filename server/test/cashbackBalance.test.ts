import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { adjustCashbackBalance } from "../src/services/userOffer.service.js";

async function makeUserOffer(cashbackBalanceKwd?: string) {
  const id = new mongoose.Types.ObjectId();
  // Raw insert: this test only cares about the balance field, not the full schema.
  await UserOfferModel.collection.insertOne({ _id: id, ...(cashbackBalanceKwd !== undefined ? { cashbackBalanceKwd } : {}) });
  return String(id);
}

async function balanceOf(id: string) {
  const doc = await UserOfferModel.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
  return doc?.cashbackBalanceKwd;
}

describe("adjustCashbackBalance", () => {
  it("refunds onto an existing string balance (was a crashing $inc)", async () => {
    const id = await makeUserOffer("10.000");
    expect(await adjustCashbackBalance(id, 2500)).toBe("12.500");
    expect(await balanceOf(id)).toBe("12.500");
  });

  it("deducts and floors at zero", async () => {
    const id = await makeUserOffer("3.000");
    expect(await adjustCashbackBalance(id, -5000)).toBe("0.000");
  });

  it("creates the balance on refund when missing", async () => {
    const id = await makeUserOffer();
    expect(await adjustCashbackBalance(id, 1000)).toBe("1.000");
  });

  it("onlyIfSet leaves offers without a balance untouched", async () => {
    const id = await makeUserOffer();
    expect(await adjustCashbackBalance(id, 1000, { onlyIfSet: true })).toBeNull();
    expect(await balanceOf(id)).toBeUndefined();
  });

  it("does not lose concurrent refunds", async () => {
    const id = await makeUserOffer("0.000");
    await Promise.all([1, 2, 3, 4].map(() => adjustCashbackBalance(id, 1000)));
    expect(await balanceOf(id)).toBe("4.000");
  });

  it("ignores invalid ids and zero deltas", async () => {
    expect(await adjustCashbackBalance("nope", 1000)).toBeNull();
    const id = await makeUserOffer("1.000");
    expect(await adjustCashbackBalance(id, 0)).toBeNull();
  });
});
