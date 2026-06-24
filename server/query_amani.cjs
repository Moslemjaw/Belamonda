require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const users = await db.collection('users').find({
      $or: [
        { phone: { $regex: '50104408' } },
        { phone: '50104408' },
        { phone: '+96550104408' },
        { fullName: { $regex: 'أماني علي العجمي' } },
        { fullName: { $regex: 'اماني علي العجمي' } }
      ]
    }).toArray();
    
    console.log("Found users:", users.length);
    for (const u of users) {
      console.log(`${u.fullName} / ${u.phone} / _id: ${u._id}`);
      const uos = await db.collection('userOffers').find({ userId: u._id.toString() }).toArray();
      const uosObj = await db.collection('userOffers').find({ userId: u._id }).toArray();
      console.log(`  UserOffers(string): ${uos.length}, UserOffers(ObjectId): ${uosObj.length}`);
      for (const uo of uos.concat(uosObj)) {
        console.log(`   - ${uo._id}: offerId=${uo.offerId}, clinicId=${uo.clinicId}, status=${uo.status}, method=${uo.method}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
