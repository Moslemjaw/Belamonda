import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingRequestModel } from "../models/bookingRequest.model.js";

dotenv.config();

async function checkReqs() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB.");

  const reqs = await BookingRequestModel.find({ status: { $in: ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted"] } });
  for (const r of reqs) {
    console.log(`ID: ${r._id}, user: ${r.userId}, status: ${r.status}, route: ${r.bookingRoute}, standalone: ${r.isStandalone}`);
  }
  
  process.exit(0);
}

checkReqs().catch(console.error);
