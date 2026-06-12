import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/belamonda?appName=ForAll";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const names = ['12345678', 'علي يوسف تقي الصفار', 'حماد عبداللطيف', 'حنين الطراروه'];
  const res = await users.find({ name: { $in: names } }).toArray();
  console.log(JSON.stringify(res.map(u => ({ id: u._id, name: u.name, phone: u.phone })), null, 2));
  process.exit(0);
}).catch(console.error);
