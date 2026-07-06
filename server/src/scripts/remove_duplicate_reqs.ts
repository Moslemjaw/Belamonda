import mongoose from "mongoose";
import { BookingRequestModel } from "../models/bookingRequest.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { connectMongo } from "../db/mongo.js";

async function run() {
  await connectMongo();
  
  // Find all scheduled requests
  const requests = await BookingRequestModel.find({ status: "scheduled" }).sort({ createdAt: 1 });
  
  console.log(`Found ${requests.length} scheduled requests.`);
  for (const req of requests) {
    console.log(`ID: ${req._id}, User: ${req.userId}, isStandalone: ${req.isStandalone}, standaloneName: ${req.standaloneName}, userOfferId: ${req.userOfferId}`);
  }
  process.exit(0);
}

run().catch(console.error);
