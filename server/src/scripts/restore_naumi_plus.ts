/**
 * restore_naumi_plus.ts
 * 
 * Restores the deleted "Naumi Plus" offer and reconnects all orphaned
 * userOffers, payments, bookingSessions, and bookingRequests that were
 * referencing the old (now deleted) offer ID.
 *
 * Usage:  npx tsx src/scripts/restore_naumi_plus.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGODB_URI!;
  if (!mongoUri) { console.error("MONGODB_URI not set"); process.exit(1); }

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) { console.error("Database connection failed"); process.exit(1); }

  // ── Step 1: Find Qibla Clinic ──────────────────────────────────────────
  const qiblaClinic = await db.collection("clinics").findOne({ nameEn: "Al Qibla Clinic" });
  if (!qiblaClinic) {
    console.error("❌ Qibla Clinic not found — cannot proceed");
    process.exit(1);
  }
  console.log(`Found Qibla Clinic: ${qiblaClinic._id}`);

  // ── Step 2: Re-create the Naumi Plus offer ─────────────────────────────
  const naumiPlusData = {
    name: "Naumi Plus",
    nameAr: "ناعمي بلس",
    type: "A",
    category: "laser",
    offerKind: "cashback",
    membershipType: "cashback",
    clinicId: qiblaClinic._id,
    subscriptionPriceKwd: "99.000",
    validityDays: 365,
    cashbackPerSessionKwd: "20.000",
    allowInstallments: true,
    maxInstallments: 3,
    tagsEn: ["1 Year", "Unlimited Sessions", "20 KWD Cashback/Session"],
    tagsAr: ["سنة واحدة", "جلسات غير محدودة", "كاش باك 20 دك لكل جلسة"],
    active: true,
    featured: true,
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800"
  };

  const upsertResult = await db.collection("offers").findOneAndUpdate(
    { name: "Naumi Plus" },
    { $set: naumiPlusData },
    { upsert: true, returnDocument: "after" }
  );

  const newOffer = upsertResult;
  if (!newOffer) {
    console.error("❌ Failed to create/find Naumi Plus offer");
    process.exit(1);
  }
  const newOfferId = newOffer._id;
  console.log(`✅ Naumi Plus offer restored/found with _id: ${newOfferId}`);

  // ── Step 3: Find all existing offer IDs ────────────────────────────────
  const allOffers = await db.collection("offers").find({}, { projection: { _id: 1 } }).toArray();
  const validOfferIds = new Set(allOffers.map(o => o._id.toString()));
  console.log(`Found ${validOfferIds.size} valid offers in DB`);

  // ── Step 4: Find orphaned userOffers (offerId not in valid offers) ─────
  const allUserOffers = await db.collection("useroffers").find({}).toArray();
  const orphanedUserOffers = allUserOffers.filter(uo => 
    uo.offerId && !validOfferIds.has(uo.offerId.toString())
  );
  console.log(`Found ${orphanedUserOffers.length} orphaned userOffer(s)`);

  if (orphanedUserOffers.length > 0) {
    // Collect the old dangling offer IDs
    const danglingOfferIds = [...new Set(orphanedUserOffers.map(uo => uo.offerId.toString()))];
    console.log(`Dangling offer IDs: ${danglingOfferIds.join(", ")}`);

    // Show affected users
    for (const uo of orphanedUserOffers) {
      console.log(`  → UserOffer ${uo._id} | userId: ${uo.userId} | old offerId: ${uo.offerId} | status: ${uo.status}`);
    }

    // Update all orphaned userOffers to point to the new Naumi Plus
    for (const danglingId of danglingOfferIds) {
      const objectId = new mongoose.Types.ObjectId(danglingId);

      // UserOffers
      const r1 = await db.collection("useroffers").updateMany(
        { offerId: objectId },
        { $set: { offerId: newOfferId } }
      );
      console.log(`✅ UserOffers reconnected (old ${danglingId}): ${r1.modifiedCount}`);

      // Payments
      const r2 = await db.collection("payments").updateMany(
        { offerId: objectId },
        { $set: { offerId: newOfferId } }
      );
      console.log(`✅ Payments reconnected (old ${danglingId}): ${r2.modifiedCount}`);

      // BookingSessions
      const r3 = await db.collection("bookingsessions").updateMany(
        { offerId: objectId },
        { $set: { offerId: newOfferId } }
      );
      console.log(`✅ BookingSessions reconnected (old ${danglingId}): ${r3.modifiedCount}`);

      // BookingRequests
      const r4 = await db.collection("bookingrequests").updateMany(
        { offerId: objectId },
        { $set: { offerId: newOfferId } }
      );
      console.log(`✅ BookingRequests reconnected (old ${danglingId}): ${r4.modifiedCount}`);
    }
  } else {
    console.log("ℹ️  No orphaned userOffers found — the offer may have already been restored or users were not affected.");
  }

  // ── Step 5: Verify ─────────────────────────────────────────────────────
  const verifyCount = await db.collection("useroffers").countDocuments({ offerId: newOfferId });
  console.log(`\n🔍 Verification: ${verifyCount} userOffer(s) now linked to Naumi Plus (${newOfferId})`);

  const offer = await db.collection("offers").findOne({ _id: newOfferId });
  console.log(`🔍 Offer in DB: name="${offer?.name}", active=${offer?.active}, price=${offer?.subscriptionPriceKwd}`);

  console.log("\n✅ Naumi Plus restoration complete!");
  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
