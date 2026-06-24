require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Query the actual collection directly  
    const allUOs = await db.collection('useroffers').find({}).limit(5).toArray();
    console.log(`=== useroffers collection: ${allUOs.length} (showing first 5) ===`);
    for (const uo of allUOs) {
      console.log(`  ${uo._id}: userId=${uo.userId}, offerId=${uo.offerId}, clinicId=${uo.clinicId}, status=${uo.status}`);
    }
    
    // Count by status
    const statusCounts = await db.collection('useroffers').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    console.log("\n=== Status counts ===");
    for (const s of statusCounts) {
      console.log(`  ${s._id}: ${s.count}`);
    }

    // Find locked offers
    const lockedOffers = await db.collection('offers').find({ clinicLocked: true }).toArray();
    const lockedOfferIds = lockedOffers.map(o => o._id);
    
    // Find useroffers for locked offers
    const lockedUOs = await db.collection('useroffers').find({
      offerId: { $in: lockedOfferIds },
      status: 'active'
    }).toArray();
    
    console.log(`\n=== Active useroffers for clinicLocked offers (${lockedUOs.length}) ===`);
    for (const uo of lockedUOs) {
      const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(uo.userId) });
      const offer = lockedOffers.find(o => o._id.toString() === uo.offerId.toString());
      console.log(`  UO: ${uo._id}, status: ${uo.status}, clinicId: ${uo.clinicId}`);
      console.log(`    User: ${user?.fullName || user?.username || 'N/A'} / phone: ${user?.phone || 'N/A'}`);
      console.log(`    Offer: ${offer?.name || uo.offerId}`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
