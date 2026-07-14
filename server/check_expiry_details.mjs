import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const useroffers = db.collection('useroffers');
  const offers = db.collection('offers');
  const auditlogs = db.collection('auditlogs');

  const uo = await useroffers.findOne({ _id: new mongoose.Types.ObjectId('6a51732b7c4e7a51afb7cce2') });
  
  if (uo) {
    console.log("UserOffer Status:", uo.status);
    console.log("Offer ID:", uo.offerId);
    
    if (uo.offerId) {
      const offer = await offers.findOne({ _id: uo.offerId });
      console.log("Underlying Offer Name:", offer?.name);
      console.log("Underlying Offer Rules:", offer?.rules);
    }

    // Check if there are any audit logs for this userOffer
    const logs = await auditlogs.find({ entityId: uo._id.toString() }).sort({ createdAt: -1 }).toArray();
    console.log(`\nFound ${logs.length} audit logs for this UserOffer:`);
    for (const log of logs) {
      console.log(`- Action: ${log.action} | By: ${log.actorName} | Date: ${log.createdAt}`);
      console.log(`  Details:`, log.details);
    }
  }

  process.exit(0);
}

run().catch(console.error);
