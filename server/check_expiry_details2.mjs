import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const useroffers = db.collection('useroffers');
  const payments = db.collection('payments');

  const uo = await useroffers.findOne({ _id: new mongoose.Types.ObjectId('6a51732b7c4e7a51afb7cce2') });
  
  if (uo) {
    console.log("UserOffer Status:", uo.status);
    console.log("Purchase Mode:", uo.purchaseMode);
    console.log("Created At:", uo.createdAt);
    console.log("Activated At:", uo.activatedAt);
    console.log("Expires At:", uo.expiresAt);
    console.log("Payment Confirmed At:", uo.paymentConfirmedAt);
    console.log("Payment Method:", uo.paymentMethod);
    console.log("Payment ID:", uo.paymentId);
    console.log("Deposit Payment ID:", uo.depositPaymentId);
    
    const p = await payments.find({ userOfferId: uo._id.toString() }).toArray();
    console.log(`\nFound ${p.length} payments associated:`);
    for (const payment of p) {
      console.log(`- Payment ID: ${payment._id} | Status: ${payment.status} | Amount: ${payment.amountKwd}`);
    }
  }

  process.exit(0);
}

run().catch(console.error);
