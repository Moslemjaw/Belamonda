import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  const db = mongoose.connection;
  const promos = db.collection('promotions');

  const p = await promos.findOne({ slug: 'saray' });
  if (p) {
    console.log("Found:", p.slug);
    console.log("imageUrl starts with:", p.imageUrl ? p.imageUrl.substring(0, 50) : "undefined");
    console.log("imageUrl length:", p.imageUrl ? p.imageUrl.length : 0);
  } else {
    console.log("Not found");
  }
  process.exit(0);
}

run().catch(console.error);
