require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const requests = await db.collection('bookingrequests').find({
      $or: [
        { shownAt: { $exists: true, $ne: null } },
        { status: 'completed' }
      ]
    }).toArray();

    console.log(`Found ${requests.length} requests with shownAt or status completed`);

    for (const r of requests) {
      // Find scan logs for this user & clinic
      const scans = await db.collection('scanlogs').find({
        userId: r.userId,
        clinicId: r.clinicId
      }).sort({ scannedAt: -1 }).toArray();

      if (scans.length > 0) {
        console.log(`Req ${r._id} (User: ${r.userId}): shownAt = ${r.shownAt}, scans count = ${scans.length}, latest scan = ${scans[0].scannedAt}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
