import mongoose from "mongoose";
import { UserOfferModel } from "./src/models/userOffer.model.js";
import dotenv from "dotenv";

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  // Find all group UserOffers
  const groupOffers = await UserOfferModel.find({ 
    membershipType: "group",
    status: { $in: ["pending_payment", "active", "reserved", "enet_pending"] }
  }).lean();
  
  console.log("=== ALL GROUP USER OFFERS ===");
  for (const uo of groupOffers) {
    console.log({
      _id: (uo as any)._id.toString(),
      userId: uo.userId,
      offerId: (uo as any).offerId?.toString(),
      status: uo.status,
      groupInviteCode: (uo as any).groupInviteCode,
      sharedWith: (uo as any).sharedWith,
      createdAt: uo.createdAt,
    });
  }
  
  // Check for duplicates: same user + same offer
  const grouped: Record<string, any[]> = {};
  for (const uo of groupOffers) {
    const key = `${uo.userId}|${(uo as any).offerId?.toString()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(uo);
  }
  
  console.log("\n=== DUPLICATE USER+OFFER COMBOS ===");
  for (const [key, items] of Object.entries(grouped)) {
    if (items.length > 1) {
      console.log(`DUPLICATE: ${key} (${items.length} records)`);
      items.forEach(i => console.log(`  - _id: ${(i as any)._id}, status: ${i.status}, groupInviteCode: ${(i as any).groupInviteCode}`));
    }
  }
  
  process.exit(0);
}

check().catch(console.error);
