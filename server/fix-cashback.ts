import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
  const db = mongoose.connection.db!;

  const JAMALI_OFFER_ID = "6a04da4b49f76e3307f97f2f";
  const USER_ID = "6a08674b74d19e8118c57f2c";
  const UO_ID = "6a0867b774d19e8118c57f89";

  // Fix 1: Jamali offer — total cashback = 1500 KWD
  await db.collection("offers").updateOne(
    { _id: new mongoose.Types.ObjectId(JAMALI_OFFER_ID) },
    { $set: { signupCashbackKwd: "1500.000" } }
  );
  console.log("✅ Jamali offer signupCashbackKwd → 1500.000");

  // Fix 2: Wallet — unlocked=500, locked=1000, ceiling=1500
  await db.collection("wallets").updateOne(
    { userId: USER_ID },
    { $set: { ceilingKwd: "1500.000", lockedKwd: "1000.000", unlockedKwd: "500.000" } }
  );
  console.log("✅ Wallet: ceiling=1500, locked=1000, unlocked=500");

  // Fix 3: UserOffer — total=1500, granted=500, balance=500
  await db.collection("useroffers").updateOne(
    { _id: new mongoose.Types.ObjectId(UO_ID) },
    { $set: { totalSignupCashbackKwd: "1500.000", cashbackGrantedKwd: "500.000", cashbackBalanceKwd: "500.000" } }
  );
  console.log("✅ UserOffer: total=1500, granted=500, balance=500");

  // Verify
  const w = await db.collection("wallets").findOne({ userId: USER_ID });
  const u = await db.collection("useroffers").findOne({ _id: new mongoose.Types.ObjectId(UO_ID) });
  const o = await db.collection("offers").findOne({ _id: new mongoose.Types.ObjectId(JAMALI_OFFER_ID) });
  console.log(`\nVerify: Wallet ceil=${w?.ceilingKwd} lock=${w?.lockedKwd} unlock=${w?.unlockedKwd}`);
  console.log(`Verify: UO total=${u?.totalSignupCashbackKwd} granted=${u?.cashbackGrantedKwd} bal=${u?.cashbackBalanceKwd}`);
  console.log(`Verify: Offer signup=${o?.signupCashbackKwd}`);

  await mongoose.disconnect();
  console.log("\n✅ Done!");
}
main().catch(e => { console.error(e); process.exit(1); });
