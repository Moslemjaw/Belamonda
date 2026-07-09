import mongoose from "mongoose";
import { BookingSessionModel } from "./src/models/bookingSession.model.js";

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const missing = await BookingSessionModel.find({
    status: "Awaiting Session Payment",
    bookingRequestId: { $exists: false }
  });

  console.log(`Found ${missing.length} sessions awaiting payment but missing bookingRequestId.`);
  for (const session of missing) {
    console.log(`Session ID: ${session._id}, User: ${session.userId}`);
  }

  const allAwaiting = await BookingSessionModel.countDocuments({
    status: "Awaiting Session Payment"
  });
  console.log(`Total Awaiting Session Payment: ${allAwaiting}`);

  process.exit(0);
}

run().catch(console.error);
