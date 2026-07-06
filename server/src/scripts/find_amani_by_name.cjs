require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Find the user by name "اماني ابراهيم"
    const users = await db.collection('users').find({
      fullName: { $regex: /اماني ابراهيم/i }
    }).toArray();
    
    console.log(`Found ${users.length} users with name 'اماني ابراهيم'`);
    
    for (const user of users) {
      console.log(`\nName: ${user.fullName}`);
      console.log(`Phone: ${user.phone}`);
      console.log(`ID: ${user._id}`);
      
      const userId = user._id.toString();
      
      const breqs = await db.collection('bookingrequests').find({ userId: userId }).toArray();
      console.log(`--- Booking Requests (${breqs.length}) ---`);
      for (const br of breqs) {
        console.log(`BR ID: ${br._id} | status: ${br.status} | payment: ${br.clinicPaymentStatus} | session: ${br.scheduledSessionId}`);
      }
      
      const sessions = await db.collection('bookingsessions').find({ userId: userId }).toArray();
      console.log(`--- Booking Sessions (${sessions.length}) ---`);
      for (const s of sessions) {
        console.log(`Session ID: ${s._id} | status: ${s.status} | scheduledAt: ${s.scheduledAt}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
