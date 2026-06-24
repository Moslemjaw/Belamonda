require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Get one document and check userId type
    const sample = await db.collection('useroffers').findOne({});
    console.log("Sample userOffer:");
    console.log("  userId:", sample.userId);
    console.log("  userId type:", typeof sample.userId);
    console.log("  userId constructor:", sample.userId?.constructor?.name);
    console.log("  offerId:", sample.offerId);
    console.log("  offerId type:", typeof sample.offerId);
    console.log("  offerId constructor:", sample.offerId?.constructor?.name);
    
    // Try with ObjectId
    const oid = new mongoose.Types.ObjectId('6a2a6e55aae09ee0efb02433');
    const resultOid = await db.collection('useroffers').find({ userId: oid }).toArray();
    console.log(`\nQuery with ObjectId: ${resultOid.length} results`);
    
    // Try with string
    const resultStr = await db.collection('useroffers').find({ userId: '6a2a6e55aae09ee0efb02433' }).toArray();
    console.log(`Query with String: ${resultStr.length} results`);
    
    // Check what the user's actual _id looks like
    const user = await db.collection('users').findOne({ phone: '51172566' });
    if (user) {
      console.log(`\nUser found: ${user.fullName}`);
      console.log("  _id:", user._id);
      console.log("  _id type:", typeof user._id);
      console.log("  _id constructor:", user._id?.constructor?.name);
      console.log("  _id toString:", user._id.toString());
    }
    
    // Find the specific useroffers for nermeen
    const nermeenUOs = await db.collection('useroffers').find({ _id: new mongoose.Types.ObjectId('6a2a6e55aae09ee0efb02433') }).toArray();
    console.log(`\nQuery by _id (nermeen): ${nermeenUOs.length} results`);
    if (nermeenUOs[0]) {
      console.log("  userId:", nermeenUOs[0].userId);
      console.log("  userId toString:", nermeenUOs[0].userId?.toString());
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
