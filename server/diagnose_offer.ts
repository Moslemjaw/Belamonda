import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const offer = await mongoose.connection.collection("offers").findOne({ name: "Naumi Silver" });
  console.log("=== Naumi Silver Offer ===");
  console.log(JSON.stringify(offer, null, 2));

  // Find the user offer for this customer
  const userOffer = await mongoose.connection.collection("useroffers").findOne({ offerId: offer?._id });
  console.log("\n=== UserOffer ===");
  console.log(JSON.stringify(userOffer, null, 2));

  process.exit(0);
}
main().catch(console.error);
