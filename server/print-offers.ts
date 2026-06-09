import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const offers = await db.collection("offers").find({}).toArray();
  for (const o of offers) {
    console.log(`Name: ${o.name}`);
    console.log(`  ID: ${o._id}`);
    console.log(`  signupCashbackKwd: ${o.signupCashbackKwd}`);
    console.log(`  isCashbackOnly: ${o.isCashbackOnly}`);
    console.log(`  membershipType: ${o.membershipType}`);
    console.log(`  cashbackPerSessionKwd: ${o.cashbackPerSessionKwd}`);
    console.log(`  maxSessions: ${o.maxSessions}`);
  }
  await mongoose.disconnect();
}
main();
