import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const promos = db.collection('promotions');

  const p = await promos.findOne({ slug: 'belamondo-x-saray-perfumes' });
  console.log(p);

  process.exit(0);
}

run().catch(console.error);
