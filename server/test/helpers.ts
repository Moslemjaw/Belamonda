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

/** A clinic, an offer at that clinic and an active membership for `userId`. */
export async function makeMembership(
  userId: string,
  opts: { bookingFlow?: "admin_forward" | "direct_clinic"; maxSessions?: number; offer?: Record<string, unknown> } = {}
) {
  const { ClinicModel } = await import("../src/models/clinic.model.js");
  const { OfferModel } = await import("../src/models/offer.model.js");
  const clinic = await ClinicModel.create({ nameEn: "Test Clinic", active: true });
  const offer = await OfferModel.create({
    name: "Test Membership",
    type: "A",
    subscriptionPriceKwd: "89.000",
    validityDays: 365,
    maxSessions: opts.maxSessions ?? 6,
    sessionIntervalDays: 0,
    clinicId: clinic._id,
    bookingFlow: opts.bookingFlow ?? "admin_forward",
    status: "active",
    active: true,
    ...opts.offer
  });
  const userOfferId = await makeUserOffer(userId, {
    offerId: offer._id,
    clinicId: clinic._id,
    membershipType: "free_sessions",
    sessionsUsed: 0,
    activatedAt: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })(), // start of today
    expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000)
  });
  return { clinicId: String(clinic._id), offerId: String(offer._id), userOfferId };
}

export async function makeClinicStaff(clinicId: string) {
  const user = await UserModel.create({ role: "clinicStaff", passwordHash: "x", clinicId });
  const id = String(user._id);
  return { id, token: signAccessToken({ sub: id, role: "clinicStaff", clinicId }) };
}

/** A datetime later today — always in the future and still today, whatever the time of day. */
export function laterToday(hours = 1) {
  const now = Date.now();
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 0, 0);
  const halfwayToMidnight = now + Math.max(0, endOfDay.getTime() - now) / 2;
  return new Date(Math.min(now + hours * 3600 * 1000, halfwayToMidnight)).toISOString();
}

export async function cashbackBalance(userOfferId: string) {
  const doc = await UserOfferModel.collection.findOne({ _id: new mongoose.Types.ObjectId(userOfferId) });
  return doc?.cashbackBalanceKwd as string | undefined;
}
