import mongoose from "mongoose";
import * as dotenv from "dotenv";
import fs from "fs";
import { BookingSessionModel } from "./models/bookingSession.model.js";

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda";
  await mongoose.connect(uri);
  
  console.log("Connected to MongoDB. Finding duplicates...");
  
  const duplicateSessions = await BookingSessionModel.aggregate([
    {
      $group: {
        _id: { userId: "$userId", scheduledAt: "$scheduledAt", status: "$status" },
        count: { $sum: 1 },
        ids: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);
  
  fs.writeFileSync("duplicate_sessions.json", JSON.stringify(duplicateSessions, null, 2));
  console.log(`Found ${duplicateSessions.length} groups of duplicate sessions. Saved to duplicate_sessions.json`);

  await mongoose.disconnect();
}

main().catch(console.error);
