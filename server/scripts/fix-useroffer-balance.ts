import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserOfferModel } from "../src/models/userOffer.model.js";

function kwdMils(kwdStr: string): number {
  return Math.round(parseFloat(kwdStr || "0") * 1000);
}

function fmt(mils: number): string {
  return (Math.max(0, mils) / 1000).toFixed(3);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  const offers = await UserOfferModel.find({ status: "active", cashbackBalanceKwd: { $exists: true } }).lean();

  for (const o of offers) {
    const signup = kwdMils((o as any).signupCashbackKwd || "0.000");
    const granted = kwdMils((o as any).cashbackGrantedKwd || "0.000");
    const balance = kwdMils((o as any).cashbackBalanceKwd || "0.000");

    if (granted > 0 && balance > granted) {
      console.log(`Fixing offer ${o._id}...`);
      console.log(`  Current Balance: ${fmt(balance)}`);
      console.log(`  Granted: ${fmt(granted)}`);
      console.log(`  Expected Balance: ${fmt(granted)} (since they only received what was granted)`);

      await UserOfferModel.findByIdAndUpdate(o._id, {
        $set: { cashbackBalanceKwd: fmt(granted) }
      });
      console.log("  Fixed.");
    }
  }

  process.exit(0);
}

run().catch(console.error);
