require('dotenv').config();
const mongoose = require('mongoose');

// Define Model and Schema exactly as in the app
const UserOfferSchema = new mongoose.Schema({}, { strict: false, collection: 'useroffers' });
const UserOfferModel = mongoose.model('UserOffer', UserOfferSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
    
    // Test the exact mongoose query:
    const rows = await UserOfferModel.find({ 
      status: "pending_payment",
      paymentMethod: { $exists: true, $ne: null }
    }).lean();
    
    console.log(`Query returned ${rows.length} rows:`);
    for (const r of rows) {
      console.log(`- ID: ${r._id}, user: ${r.userId}, paymentMethod: ${r.paymentMethod}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
