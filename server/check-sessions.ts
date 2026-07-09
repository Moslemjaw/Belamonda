import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const sessions = await mongoose.connection.db.collection('bookingsessions').find({
    status: 'completed',
    clinicPaymentStatus: { $ne: 'paid' },
    requestId: { $exists: false }
  }).toArray();

  console.log("Sessions without requestId:", sessions.length);
  if (sessions.length > 0) {
    console.log(sessions.map(s => s._id));
  }

  process.exit(0);
}

run().catch(console.error);
