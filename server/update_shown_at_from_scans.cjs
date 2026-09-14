require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const scans = await db.collection('scanlogs').find({
      status: 'attended'
    }).sort({ scannedAt: 1 }).toArray();

    console.log(`Found ${scans.length} attended scans.`);

    let updatedCount = 0;
    for (const scan of scans) {
      if (!scan.userId || !scan.scannedAt) continue;

      // Find matching request(s)
      const query = {
        userId: scan.userId,
        clinicId: scan.clinicId
      };
      if (scan.userOfferId) {
        query.userOfferId = scan.userOfferId;
      }

      const res = await db.collection('bookingrequests').updateMany(
        query,
        {
          $set: {
            shownAt: scan.scannedAt
          }
        }
      );

      if (res.modifiedCount > 0) {
        console.log(`Updated ${res.modifiedCount} requests for user ${scan.userId} with scannedAt ${scan.scannedAt}`);
        updatedCount += res.modifiedCount;
      }
    }

    console.log(`Total requests updated with actual scan date: ${updatedCount}`);

    // Verify Manal's request specifically
    const user = await db.collection('users').findOne({ phone: { $regex: '97858533' } });
    if (user) {
      const manalReq = await db.collection('bookingrequests').findOne({
        _id: new mongoose.Types.ObjectId('6a9438f4de987094a2f2f155')
      });
      console.log("Manal updated request shownAt:", manalReq ? manalReq.shownAt : "Not found");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
