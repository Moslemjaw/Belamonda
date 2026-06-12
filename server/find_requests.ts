import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const useroffers = db.collection('useroffers');
  const payments = db.collection('payments');
  const enet_requests = db.collection('enet_requests'); // just guessing
  
  // Find across collections
  const ids = ['4c71b80b', '4c71b80c'];
  
  for (const id of ids) {
    console.log(`Searching for ${id}...`);
    // maybe ends with
    const query = { _id: { $regex: id + '$' } };
    
    // Check if _id is ObjectId or string. In MongoDB, regex on ObjectId doesn't work directly if it's an ObjectId.
    // Instead we can fetch and filter, or just use string matches on other fields.
  }
  
  const allUserOffers = await useroffers.find({ status: { $regex: /pending/i } }).limit(20).toArray();
  const matched = allUserOffers.filter(uo => uo._id.toString().endsWith('4c71b80b') || uo._id.toString().endsWith('4c71b80c'));
  
  console.log('Matched useroffers:', JSON.stringify(matched, null, 2));

  process.exit(0);
}).catch(console.error);
