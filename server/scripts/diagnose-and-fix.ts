import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { KycSubmissionModel, WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  // Find the user - Musallam Jawish
  const user = await UserModel.findOne({ displayName: /musallam/i }) || await UserModel.findOne({ phone: /9659727/ });
  if (!user) {
    console.log("User not found!");
    process.exit(0);
  }
  const userId = user._id.toString();
  console.log(`User: ${user.displayName} (${userId}), phone: ${user.phone}`);

  // 1. Check wallet state
  const wallet = await WalletModel.findOne({ userId });
  if (wallet) {
    console.log(`\n=== WALLET ===`);
    console.log(`  unlockedKwd: ${wallet.unlockedKwd}`);
    console.log(`  lockedKwd:   ${wallet.lockedKwd}`);
    console.log(`  ceilingKwd:  ${wallet.ceilingKwd}`);
  } else {
    console.log("No wallet found!");
  }

  // 2. Check wallet transactions
  const txns = await WalletTxnModel.find({ userId }).sort({ createdAt: -1 }).lean();
  console.log(`\n=== WALLET TRANSACTIONS (${txns.length}) ===`);
  for (const t of txns) {
    console.log(`  [${(t as any).type}] ${(t as any).amountKwd} KWD - ref: ${JSON.stringify((t as any).reference)} - ${(t as any).reason || ''} - ${(t as any).createdAt}`);
  }

  // 3. Check user offers
  const offers = await UserOfferModel.find({ userId }).lean();
  console.log(`\n=== USER OFFERS (${offers.length}) ===`);
  for (const o of offers) {
    console.log(`  Offer ${(o as any)._id}:`);
    console.log(`    membershipType:     ${(o as any).membershipType}`);
    console.log(`    purchaseMode:       ${(o as any).purchaseMode}`);
    console.log(`    status:             ${(o as any).status}`);
    console.log(`    cashbackBalanceKwd: ${(o as any).cashbackBalanceKwd}`);
    console.log(`    sessionsUsed:       ${(o as any).sessionsUsed}`);
    console.log(`    installmentCount:   ${(o as any).installmentCount}`);
    console.log(`    installmentsPaid:   ${(o as any).installmentsPaid}`);
    const sched = (o as any).installmentSchedule ?? [];
    console.log(`    installmentSchedule (${sched.length} entries):`);
    for (const s of sched) {
      console.log(`      #${s.number}: ${s.amountKwd} KWD, due: ${s.dueDate}, paid: ${s.paid}, paidAt: ${s.paidAt}`);
    }
  }

  // 4. Check booking requests
  const breqs = await BookingRequestModel.find({ userId }).lean();
  console.log(`\n=== BOOKING REQUESTS (${breqs.length}) ===`);
  for (const b of breqs) {
    console.log(`  Request ${(b as any)._id}:`);
    console.log(`    status:              ${(b as any).status}`);
    console.log(`    hadCashback:         ${(b as any).hadCashback}`);
    console.log(`    cashbackDeductedKwd: ${(b as any).cashbackDeductedKwd}`);
    console.log(`    sessionPriceKwd:     ${(b as any).sessionPriceKwd}`);
    console.log(`    clinicPaymentStatus: ${(b as any).clinicPaymentStatus}`);
  }

  // 5. Check sessions
  const sessions = await BookingSessionModel.find({ userId }).lean();
  console.log(`\n=== SESSIONS (${sessions.length}) ===`);
  for (const s of sessions) {
    console.log(`  Session ${(s as any)._id}: status=${(s as any).status}, cashbackUnlockedKwd=${(s as any).cashbackUnlockedKwd}`);
  }

  process.exit(0);
}

run().catch(console.error);
