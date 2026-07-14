import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const users = db.collection('users');
  const bookingRequests = db.collection('bookingrequests');
  const bookingSessions = db.collection('bookingsessions');

  const user = await users.findOne({ fullName: { $regex: 'نور طارق', $options: 'i' } });
  if (!user) {
    console.log("User not found.");
    process.exit(1);
  }

  console.log(`User: ${user.fullName} (${user.phone}), ID: ${user._id}`);

  const reqs = await bookingRequests.find({ userId: user._id.toString() }).sort({ createdAt: -1 }).toArray();
  console.log(`\nFound ${reqs.length} BookingRequests:`);
  for (const r of reqs) {
    console.log(`- Request ID: ${r._id} | Status: ${r.status} | UserOfferID: ${r.userOfferId} | Date: ${r.proposedAt || r.preferredAt}`);
  }

  const sessions = await bookingSessions.find({ userId: user._id.toString() }).sort({ scheduledAt: -1 }).toArray();
  console.log(`\nFound ${sessions.length} BookingSessions:`);
  for (const s of sessions) {
    console.log(`- Session ID: ${s._id} | Status: ${s.status} | UserOfferID: ${s.userOfferId} | Date: ${s.scheduledAt}`);
  }

  process.exit(0);
}

run().catch(console.error);
