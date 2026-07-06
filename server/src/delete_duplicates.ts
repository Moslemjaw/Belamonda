import mongoose from "mongoose";
import * as dotenv from "dotenv";
import fs from "fs";
import { BookingSessionModel } from "./models/bookingSession.model.js";

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda";
  await mongoose.connect(uri);
  
  const raw = fs.readFileSync("duplicate_sessions.json", "utf8");
  const duplicates = JSON.parse(raw);
  
  let deletedCount = 0;
  for (const group of duplicates) {
    const idsToDelete = group.ids.slice(1);
    for (const id of idsToDelete) {
      await BookingSessionModel.findByIdAndDelete(id);
      console.log(`Deleted duplicate session: ${id}`);
      deletedCount++;
    }
  }
  
  console.log(`Successfully deleted ${deletedCount} duplicate sessions.`);

  await mongoose.disconnect();
}

main().catch(console.error);
