import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const users = db.collection('users');
  const useroffers = db.collection('useroffers');

  // Find user by name "انعام ارشيد"
  const user = await users.findOne({ fullName: { $regex: 'انعام ارشيد', $options: 'i' } });
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }

  console.log(`User: ${user.fullName} (${user.phone}), ID: ${user._id}`);

  // Get their offers
  const userOffers = await useroffers.find({ userId: user._id.toString() }).toArray();
  console.log(`Found ${userOffers.length} user offers.`);

  for (const uo of userOffers) {
    console.log(`\n- UserOffer ID: ${uo._id}`);
    console.log(`  Title: ${uo.offerSnapshot?.title || 'N/A'}`);
    console.log(`  Status: ${uo.status}`);
    console.log(`  Activated At: ${uo.activatedAt}`);
    console.log(`  Expires At: ${uo.expiresAt}`);
    console.log(`  Sessions Used: ${uo.sessionsUsed} / Total: ${uo.sessionsTotal}`);
    console.log(`  Offer snapshot rules:`, uo.offerSnapshot?.rules);
  }

  process.exit(0);
}

run().catch(console.error);
