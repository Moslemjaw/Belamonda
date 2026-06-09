import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const OLD_OFFER_ID = new mongoose.Types.ObjectId('6a0eec6432ce053ddc3ed38f');
const NEW_OFFER_ID = new mongoose.Types.ObjectId('6a04dca849f76e3307f97f97');

async function mergeOffers() {
  const mongoUri = process.env.MONGODB_URI!;
  if (!mongoUri) { console.error("MONGODB_URI not set"); process.exit(1); }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) { console.error("Database connection failed"); process.exit(1); }

  console.log("Merging 'باكيج 99' -> 'Nuomi Plus'...");

  // Update UserOffers
  const r1 = await db.collection("useroffers").updateMany(
    { offerId: OLD_OFFER_ID },
    { $set: { offerId: NEW_OFFER_ID } }
  );
  console.log(`UserOffers updated: ${r1.modifiedCount}`);

  // Update Payments
  const r2 = await db.collection("payments").updateMany(
    { offerId: OLD_OFFER_ID },
    { $set: { offerId: NEW_OFFER_ID } }
  );
  console.log(`Payments updated: ${r2.modifiedCount}`);

  // Update BookingSessions
  const r3 = await db.collection("bookingsessions").updateMany(
    { offerId: OLD_OFFER_ID },
    { $set: { offerId: NEW_OFFER_ID } }
  );
  console.log(`BookingSessions updated: ${r3.modifiedCount}`);

  // Delete the old offer
  const r4 = await db.collection("offers").deleteOne({ _id: OLD_OFFER_ID });
  console.log(`Deleted 'باكيج 99' offer: ${r4.deletedCount}`);

  console.log("Merge complete!");
  await mongoose.disconnect();
}

mergeOffers().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
