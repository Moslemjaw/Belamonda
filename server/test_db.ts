import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll');

const id = '6a158db171fdeab853058a60';

const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();

for (const c of collections) {
  const collection = db.collection(c.name);
  const doc = await collection.findOne({ $or: [{ _id: new mongoose.Types.ObjectId(id) }, { _id: id }, { userId: id }] });
  if (doc) {
    console.log(`Found in collection: ${c.name}`);
    console.log(doc);
  }
}

process.exit(0);
