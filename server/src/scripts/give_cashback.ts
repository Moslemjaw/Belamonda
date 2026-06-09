import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { UserOfferModel } from "../models/userOffer.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  console.log("Checking for missing cashback wallets...");
  
  const cashbackOffers = await db.collection("offers").find({ membershipType: "cashback" }).toArray();
  const cbOfferIds = cashbackOffers.map(o => o._id.toString());
  
  console.log(`Found ${cbOfferIds.length} cashback offers.`);
  
  const cashbackUsers = await UserOfferModel.find({ offerId: { $in: cbOfferIds } }).lean();
  console.log(`Found ${cashbackUsers.length} users with cashback offers.`);
  
  let walletsCreated = 0;
  let idx = 0;

  for (const uo of cashbackUsers as any[]) {
    idx++;
    if (idx % 20 === 0) console.log(`Processed ${idx} / ${cashbackUsers.length}...`);
    
    const wallet = await db.collection("wallets").findOne({ userId: uo.userId });
    if (!wallet) {
      const startCb = parseFloat(uo.totalSignupCashbackKwd || "0") || parseFloat(uo.cashbackBalanceKwd || "0");
      if (startCb > 0) {
        await db.collection("wallets").insertOne({
          userId: uo.userId,
          ceilingKwd: startCb.toFixed(3),
          unlockedKwd: startCb.toFixed(3),
          lockedKwd: "0.000",
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await db.collection("wallettxns").insertOne({
          userId: uo.userId,
          type: "signup_bonus",
          amountKwd: startCb.toFixed(3),
          notes: "Initial cashback from membership migration",
          createdAt: new Date(),
          updatedAt: new Date()
        });
        walletsCreated++;
      }
    }
  }
  console.log(`Created ${walletsCreated} missing wallets for cashback users.`);

  await mongoose.disconnect();
}

main().catch(console.error);
