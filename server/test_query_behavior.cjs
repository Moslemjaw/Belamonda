require('dotenv').config();
const mongoose = require('mongoose');

const UserOfferSchema = new mongoose.Schema({}, { strict: false, collection: 'useroffers' });
const UserOfferModel = mongoose.model('UserOffer', UserOfferSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
    
    // Create a temporary test document
    const testDoc = await UserOfferModel.create({
      userId: "test_temp_user",
      offerId: new mongoose.Types.ObjectId(),
      status: "pending_payment",
      paymentMethod: undefined // missing field
    });
    console.log("Created test document with ID:", testDoc._id);

    // Try query 1: status "pending_payment"
    const q1 = await UserOfferModel.find({ _id: testDoc._id, status: "pending_payment" });
    console.log("Query 1 (status only) matches:", q1.length);

    // Try query 2: status "pending_payment" and paymentMethod exists and not null
    const q2 = await UserOfferModel.find({
      _id: testDoc._id,
      status: "pending_payment",
      paymentMethod: { $exists: true, $ne: null }
    });
    console.log("Query 2 ($exists + $ne: null) matches:", q2.length);

    // Try query 3: status "pending_payment" and paymentMethod is not null
    const q3 = await UserOfferModel.find({
      _id: testDoc._id,
      status: "pending_payment",
      paymentMethod: { $ne: null }
    });
    console.log("Query 3 ($ne: null only) matches:", q3.length);

    // Clean up
    await UserOfferModel.deleteOne({ _id: testDoc._id });
    console.log("Deleted test document.");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
