import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected");

  const { computeFinanceSnapshot } = await import("../src/modules/reporting/analytics.service.js");
  const snap = await computeFinanceSnapshot();
  console.log(snap);
  process.exit(0);
}

run().catch(console.error);
