import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { WalletModel } from "../src/models/kyc.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  const users = await UserModel.find({ fullName: /Musallam Jawish/i }).lean();
  console.log("Found Users:", JSON.stringify(users.map(u => ({ id: u._id, email: u.email })), null, 2));

  for (const u of users) {
    const offers = await UserOfferModel.find({ userId: u._id }).lean();
    console.log(`Offers for ${u._id}:`, JSON.stringify(offers, null, 2));
    const w = await WalletModel.findOne({ userId: u._id }).lean();
    console.log(`Wallet for ${u._id}:`, JSON.stringify(w, null, 2));
  }

  process.exit(0);
}

run().catch(console.error);
