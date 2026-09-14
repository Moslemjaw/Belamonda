require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Remove shownAt from any request that is not completed or checked_in or in_progress
    const res = await db.collection('bookingrequests').updateMany(
      {
        status: { $in: ['cancelled', 'rejected', 'request_received', 'open', 'slot_assigned', 'no_show'] },
        shownAt: { $exists: true, $ne: null }
      },
      {
        $unset: { shownAt: "" }
      }
    );

    console.log(`Unset shownAt on ${res.modifiedCount} non-completed/non-attended requests.`);

    // Verify Manal's requests specifically
    const user = await db.collection('users').findOne({ phone: { $regex: '97858533' } });
    if (user) {
      const requests = await db.collection('bookingrequests').find({
        $or: [{ userId: user._id.toString() }, { userId: user._id }]
      }).toArray();
      for (const r of requests) {
        console.log(`Req ${r._id} (status: ${r.status}, createdAt: ${r.createdAt}) -> shownAt:`, r.shownAt);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
