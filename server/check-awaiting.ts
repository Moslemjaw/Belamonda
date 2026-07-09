import mongoose from "mongoose";
import { BookingSessionModel } from "./src/models/bookingSession.model.js";

async function run() {
  require("dotenv").config();
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const sessions = await BookingSessionModel.find({
    status: "AWAITING_CLINIC_SESSION_PAYMENT",
    $or: [{ bookingRequestId: { $exists: false } }, { bookingRequestId: null }]
  }).lean();

  console.log(`Found ${sessions.length} sessions awaiting payment without bookingRequestId`);
  
  const allAwaiting = await BookingSessionModel.find({
    status: "AWAITING_CLINIC_SESSION_PAYMENT"
  }).lean();
  
  console.log(`Total awaiting sessions: ${allAwaiting.length}`);
  console.log(`Awaiting without bookingRequestId: ${allAwaiting.filter(s => !s.bookingRequestId).length}`);
  console.log(`Awaiting with bookingRequestId: ${allAwaiting.filter(s => s.bookingRequestId).length}`);

  process.exit(0);
}

run().catch(console.error);
