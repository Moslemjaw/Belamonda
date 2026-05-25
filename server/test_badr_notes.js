import mongoose from "mongoose";
import { PaymentModel } from "./dist/models/payment.model.js";
import { UserOfferModel } from "./dist/models/userOffer.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const pNote = await PaymentModel.find({ notes: { $regex: /badr/i } }).lean();
  console.log("Payments with badr in notes:", pNote.length);
  
  const uoNote = await UserOfferModel.find({ 
      $or: [
          { enetReason: { $regex: /badr/i } },
          { shortId: { $regex: /badr/i } }
      ]
  }).lean();
  console.log("UserOffers with badr:", uoNote.length);
  
  mongoose.disconnect();
}

run().catch(console.error);
