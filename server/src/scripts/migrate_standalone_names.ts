import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { BookingRequestModel } from "../models/bookingRequest.model.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected");

  const reqs = await BookingRequestModel.find({ 
    standaloneName: { $exists: false },
    notes: { $exists: true, $ne: "" },
    isStandalone: false
  });

  console.log(`Found ${reqs.length} requests to fix.`);
  
  for (const r of reqs) {
    if (r.notes && r.notes.length < 50 && !r.notes.includes("Migrated")) { // Probably a treatment name
      r.standaloneName = r.notes;
      await r.save();
      console.log(`Updated request ${r._id} with standaloneName = ${r.notes}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
