import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
import { OfferModel } from "./src/models/offer.model.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "");
  const offer = await OfferModel.findOne({ isGroupOffer: true }).lean();
  console.log("Found Group Offer:", offer ? offer._id : "None");
  process.exit(0);
}
main();
