import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { UserModel } from './models/user.model.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB');

  const users = await UserModel.find({ phone: { $in: ['905318501175', '97270771'] } }).lean();
  
  const userIds = users.map(u => String(u._id));
  
  if (userIds.length > 0) {
    const res1 = await mongoose.connection.db?.collection('walletledgers').deleteMany({ userId: { $in: userIds } });
    console.log('Deleted WalletLedger entries:', res1?.deletedCount);
    
    const res2 = await mongoose.connection.db?.collection('kycs').updateMany({ userId: { $in: userIds } }, { $set: { walletLockedKwd: '0.000', walletUnlockedKwd: '0.000' } });
    console.log('Reset Wallet balances:', res2?.modifiedCount);
  } else {
    console.log('No users found.');
  }

  await mongoose.disconnect();
}
run().catch(console.error);
