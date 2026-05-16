import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { OfferModel } from "../src/models/offer.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected\n");

  const userId = "6a08a505307270f12df2e6df";

  // Check wallet
  const wallet = await WalletModel.findOne({ userId });
  console.log("=== WALLET ===");
  console.log(`  unlocked: ${wallet?.unlockedKwd}, locked: ${wallet?.lockedKwd}, ceiling: ${wallet?.ceilingKwd}`);

  // Check transactions
  const txns = await WalletTxnModel.find({ userId }).sort({ createdAt: -1 }).lean();
  console.log(`\n=== TRANSACTIONS (${txns.length}) ===`);
  for (const t of txns) {
    console.log(`  [${(t as any).type}] ${(t as any).amountKwd} KWD - ${(t as any).reason || JSON.stringify((t as any).reference)} - ${(t as any).createdAt}`);
  }

  // Check user offer
  const uo = await UserOfferModel.findOne({ userId }).lean();
  console.log(`\n=== USER OFFER ===`);
  console.log(`  cashbackBalanceKwd: ${(uo as any)?.cashbackBalanceKwd}`);
  console.log(`  sessionsUsed: ${(uo as any)?.sessionsUsed}`);

  // Check the OFFER itself to see cashbackPerSessionKwd
  const offer = await OfferModel.findById((uo as any)?.offerId).lean();
  console.log(`\n=== OFFER ===`);
  console.log(`  name: ${(offer as any)?.name}`);
  console.log(`  cashbackPerSessionKwd: ${(offer as any)?.cashbackPerSessionKwd}`);
  console.log(`  signupCashbackKwd: ${(offer as any)?.signupCashbackKwd}`);
  console.log(`  membershipType: ${(offer as any)?.membershipType}`);

  // Check ALL booking requests
  const breqs = await BookingRequestModel.find({ userId }).sort({ createdAt: -1 }).lean();
  console.log(`\n=== BOOKING REQUESTS (${breqs.length}) ===`);
  for (const b of breqs) {
    console.log(`  ${(b as any)._id}: status=${(b as any).status}, hadCashback=${(b as any).hadCashback}, cashbackDeductedKwd=${(b as any).cashbackDeductedKwd}, sessionPriceKwd=${(b as any).sessionPriceKwd}, clinicPaymentStatus=${(b as any).clinicPaymentStatus}, created=${(b as any).createdAt}`);
  }

  // Check ALL sessions
  const sessions = await BookingSessionModel.find({ userId }).sort({ createdAt: -1 }).lean();
  console.log(`\n=== SESSIONS (${sessions.length}) ===`);
  for (const s of sessions) {
    console.log(`  ${(s as any)._id}: status=${(s as any).status}, cashbackUnlockedKwd=${(s as any).cashbackUnlockedKwd}, created=${(s as any).createdAt}`);
  }

  process.exit(0);
}

run().catch(console.error);
