require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const user = await db.collection('users').findOne({ phone: { $regex: '51227057' } });
    console.log("USER:", JSON.stringify(user, null, 2));

    const userIdStr = user._id.toString();

    // Check sessions
    const sessions = await db.collection('bookingsessions').find({
      $or: [
        { userId: userIdStr },
        { userId: user._id }
      ]
    }).toArray();
    console.log("SESSIONS:", JSON.stringify(sessions, null, 2));

    // Check booking requests
    const requests = await db.collection('bookingrequests').find({
      $or: [
        { userId: userIdStr },
        { userId: user._id }
      ]
    }).toArray();
    console.log("REQUESTS:", JSON.stringify(requests, null, 2));

    // Check audit logs related to this user or session
    const auditLogs = await db.collection('auditlogs').find({
      $or: [
        { targetId: userIdStr },
        { "details.userId": userIdStr },
        { "details.sessionId": { $in: sessions.map(s => s._id.toString()) } },
        { "details.requestId": { $in: requests.map(r => r._id.toString()) } }
      ]
    }).toArray();
    console.log("AUDIT LOGS:", JSON.stringify(auditLogs, null, 2));

    // Look up who cancelled / marked the session or request
    for (const s of sessions) {
      if (s.markedBy) {
        let mUser = null;
        if (mongoose.Types.ObjectId.isValid(s.markedBy)) {
          mUser = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(s.markedBy) });
        }
        console.log(`Session ${s.shortId || s._id} markedBy:`, s.markedBy, mUser ? `${mUser.fullName} (${mUser.role})` : 'Unknown');
      }
      if (s.scheduledBy) {
        let sUser = null;
        if (mongoose.Types.ObjectId.isValid(s.scheduledBy)) {
          sUser = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(s.scheduledBy) });
        }
        console.log(`Session ${s.shortId || s._id} scheduledBy:`, s.scheduledBy, sUser ? `${sUser.fullName} (${sUser.role})` : 'Unknown');
      }
    }

    for (const r of requests) {
      if (r.rejectedBy) {
        let rUser = null;
        if (mongoose.Types.ObjectId.isValid(r.rejectedBy)) {
          rUser = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(r.rejectedBy) });
        }
        console.log(`Request ${r._id} rejectedBy:`, r.rejectedBy, rUser ? `${rUser.fullName} (${rUser.role})` : 'Unknown');
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
