import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const bookingRequests = db.collection('bookingrequests');

  const req = await bookingRequests.updateOne(
    { _id: new mongoose.Types.ObjectId('6a468b41cd6ae424d19ec49d') },
    { $set: { status: 'cancelled' } }
  );
  
  console.log("Updated:", req.modifiedCount);
  process.exit(0);
}

run().catch(console.error);
