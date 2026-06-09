import mongoose from "mongoose";
import { PaymentModel } from "./dist/models/payment.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const p = await PaymentModel.find({ createdByUserId: { $exists: true, $ne: null } }).select("createdByUserId userId amountKwd").limit(5).lean();
  console.log("Payments with createdByUserId:", p);
  
  mongoose.disconnect();
}

run().catch(console.error);
