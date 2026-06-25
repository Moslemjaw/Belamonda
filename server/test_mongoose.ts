import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  try {
    const { OfferModel } = await import("./src/models/offer.model.js");
    await OfferModel.find({ _id: { $in: ["undefined"] } }).lean();
    console.log("Success");
  } catch(e) {
    console.error("Error:", e);
  }
  await mongoose.disconnect();
}
run();
