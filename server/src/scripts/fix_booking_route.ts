import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingRequestModel } from "../models/bookingRequest.model.js";

dotenv.config();

async function fixRoutes() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB.");

  // Revert all membership bookings back to "cs" route
  const res = await BookingRequestModel.updateMany(
    { isStandalone: false, bookingRoute: "clinic" },
    { $set: { bookingRoute: "cs" } }
  );

  console.log(`Reverted ${res.modifiedCount} membership bookings back to 'cs' route.`);

  // Also list all open booking requests for verification
  const open = await BookingRequestModel.find({
    status: { $in: ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted"] }
  });
  for (const r of open) {
    console.log(`  ID: ${r._id}, status: ${r.status}, route: ${r.bookingRoute}, standalone: ${r.isStandalone}`);
  }

  process.exit(0);
}

fixRoutes().catch(console.error);
