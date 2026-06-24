import mongoose from "mongoose";
import { OfferModel } from "./src/models/offer.model.js";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  const offers = await OfferModel.find({ name: /Naumi Classic/i });
  console.log(offers.map(o => ({ name: o.name, isGroupOffer: o.isGroupOffer })));
  process.exit(0);
}

check().catch(console.error);
