import mongoose from "mongoose";
import { PaymentModel } from "./dist/models/payment.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const createdBy = await PaymentModel.distinct("createdByUserId");
  console.log("Unique createdByUserId in Payments:", createdBy);
  
  const confirmedBy = await PaymentModel.distinct("confirmedBy");
  console.log("Unique confirmedBy in Payments:", confirmedBy);
  
  mongoose.disconnect();
}

run().catch(console.error);
