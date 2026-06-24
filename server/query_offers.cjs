require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Find offers with signupCashbackKwd > 0
    const offers = await db.collection('offers').find({ signupCashbackKwd: { $ne: null } }).toArray();
    console.log("Offers with signupCashbackKwd:");
    for (const o of offers) {
      if (parseFloat(o.signupCashbackKwd) > 0) {
        console.log(`- ${o.name}: cashback=${o.signupCashbackKwd}, isCashbackOnly=${o.isCashbackOnly}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
