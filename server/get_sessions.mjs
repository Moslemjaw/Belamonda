import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const users = db.collection('users');
  const bookingSessions = db.collection('bookingsessions');

  const user = await users.findOne({ fullName: { $regex: 'انعام ارشيد', $options: 'i' } });
  if (!user) {
    console.log("User not found.");
    process.exit(1);
  }

  console.log(`User: ${user.fullName} (${user.phone}), ID: ${user._id}`);

  const sessions = await bookingSessions.find({ userId: user._id.toString() }).sort({ scheduledAt: 1 }).toArray();
  
  if (sessions.length === 0) {
    console.log("No sessions found for this user.");
  } else {
    console.log(`\nFound ${sessions.length} sessions:`);
    for (const s of sessions) {
      console.log(`- Session ID: ${s._id} | Status: ${s.status} | Scheduled At: ${s.scheduledAt} | Completed At: ${s.completedAt || 'N/A'}`);
    }
  }

  process.exit(0);
}

run().catch(console.error);
