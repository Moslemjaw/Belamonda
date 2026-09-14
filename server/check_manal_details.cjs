require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const user = await db.collection('users').findOne({ phone: { $regex: '97858533' } });
    console.log("USER:", user ? { _id: user._id, fullName: user.fullName, phone: user.phone } : "Not found");

    if (!user) return;
    const userIdStr = user._id.toString();

    const requests = await db.collection('bookingrequests').find({
      $or: [{ userId: userIdStr }, { userId: user._id }]
    }).toArray();
    console.log("REQUESTS:", JSON.stringify(requests, null, 2));

    const sessions = await db.collection('bookingsessions').find({
      $or: [{ userId: userIdStr }, { userId: user._id }]
    }).toArray();
    console.log("SESSIONS:", JSON.stringify(sessions, null, 2));

    const scans = await db.collection('scanlogs').find({
      $or: [{ userId: userIdStr }, { userId: user._id }]
    }).toArray();
    console.log("SCANS:", JSON.stringify(scans, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
