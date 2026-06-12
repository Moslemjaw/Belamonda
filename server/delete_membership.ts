import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db!;
  const userOffers = db.collection('useroffers');
  const users = db.collection('users');

  // Find نورهان الشريف
  const user = await users.findOne({ fullName: /نورهان الشريف/ });
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }

  console.log(`Found user: ${user.fullName} (Phone: ${user.phone}, ID: ${user._id})`);

  const uos = await userOffers.find({
    $or: [
      { userId: String(user._id) },
      { userId: user._id }
    ]
  }).toArray();

  console.log(`Found ${uos.length} user offers:`);
  for (const uo of uos) {
    console.log(`  - ${uo._id} | status: ${uo.status}`);
    await userOffers.deleteOne({ _id: uo._id });
    console.log(`    ✅ Deleted`);
  }

  // Also clean up any related payments
  const payments = db.collection('payments');
  const pResult = await payments.deleteMany({
    $or: [
      { userId: String(user._id) },
      { userId: user._id }
    ]
  });
  console.log(`Deleted ${pResult.deletedCount} related payments.`);

  // Clean up wallet transactions related to her useroffers
  const walletTxns = db.collection('wallettxns');
  const wtResult = await walletTxns.deleteMany({ userId: String(user._id) });
  console.log(`Deleted ${wtResult.deletedCount} wallet transactions.`);

  // Reset wallet to 0
  const wallets = db.collection('wallets');
  await wallets.updateOne({ userId: String(user._id) }, {
    $set: { ceilingKwd: "0.000", lockedKwd: "0.000", unlockedKwd: "0.000" }
  });
  console.log("Reset wallet to 0.000.");

  console.log("\nDone!");
  process.exit(0);
}).catch(console.error);
