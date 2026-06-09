import mongoose from "mongoose";
import { config } from "dotenv";
config();

const PHONE = "646464646466446";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;

  // Find the test user
  const user = await db.collection("users").findOne({ phone: PHONE });
  if (!user) {
    console.log(`User with phone ${PHONE} not found!`);
    process.exit(0);
  }

  const userId = user._id;
  const userIdStr = userId.toString();
  console.log(`Found user: ${user.fullName || user.username || "—"} (ID: ${userIdStr})`);
  console.log("---");

  // Collections where userId is stored as a string
  const stringIdCollections = [
    "wallets",
    "wallettxns",
    "kycsubmissions",
    "formreminderlogs",
  ];

  // Collections where userId could be ObjectId or string
  const flexIdCollections = [
    "useroffers",
    "bookingrequests",
    "bookingsessions",
    "payments",
    "cashbackrequests",
    "eformsubmissions",
    "subscriptionrequests",
    "complaints",
    "clinicchangerequests",
    "notifications",
  ];

  let totalDeleted = 0;

  // Delete from string-ID collections
  for (const col of stringIdCollections) {
    try {
      const result = await db.collection(col).deleteMany({ userId: userIdStr });
      console.log(`  ${col}: ${result.deletedCount} deleted`);
      totalDeleted += result.deletedCount;
    } catch (e: any) {
      console.log(`  ${col}: error - ${e.message}`);
    }
  }

  // Delete from flex-ID collections (try both ObjectId and string)
  for (const col of flexIdCollections) {
    try {
      const r1 = await db.collection(col).deleteMany({ userId: userIdStr });
      const r2 = await db.collection(col).deleteMany({ userId: userId });
      const count = r1.deletedCount + r2.deletedCount;
      console.log(`  ${col}: ${count} deleted`);
      totalDeleted += count;
    } catch (e: any) {
      console.log(`  ${col}: error - ${e.message}`);
    }
  }

  // Also check auditlogs
  try {
    const r = await db.collection("auditlogs").deleteMany({
      $or: [{ userId: userIdStr }, { userId: userId }]
    });
    console.log(`  auditlogs: ${r.deletedCount} deleted`);
    totalDeleted += r.deletedCount;
  } catch {}

  // Delete the user document itself
  const userDel = await db.collection("users").deleteOne({ _id: userId });
  console.log(`  users: ${userDel.deletedCount} deleted`);
  totalDeleted += userDel.deletedCount;

  console.log("---");
  console.log(`Total records deleted: ${totalDeleted}`);
  console.log("Done! Test user fully cleaned up.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
