import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const res = await users.find({ phone: { $regex: /345678|55454558|55754806|99650243/ } }).toArray();
  console.log(JSON.stringify(res.map(u => ({ id: u._id, name: u.name, phone: u.phone })), null, 2));
  process.exit(0);
}).catch(console.error);
