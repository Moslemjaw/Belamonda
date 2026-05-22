import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { BookingRequestModel } from "./server/src/models/bookingRequest.model.js";
import { BookingSessionModel } from "./server/src/models/bookingSession.model.js";

dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected");

  const reqs = await BookingRequestModel.find().sort({ createdAt: -1 }).limit(5);
  console.log("Latest Booking Requests:");
  reqs.forEach(r => {
    console.log(`- ${r._id}: standaloneName=${r.standaloneName}, isStandalone=${r.isStandalone}, offerId=${r.offerId}, notes=${r.notes}`);
  });

  const sess = await BookingSessionModel.find().sort({ createdAt: -1 }).limit(5);
  console.log("\nLatest Booking Sessions:");
  sess.forEach(s => {
    console.log(`- ${s._id}: offerId=${s.offerId}, notes=${s.notes}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
