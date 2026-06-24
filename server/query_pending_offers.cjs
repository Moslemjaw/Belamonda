require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
    const db = mongoose.connection.db;

    const offers = await db.collection('useroffers').find({}).toArray();
    console.log(`Found ${offers.length} user offers in test database:`);
    for (const uo of offers) {
      const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(uo.userId) });
      const offer = await db.collection('offers').findOne({ _id: new mongoose.Types.ObjectId(uo.offerId) });
      console.log(`- ID: ${uo._id}`);
      console.log(`  User: ${user ? user.fullName : uo.userId} (Phone: ${user ? user.phone : 'N/A'})`);
      console.log(`  Offer: ${offer ? offer.name : uo.offerId}`);
      console.log(`  Purchase Mode: ${uo.purchaseMode}`);
      console.log(`  Payment Method: ${uo.paymentMethod}`);
      console.log(`  Payment Amount: ${uo.paymentAmountKwd}`);
      console.log(`  Membership Type: ${uo.membershipType}`);
      console.log(`  Group Invite Code: ${uo.groupInviteCode}`);
      console.log(`  Shared With: ${JSON.stringify(uo.sharedWith)}`);
      console.log(`  Status: ${uo.status}`);
      console.log(`  CreatedAt: ${uo.createdAt}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
