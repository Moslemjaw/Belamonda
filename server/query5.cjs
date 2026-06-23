const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/ForAll?retryWrites=true&w=majority');
  const db = mongoose.connection.db;
  const coll = db.collection('offers');
  const offers = await coll.find({ nameEn: /Naumi/i }).toArray();
  console.log(JSON.stringify(offers.map(o => ({nameEn: o.nameEn, signupCashbackKwd: o.signupCashbackKwd})), null, 2));
  process.exit(0);
}

run();
