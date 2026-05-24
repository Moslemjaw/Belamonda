/**
 * Delete all data for a customer by phone. Usage: npx tsx scripts/delete-user-by-phone.ts <phone>
 */
import mongoose from "mongoose";
import { connectMongo } from "../src/db/mongo.js";

const phone = process.argv[2]?.trim();
if (!phone) {
  console.error("Usage: npx tsx scripts/delete-user-by-phone.ts <phone>");
  process.exit(1);
}

async function run() {
  await connectMongo();
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;
  const user = await db.collection("users").findOne({ phone });

  if (!user) {
    console.log(`User with phone ${phone} not found.`);
    process.exit(0);
  }

  const userId = user._id;
  const userIdStr = userId.toString();
  console.log(
    `Found: ${user.fullName || user.username || "—"} | phone: ${user.phone || "—"} | id: ${userIdStr}`,
  );
  console.log("---");

  const stringIdCollections = ["wallets", "wallettxns", "kycsubmissions", "formreminderlogs"];
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

  for (const col of stringIdCollections) {
    try {
      const result = await db.collection(col).deleteMany({ userId: userIdStr });
      if (result.deletedCount) console.log(`  ${col}: ${result.deletedCount}`);
      totalDeleted += result.deletedCount;
    } catch (e: unknown) {
      console.log(`  ${col}: error - ${e instanceof Error ? e.message : e}`);
    }
  }

  for (const col of flexIdCollections) {
    try {
      const r1 = await db.collection(col).deleteMany({ userId: userIdStr });
      const r2 = await db.collection(col).deleteMany({ userId });
      const count = r1.deletedCount + r2.deletedCount;
      if (count) console.log(`  ${col}: ${count}`);
      totalDeleted += count;
    } catch (e: unknown) {
      console.log(`  ${col}: error - ${e instanceof Error ? e.message : e}`);
    }
  }

  try {
    const r = await db.collection("auditlogs").deleteMany({
      $or: [{ userId: userIdStr }, { userId }, { actorId: userIdStr }, { actorId: userId }],
    });
    if (r.deletedCount) console.log(`  auditlogs: ${r.deletedCount}`);
    totalDeleted += r.deletedCount;
  } catch {
    /* optional */
  }

  const userDel = await db.collection("users").deleteOne({ _id: userId });
  console.log(`  users: ${userDel.deletedCount}`);
  totalDeleted += userDel.deletedCount;

  console.log("---");
  console.log(`Total records deleted: ${totalDeleted}`);
  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
