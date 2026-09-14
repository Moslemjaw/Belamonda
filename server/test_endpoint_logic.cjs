require('dotenv').config();
const mongoose = require('mongoose');

async function testEndpointLogic() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const fromIso = new Date(2026, 6, 1, 0, 0, 0, 0).toISOString();
    const toIso = new Date(2026, 6, 31, 23, 59, 59, 999).toISOString();

    const sessionQuery = {
      $and: [
        { notes: { $ne: "Historical session logged during enrollment" } },
        { scheduledAt: { $gte: new Date("2026-07-01T00:00:00Z") } }
      ]
    };

    const dateFilter = {
      $gte: new Date(fromIso),
      $lte: new Date(toIso)
    };

    const userFrom = dateFilter.$gte.getTime();
    const baseFrom = sessionQuery.$and[1].scheduledAt.$gte.getTime();
    sessionQuery.$and[1].scheduledAt.$gte = new Date(Math.max(userFrom, baseFrom));
    sessionQuery.$and[1].scheduledAt.$lte = dateFilter.$lte;

    const sessionDocs = await db.collection('bookingsessions')
      .find(sessionQuery)
      .sort({ scheduledAt: -1 })
      .limit(300)
      .toArray();

    console.log(`Fetched ${sessionDocs.length} sessionDocs`);

    const userIds = sessionDocs.map(s => s.userId).filter(Boolean);
    const users = await db.collection('users').find({
      _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).toArray();

    const userMap = new Map(users.map(u => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));

    const ashwaqSession = sessionDocs.find(s => {
      const uInfo = userMap.get(s.userId);
      return uInfo && uInfo.fullName && uInfo.fullName.includes("اشواق");
    });

    console.log("Ashwaq session found in backend results:", ashwaqSession ? JSON.stringify(ashwaqSession, null, 2) : "NOT FOUND!");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

testEndpointLogic();
