import mongoose from "mongoose";
import { UserOfferModel } from "./src/models/userOffer.model.js";
import { listUserOffersByUser } from "./src/services/userOffer.service.js";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const userId = "6a3ac4ea72f1540d01a18f12"; // The user from the error message
  
  const items = await listUserOffersByUser(userId);
  
  console.log("=== USER OFFERS FROM listUserOffersByUser ===");
  for (const item of items) {
    console.log({
      id: (item as any).id,
      _id: (item as any)._id,
      offerId: item.offerId,
      status: item.status,
    });
  }
  
  process.exit(0);
}

check().catch(console.error);
