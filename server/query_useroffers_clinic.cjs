require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Get all userOffers
    const userOffers = await db.collection('useroffers').find({}).toArray();
    console.log("Total userOffers in database:", userOffers.length);
    
    // Let's get all offers to check their clinicLocked status
    const offers = await db.collection('offers').find({}).toArray();
    const offerMap = {};
    for (const o of offers) {
      offerMap[String(o._id)] = o;
    }
    
    let countLocked = 0;
    let countUndefinedClinic = 0;
    for (const uo of userOffers) {
      const offer = offerMap[String(uo.offerId)];
      if (!offer) {
        // console.log(`No offer found for userOffer ${uo._id}`);
        continue;
      }
      
      if (offer.clinicLocked === true) {
        countLocked++;
        const clinicId = uo.clinicId;
        console.log(`UserOffer ID: ${uo._id} | User: ${uo.userId} | Offer: ${offer.name} | clinicId: ${clinicId} | status: ${uo.status}`);
        if (!clinicId) {
          countUndefinedClinic++;
        }
      }
    }
    console.log(`\nSummary:`);
    console.log(`Total clinicLocked userOffers: ${countLocked}`);
    console.log(`Total clinicLocked userOffers with undefined clinicId: ${countUndefinedClinic}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
