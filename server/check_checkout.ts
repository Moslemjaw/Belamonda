import mongoose from "mongoose";
import { UserOfferModel } from "./src/models/userOffer.model.js";
import { OfferModel } from "./src/models/offer.model.js";
import { checkoutFull } from "./src/services/checkout.service.js";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  const offers = await UserOfferModel.find({ status: "pending_payment" }).lean() as any[];
  
  if (offers.length === 0) {
    console.log("No pending offers found");
    process.exit(0);
  }
  
  const o = offers[0];
  console.log("Testing checkoutFull with userOfferId...");
  try {
    await checkoutFull({
      userId: String(o.userId),
      offerId: String(o.offerId),
      userOfferId: String(o._id),
      clinicId: String(o.clinicId),
    });
    console.log("SUCCESS!");
  } catch (e: any) {
    console.error("FAILED with error:", e.message || e.code || e);
  }

  process.exit(0);
}

check().catch(console.error);
