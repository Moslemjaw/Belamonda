import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { UserOfferModel } from "./src/models/userOffer.model.js";
import { UserModel } from "./src/models/user.model.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "");
  const userId = new mongoose.Types.ObjectId("6a3ac4ea72f1540d01a18f12"); // Nariman
  const offerId = new mongoose.Types.ObjectId("6a0f0add1eac7d9d8053a347"); // Valid Group Offer
  
  // 1. Create the 'creator' user offer if it doesn't exist
  let creatorUo = await UserOfferModel.findOne({ groupInviteCode: "9C8AA30E" });
  if (!creatorUo) {
      creatorUo = await UserOfferModel.create({
          userId: new mongoose.Types.ObjectId("6a12d1da7022845c74a0dc45"), // Some random valid-looking user ID
          offerId: offerId,
          status: "active",
          membershipType: "group",
          groupInviteCode: "9C8AA30E",
          sharedWith: [],
          purchaseMode: "full",
          pendingExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
  }
  
  // 2. Add Nariman to the creator's sharedWith array
  await UserOfferModel.findByIdAndUpdate(creatorUo._id, { $addToSet: { sharedWith: userId } });
  
  // 3. Create the pending user offer for Nariman
  const existing = await UserOfferModel.findOne({ userId, groupInviteCode: "9C8AA30E", membershipType: "group" });
  if (!existing) {
      await UserOfferModel.create({
          userId,
          groupInviteCode: "9C8AA30E",
          membershipType: "group",
          offerId,
          status: "pending_payment",
          sharedWith: [],
          purchaseMode: "full",
          pendingExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      console.log("Successfully added user to group 9C8AA30E");
  } else {
      console.log("User was already in the group.");
  }
  process.exit(0);
}
main();
