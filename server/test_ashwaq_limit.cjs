require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const fromDate = new Date("2026-06-30T21:00:00.000Z");
    const toDate = new Date("2026-07-31T20:59:59.999Z");

    const sessionQuery = {
      $and: [
        { notes: { $ne: "Historical session logged during enrollment" } },
        { scheduledAt: { $gte: new Date("2026-07-01T00:00:00Z"), $lte: toDate } }
      ]
    };

    const count = await db.collection('bookingsessions').countDocuments(sessionQuery);
    console.log(`Total sessions in July range: ${count}`);

    const sessions = await db.collection('bookingsessions')
      .find(sessionQuery)
      .sort({ scheduledAt: -1 })
      .toArray();

    const ashwaqIndex = sessions.findIndex(s => s.shortId === 's0004142');
    console.log(`Index of Ashwaq session s0004142 in sorted sessions (0-indexed): ${ashwaqIndex}`);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
