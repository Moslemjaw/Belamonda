import { describe, expect, it } from "vitest";
import { withTransaction } from "../src/db/transaction.js";
import { WalletModel } from "../src/models/kyc.model.js";

describe("withTransaction", () => {
  it("commits all writes when fn succeeds", async () => {
    await withTransaction(async () => {
      await WalletModel.create({ userId: "a" });
      await WalletModel.create({ userId: "b" });
    });
    expect(await WalletModel.countDocuments()).toBe(2);
  });

  it("rolls back every write when fn throws, with no session plumbing", async () => {
    await expect(
      withTransaction(async () => {
        await WalletModel.create({ userId: "a" });
        await WalletModel.updateOne({ userId: "a" }, { $set: { unlockedKwd: "9.000" } });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(await WalletModel.countDocuments()).toBe(0);
  });
});
