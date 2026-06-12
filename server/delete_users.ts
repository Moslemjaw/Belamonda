import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/belamonda?appName=ForAll";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const phones = ['345678', '55454558', '55754806', '99650243'];
  const res = await users.deleteMany({ phone: { $in: phones } });
  console.log('Deleted ' + res.deletedCount + ' users');
  process.exit(0);
}).catch(console.error);
