import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const useroffers = db.collection('useroffers');
  
  const ids = [
    new mongoose.Types.ObjectId('6a2a588f02818d114c71b80b'),
    new mongoose.Types.ObjectId('6a2a58ae02818d114c71b80c'),
  ];
  
  const res = await useroffers.deleteMany({ _id: { $in: ids } });
  console.log('Deleted ' + res.deletedCount + ' pending payment requests');
  process.exit(0);
}).catch(console.error);
