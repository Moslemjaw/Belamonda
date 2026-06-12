import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const res = await users.deleteMany({ phone: { $in: ['345678', '55454558', '55754806', '99650243'] } });
  console.log('Deleted ' + res.deletedCount + ' users');
  process.exit(0);
}).catch(console.error);
