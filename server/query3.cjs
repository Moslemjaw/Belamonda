const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/ForAll?retryWrites=true&w=majority');
  const db = mongoose.connection.db;
  const coll = db.collection('offers');
  const offer = await coll.findOne({ 'nameEn': /Naumi Plus/i });
  console.log('Offer:');
  console.log(JSON.stringify(offer, null, 2));

  if (offer) {
    const uoColl = db.collection('useroffers');
    const uo = await uoColl.findOne({ 'offerId': offer._id });
    console.log('\nUser Offer:');
    console.log(JSON.stringify(uo, null, 2));
  }
  process.exit(0);
}

run();
