import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const userIds = [
  '6a2a5a831e05c85ea7152385',
  '6a293d93e978be541f848a24',
  '6a293a16e978be541f84896c',
  '6a12d1da7022845c74a0dc45',
  '6a293712e978be541f8487ed',
];

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const payments = db.collection('payments');

  // Find all remaining payments from these users
  const remaining = await payments.find({ userId: { $in: userIds } }).toArray();
  console.log('Remaining payments from deleted users:', remaining.length);
  for (const p of remaining) {
    console.log(`  ${p._id} | userId=${p.userId} | amount=${p.amountKwd} | status=${p.status}`);
  }

  // Also check all completed payments to see what makes up the 99
  const all = await payments.find({ status: 'completed' }).toArray();
  console.log('\nAll completed payments:');
  for (const p of all) {
    console.log(`  ${p._id} | userId=${p.userId} | amount=${p.amountKwd} | status=${p.status}`);
  }

  process.exit(0);
}).catch(console.error);
