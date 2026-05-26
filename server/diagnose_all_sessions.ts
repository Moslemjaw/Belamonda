import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const userId = "6a14989e4b6ae706d27314c3";
  const allSessions = await mongoose.connection.collection("bookingsessions").find({ userId }).toArray();
  console.log("All Sessions for user:");
  console.log(allSessions.map((s: any) => ({ _id: s._id, uoId: s.userOfferId, status: s.status, date: s.scheduledAt })));

  process.exit(0);
}
main().catch(console.error);
