import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import { BookingSessionModel } from "./src/models/bookingSession.model.js";
import { BookingRequestModel } from "./src/models/bookingRequest.model.js";

async function check() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(uri);
  const sessions = await BookingSessionModel.find({ bookingRequest: { $exists: false } }).lean();
  console.log("Sessions without bookingRequest: ", sessions.length);
  for (const s of sessions) {
     console.log(`ID: ${s._id}, Status: ${s.status}, Date: ${s.sessionDate}, Client: ${s.client}`);
  }
  process.exit(0);
}
check();
