import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Get IDs for General Service and Other
  const generalOffer = await db.collection("offers").findOne({ name: "General Service" });
  const otherOffer = await db.collection("offers").findOne({ name: "Other" });

  console.log("General Service ID:", generalOffer?._id);
  console.log("Other Offer ID:", otherOffer?._id);

  let generalCount = 0;
  let otherCount = 0;

  // 2. Find any UserOffers connected to them
  if (generalOffer) {
    generalCount = await db.collection("useroffers").countDocuments({ offerId: generalOffer._id });
    console.log("UserOffers connected to General Service:", generalCount);
  }
  
  if (otherOffer) {
    otherCount = await db.collection("useroffers").countDocuments({ offerId: otherOffer._id });
    console.log("UserOffers connected to Other:", otherCount);
  }

  // 3. Let's write a small snippet to update all enrolled counts
  const allOffers = await db.collection("offers").find({}).toArray();
  for (const offer of allOffers) {
    const count = await db.collection("useroffers").countDocuments({ offerId: offer._id, status: { $in: ["active", "expired"] } });
    
    await db.collection("offers").updateOne({ _id: offer._id }, { $set: { enrolledCount: count } });
    console.log(`Updated offer ${offer.name} with enrolledCount: ${count}`);
  }

  // 4. Delete if safe
  if (generalCount === 0 && generalOffer) {
    console.log("Deleting General Service offer...");
    await db.collection("offers").deleteOne({ _id: generalOffer._id });
  }

  if (otherCount === 0 && otherOffer) {
    console.log("Deleting Other offer...");
    await db.collection("offers").deleteOne({ _id: otherOffer._id });
  }

  await mongoose.disconnect();
}

main().catch(console.error);
