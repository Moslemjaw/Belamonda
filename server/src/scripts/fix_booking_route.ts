import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingRequestModel } from "../models/bookingRequest.model.js";

dotenv.config();

async function fixRoutes() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB.");

  const res = await BookingRequestModel.updateMany(
    { isStandalone: false, bookingRoute: "cs" },
    { $set: { bookingRoute: "clinic" } }
  );

  console.log(`Updated ${res.modifiedCount} membership bookings to 'clinic' route.`);
  process.exit(0);
}

fixRoutes().catch(console.error);
