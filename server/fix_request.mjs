import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const bookingRequests = db.collection('bookingrequests');

  const req = await bookingRequests.findOne({ _id: new mongoose.Types.ObjectId('6a468b41cd6ae424d19ec49d') });
  if (req) {
    console.log("Request Status:", req.status);
    console.log("ScheduledSessionId:", req.scheduledSessionId);
    
    if (!req.scheduledSessionId) {
      // It wasn't linked properly! Let's update it to cancelled so she can book again.
      console.log("Fixing status to cancelled...");
      await bookingRequests.updateOne(
        { _id: req._id },
        { $set: { status: 'cancelled' } }
      );
      console.log("Done.");
    }
  }

  process.exit(0);
}

run().catch(console.error);
