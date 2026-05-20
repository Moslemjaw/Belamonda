import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
  const db = mongoose.connection.db!;

  const twoDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const uos = await db.collection("useroffers").find({
    createdAt: { $gte: twoDaysAgo }
  }).toArray();

  console.log(`Found ${uos.length} user offers created since ${twoDaysAgo.toISOString()}`);

  const offerIds = [...new Set(uos.map(uo => String(uo.offerId)))].map(id => new mongoose.Types.ObjectId(id));
  const offers = await db.collection("offers").find({ _id: { $in: offerIds } }).toArray();
  const offerMap = new Map(offers.map(o => [String(o._id), o]));

  const summary: Record<string, number> = {};
  for (const uo of uos) {
    const offer = offerMap.get(String(uo.offerId));
    const offerName = offer ? offer.name : "Unknown Offer";
    summary[offerName] = (summary[offerName] || 0) + 1;
  }
  console.log("Summary by offer:", JSON.stringify(summary, null, 2));

  console.log("\nDetails of some recent memberships:");
  
  const userIds = [...new Set(uos.map(uo => String(uo.userId)))].map(id => new mongoose.Types.ObjectId(id));
  const users = await db.collection("users").find({ _id: { $in: userIds } }).toArray();
  const userMap = new Map(users.map(u => [String(u._id), u]));

  const wallets = await db.collection("wallets").find({ userId: { $in: userIds.map(id => String(id)) } }).toArray();
  const walletMap = new Map(wallets.map(w => [w.userId, w]));

  for (const uo of uos) {
    const offer = offerMap.get(String(uo.offerId));
    if (!offer) continue;
    const offerName = offer.name;
    if (
      offerName.toLowerCase().includes("jamali") ||
      offerName.toLowerCase().includes("naomi")
    ) {
      const user = userMap.get(String(uo.userId));
      const wallet = walletMap.get(String(uo.userId));
      console.log(`- User: ${user?.fullName} (${user?.phone})`);
      console.log(`  Offer: ${offerName} (ID: ${offer._id})`);
      console.log(`  UserOffer ID: ${uo._id}`);
      console.log(`  UO details: status=${uo.status}, purchaseMode=${uo.purchaseMode}, totalSignupCashbackKwd=${uo.totalSignupCashbackKwd}, cashbackGrantedKwd=${uo.cashbackGrantedKwd}, cashbackBalanceKwd=${uo.cashbackBalanceKwd}`);
      console.log(`  Wallet: unlocked=${wallet?.unlockedKwd}, locked=${wallet?.lockedKwd}, ceiling=${wallet?.ceilingKwd}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
