import "dotenv/config";
import mongoose from 'mongoose';
import {BookingSessionModel} from './src/models/bookingSession.model.js';
async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(mongoUri);
  const missing = await BookingSessionModel.find({ requestId: { $exists: false } });
  console.log('Count missing requestId:', missing.length);
  const present = await BookingSessionModel.find({ requestId: { $exists: true } });
  console.log('Count with requestId:', present.length);
  process.exit(0);
}
run();
