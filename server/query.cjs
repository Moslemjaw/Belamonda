const mongoose = require('mongoose');
const { UserOfferModel } = require('./dist/models/userOffer.model.js');
async function run() {
  await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/');
  const offers = await UserOfferModel.find({ status: { $in: ['pending_payment', 'active', 'reserved', 'enet_pending'] } }).lean();
  console.log(JSON.stringify(offers, null, 2));
  process.exit(0);
}
run();
