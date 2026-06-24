import mongoose from "mongoose";
import { UserOfferModel } from "./src/models/userOffer.model.js";
import { OfferModel } from "./src/models/offer.model.js";
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
  console.log("Found UserOffer _id:", String(o._id));
  console.log("Found UserOffer offerId:", String(o.offerId));
  console.log("User ID:", String(o.userId));
  
  // Now simulate assertNotAlreadyEnrolled
  const query: any = {
    userId: String(o.userId),
    offerId: new mongoose.Types.ObjectId(o.offerId),
    status: { $in: ["pending_payment", "active", "reserved", "enet_pending"] }
  };
  
  // Try excluding with the CORRECT _id
  query._id = { $ne: new mongoose.Types.ObjectId(o._id) };
  let count = await UserOfferModel.countDocuments(query);
  console.log("Count with CORRECT excludeUserOfferId:", count);
  
  // Try excluding with the WRONG _id (the offerId)
  query._id = { $ne: new mongoose.Types.ObjectId(o.offerId) };
  count = await UserOfferModel.countDocuments(query);
  console.log("Count with WRONG excludeUserOfferId (offerId):", count);
  
  process.exit(0);
}

check().catch(console.error);
