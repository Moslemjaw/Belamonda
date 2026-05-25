import mongoose from "mongoose";
import { UserOfferModel } from "./dist/models/userOffer.model.js";
import { PaymentModel } from "./dist/models/payment.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const offers = await UserOfferModel.find({}).limit(10).lean();
  console.log("UserOffers sample:", JSON.stringify(offers, null, 2));
  
  const pays = await PaymentModel.find({}).limit(10).lean();
  console.log("Payments sample:", JSON.stringify(pays, null, 2));
  
  mongoose.disconnect();
}

run().catch(console.error);
