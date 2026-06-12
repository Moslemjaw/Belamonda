import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

const dbUri = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll";

async function fixInstallments() {
  await mongoose.connect(dbUri);
  console.log('Connected to DB');

  const db = mongoose.connection.db;

  // Find offers
  const userOffers = await db.collection('useroffers').find().toArray();
  
  console.log('Found total user offers:', userOffers.length);

  const offerId = new mongoose.Types.ObjectId('6a2c356764a33115fa677b65');
  
  const offer = await db.collection('useroffers').findOne({ _id: offerId });
  if (!offer) {
    console.log('Offer not found!');
    process.exit(1);
  }
  
  console.log('Found offer, fixing installments 2, 3, 4 to 35.000 KWD...');
  
  const schedule = [...offer.installmentSchedule];
  // Fix installments 2, 3, 4 (index 1, 2, 3)
  for (let i = 1; i <= 3; i++) {
    if (schedule[i]) {
      schedule[i].amountKwd = "35.000";
    }
  }
  
  await db.collection('useroffers').updateOne(
    { _id: offerId },
    { $set: { installmentSchedule: schedule } }
  );
  
  console.log('Done! Updated installment schedule:', JSON.stringify(schedule));
  process.exit(0);
}

fixInstallments().catch(console.error);
