import mongoose from "mongoose";
import request from "supertest";
import type { Role } from "@belamonda/shared";
import { createApp } from "../src/app.js";
import { signAccessToken } from "../src/modules/auth/token.js";
import { UserModel } from "../src/models/user.model.js";
import { WalletModel } from "../src/models/kyc.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";

export const app = createApp();
export const api = () => request(app);

export async function makeUser(role: Role) {
  const user = await UserModel.create({ role, passwordHash: "x", verificationStatus: "approved" });
  const id = String(user._id);
  return { id, token: signAccessToken({ sub: id, role }) };
}

export async function makeWallet(userId: string, unlockedKwd: string) {
  await WalletModel.create({ userId, unlockedKwd });
}

export async function walletUnlocked(userId: string) {
  return (await WalletModel.findOne({ userId }).lean<{ unlockedKwd: string }>())?.unlockedKwd;
}

export async function makeUserOffer(userId: string, fields: Record<string, unknown> = {}) {
  const _id = new mongoose.Types.ObjectId();
  // Raw insert: these tests only exercise booking/cashback fields, not the full schema.
  await UserOfferModel.collection.insertOne({
    _id,
    userId,
    offerId: new mongoose.Types.ObjectId(),
    status: "active",
    ...fields
  });
  return String(_id);
}

export async function cashbackBalance(userOfferId: string) {
  const doc = await UserOfferModel.collection.findOne({ _id: new mongoose.Types.ObjectId(userOfferId) });
  return doc?.cashbackBalanceKwd as string | undefined;
}
