require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const offers = await db.collection('offers').find({}).toArray();
    console.log("Total offers:", offers.length);
    for (const o of offers) {
      console.log(`Offer: ${o.name} (${o._id}) | clinicLocked: ${o.clinicLocked} | clinicTransferFeeKwd: ${o.clinicTransferFeeKwd} | active: ${o.active}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
