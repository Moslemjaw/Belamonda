import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  // Check the Jamali offer details
  const offer = await db.collection("offers").findOne({ name: /jamali/i });
  if (offer) {
    console.log("=== JAMALI OFFER ===");
    console.log("ID:", offer._id.toString());
    console.log("signupCashbackKwd:", offer.signupCashbackKwd);
    console.log("cashbackActivationFeeKwd:", offer.cashbackActivationFeeKwd);
    console.log("cashbackPerSessionKwd:", offer.cashbackPerSessionKwd);
    console.log("isCashbackOnly:", offer.isCashbackOnly);
    console.log("membershipType:", offer.membershipType);
    console.log("subscriptionPriceKwd:", offer.subscriptionPriceKwd);
    console.log("allowInstallments:", offer.allowInstallments);
    console.log("maxInstallments:", offer.maxInstallments);
  }

  // Check ALL wallet txns for this user (not just 10)
  const userId = "6a08674b74d19e8118c57f2c";
  const allTxns = await db.collection("wallettxns").find({ userId }).sort({ createdAt: -1 }).toArray();
  console.log(`\n=== ALL WALLET TXNS (${allTxns.length}) ===`);
  for (const t of allTxns) {
    console.log(`  ${t.type} | ${t.amountKwd} | ref: ${JSON.stringify(t.reference)} | ${t.createdAt}`);
  }

  // Check wallet history (any audit/update traces)
  const wallet = await db.collection("wallets").findOne({ userId });
  console.log("\n=== WALLET FULL DOC ===");
  console.log(JSON.stringify(wallet, null, 2));

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
