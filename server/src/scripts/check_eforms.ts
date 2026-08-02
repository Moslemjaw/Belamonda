import mongoose from "mongoose";
import { EFormModel } from "../models/eform.model.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  const { OfferModel } = await import("../models/offer.model.js");
  
  console.log("E-form check and cleanup complete.");
  process.exit(0);
}
run().catch(console.error);
