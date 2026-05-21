import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function cleanup() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  // Find all roles
  const roles = await db.collection("users").aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } }
  ]).toArray();
  console.log("Roles:", JSON.stringify(roles));

  // Delete all users that are NOT admin or clinicStaff
  const del = await db.collection("users").deleteMany({
    role: { $nin: ["admin", "clinicStaff"] }
  });
  console.log("Deleted seeded users:", del.deletedCount);

  // Also clean up related collections
  const uo = await db.collection("useroffers").deleteMany({});
  const bs = await db.collection("bookingsessions").deleteMany({});
  const p = await db.collection("payments").deleteMany({});
  console.log("Deleted:", uo.deletedCount, "userOffers,", bs.deletedCount, "sessions,", p.deletedCount, "payments");

  // Delete the ملغي offer if it exists
  const mo = await db.collection("offers").deleteOne({ name: "ملغي" });
  if (mo.deletedCount) console.log("Deleted ملغي offer");

  await mongoose.disconnect();
  console.log("✅ Cleanup complete");
}

cleanup().catch(console.error);
