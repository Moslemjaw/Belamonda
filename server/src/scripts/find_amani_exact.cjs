require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Find the user by phone number
    const user = await db.collection('users').findOne({ phone: { $regex: '60655533' } });
    if (!user) {
      console.log("User not found with phone 60655533");
      return;
    }
    console.log("Found User:");
    console.log(`Name: ${user.fullName}`);
    console.log(`Phone: ${user.phone}`);
    console.log(`ID: ${user._id}`);
    
    const userId = user._id.toString();
    
    // Find BookingRequests
    const breqs = await db.collection('bookingrequests').find({ userId: userId }).toArray();
    console.log(`\n--- Booking Requests (${breqs.length}) ---`);
    for (const br of breqs) {
      console.log(`BR ID: ${br._id}`);
      console.log(`  status: ${br.status}`);
      console.log(`  clinicPaymentStatus: ${br.clinicPaymentStatus}`);
      console.log(`  scheduledSessionId: ${br.scheduledSessionId}`);
      console.log(`  createdAt: ${br.createdAt}`);
      console.log(`  updatedAt: ${br.updatedAt}`);
    }
    
    // Find BookingSessions
    const sessions = await db.collection('bookingsessions').find({ userId: userId }).toArray();
    console.log(`\n--- Booking Sessions (${sessions.length}) ---`);
    for (const s of sessions) {
      console.log(`Session ID: ${s._id}`);
      console.log(`  status: ${s.status}`);
      console.log(`  scheduledAt: ${s.scheduledAt}`);
      console.log(`  completedAt: ${s.completedAt}`);
      console.log(`  createdAt: ${s.createdAt}`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
