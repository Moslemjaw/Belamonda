import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { UserOfferModel } from "./src/models/userOffer.model.js";

async function main() {
  console.log("Connecting to", process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda");
  const offers = await UserOfferModel.find({ "totalSignupCashbackKwd": { $exists: true, $ne: null } }).lean();
  console.log("Found", offers.length, "offers with totalSignupCashbackKwd");
  for (const o of offers) {
    console.log(`ID: ${o._id}`);
    console.log(`totalSignup: ${(o as any).totalSignupCashbackKwd}, granted: ${(o as any).cashbackGrantedKwd}, balance: ${(o as any).cashbackBalanceKwd}, applied: ${(o as any).cashbackAppliedKwd}`);
  }
  process.exit(0);
}
main();
