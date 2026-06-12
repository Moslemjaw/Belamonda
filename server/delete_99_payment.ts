import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const payments = db.collection('payments');
  const useroffers = db.collection('useroffers');
  
  const p = await payments.findOne({ _id: new mongoose.Types.ObjectId('6a29389ae978be541f8488bb') });
  console.log(p);
  
  if (p) {
    await payments.deleteOne({ _id: p._id });
    console.log('Deleted payment!');
    
    if (p.userOfferId) {
       await useroffers.deleteOne({ _id: p.userOfferId });
       console.log('Deleted associated useroffer!');
    }
  }

  process.exit(0);
}).catch(console.error);
