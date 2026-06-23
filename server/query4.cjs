const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/ForAll?retryWrites=true&w=majority');
  const db = mongoose.connection.db;
  const coll = db.collection('offers');
  const offer = await coll.findOne({ nameEn: 'Naumi Plus (Female)' });
  console.log(JSON.stringify(offer, null, 2));
  process.exit(0);
}

run();
