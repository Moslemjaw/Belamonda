import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const userId = '6a149c3a4b6ae706d27319e7';
  const uoId = '6a14a66c5e94c5d59a4ad24e';
  const totalCashback = 1500000;
  const paidInstallments = 1;
  const totalInstallments = 2;
  const perInstallment = Math.floor(totalCashback / totalInstallments);
  const remainder = totalCashback - perInstallment * totalInstallments;
  const firstAmount = perInstallment + remainder;

  console.log('First installment cashback (mils):', firstAmount);
  
  const fmtKwd = (m: number) => Math.floor(m/1000)+'.'+String(m%1000).padStart(3,'0');
  
  /* Step 1: credit locked pool with full amount */
  const wallet = await mongoose.connection.collection('wallets').findOneAndUpdate(
    { userId },
    { $set: { ceilingKwd: fmtKwd(totalCashback), lockedKwd: fmtKwd(totalCashback - firstAmount), unlockedKwd: fmtKwd(firstAmount) } },
    { returnDocument: 'after' }
  );
  console.log('Updated wallet:', JSON.stringify(wallet, null, 2));
  
  /* Create credit txn */
  await mongoose.connection.collection('wallettxns').insertOne({
    userId,
    type: 'offer_cashback_credit',
    amountKwd: fmtKwd(totalCashback),
    reference: { kind: 'userOffer', id: uoId },
    createdBy: { kind: 'system', id: 'data_fix' },
    reason: 'Offer cashback credited to wallet (data fix)',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  /* Create unlock txn */
  await mongoose.connection.collection('wallettxns').insertOne({
    userId,
    type: 'installment_unlock',
    amountKwd: fmtKwd(firstAmount),
    reference: { kind: 'userOffer', id: uoId+'_inst_1' },
    createdBy: { kind: 'system', id: 'data_fix' },
    reason: 'Cashback unlocked for installment 1 (data fix)',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log('Done!');
  await mongoose.disconnect();
}
main();
