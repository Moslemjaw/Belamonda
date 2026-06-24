require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Check a specific user who has a clinicLocked offer WITH a clinic set
    const userId = '6a2a6e55aae09ee0efb02433'; // nermeen - Naumi Plus, clinicId set
    
    // Direct collection query
    const directResult = await db.collection('useroffers').find({ userId }).toArray();
    console.log(`=== Direct query (useroffers collection, userId="${userId}"): ${directResult.length} ===`);
    for (const uo of directResult) {
      console.log(`  ${uo._id}: status=${uo.status}, clinicId=${uo.clinicId}, offerId=${uo.offerId}`);
    }
    
    // Now check what Mongoose model returns
    // First define the schema
    const UserOfferSchema = new mongoose.Schema({
      userId: String,
      offerId: mongoose.Schema.Types.ObjectId,
      clinicId: mongoose.Schema.Types.ObjectId,
      status: String,
    });
    
    const UserOfferModel = mongoose.models.UserOffer || mongoose.model('UserOffer', UserOfferSchema);
    
    const mongooseResult = await UserOfferModel.find({ userId }).lean();
    console.log(`\n=== Mongoose query (UserOfferModel, userId="${userId}"): ${mongooseResult.length} ===`);
    for (const uo of mongooseResult) {
      console.log(`  ${uo._id}: status=${uo.status}, clinicId=${uo.clinicId}, offerId=${uo.offerId}`);
    }
    
    // Check what collection name Mongoose resolves to
    console.log(`\n=== Mongoose collection name: ${UserOfferModel.collection.name} ===`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
