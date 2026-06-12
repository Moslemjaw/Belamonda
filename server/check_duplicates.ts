import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "./src/db/mongo";
import { UserOfferModel } from "./src/models/userOffer.model";
import { UserModel } from "./src/models/user.model";

async function main() {
  await connectMongo();
  
  const duplicates = await UserOfferModel.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: { userId: "$userId", offerId: "$offerId" },
        count: { $sum: 1 },
        docs: { $push: "$_id" },
        statuses: { $push: "$status" },
        amounts: { $push: "$totalAmountKwd" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);
  
  console.log(`Found ${duplicates.length} users with duplicate memberships.`);
  
  for (const dup of duplicates) {
    const user = await UserModel.findById(dup._id.userId);
    console.log(`User: ${user?.fullName || user?.username} (${dup._id.userId}), Offer: ${dup._id.offerId}`);
    console.log(`Docs: ${dup.docs.join(", ")}, Statuses: ${dup.statuses.join(", ")}, Amounts: ${dup.amounts.join(", ")}`);
  }
  
  process.exit(0);
}

main().catch(console.error);
