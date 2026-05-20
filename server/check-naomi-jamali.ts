import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const twoDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const uos = await db.collection("useroffers").find({
    createdAt: { $gte: twoDaysAgo }
  }).toArray();

  const userIds = uos.map(u => u.userId);
  const users = await db.collection("users").find({ _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } }).toArray();
  const userMap = new Map(users.map(u => [String(u._id), u]));

  const offerIds = uos.map(u => u.offerId);
  const offers = await db.collection("offers").find({ _id: { $in: offerIds } }).toArray();
  const offerMap = new Map(offers.map(o => [String(o._id), o]));

  const wallets = await db.collection("wallets").find({ userId: { $in: userIds.map(id => String(id)) } }).toArray();
  const walletMap = new Map(wallets.map(w => [w.userId, w]));

  console.log("=== RECENT JAMALI/NAOMI/MINI USER OFFERS ===");
  for (const uo of uos) {
    const offer = offerMap.get(String(uo.offerId));
    if (!offer) continue;
    const name = offer.name.toLowerCase();
    if (name.includes("jamali") || name.includes("naomi") || name.includes("nuomi")) {
      const user = userMap.get(String(uo.userId));
      const wallet = walletMap.get(String(uo.userId));
      console.log(`UserOffer ID: ${uo._id}`);
      console.log(`  User: ${user?.fullName} (${user?.phone})`);
      console.log(`  Offer: ${offer.name}`);
      console.log(`  Status: ${uo.status}`);
      console.log(`  PurchaseMode: ${uo.purchaseMode}`);
      console.log(`  sessionsUsed: ${uo.sessionsUsed}`);
      console.log(`  totalSignupCashbackKwd: ${uo.totalSignupCashbackKwd}`);
      console.log(`  cashbackGrantedKwd: ${uo.cashbackGrantedKwd}`);
      console.log(`  cashbackBalanceKwd: ${uo.cashbackBalanceKwd}`);
      console.log(`  Wallet: unlocked=${wallet?.unlockedKwd}, locked=${wallet?.lockedKwd}, ceiling=${wallet?.ceilingKwd}`);
      console.log("-----------------------------------------");
    }
  }

  await mongoose.disconnect();
}
main();
