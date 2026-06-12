import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const userOffers = db.collection('useroffers');
  const offers = db.collection('offers');
  const users = db.collection('users');
  
  const allUserOffers = await userOffers.find({ isActive: true }).toArray();
  
  // Group by userId -> offerId
  const userOfferCounts: Record<string, Record<string, any[]>> = {};
  for (const uo of allUserOffers) {
    const uid = uo.userId.toString();
    const oid = uo.offerId.toString();
    
    if (!userOfferCounts[uid]) userOfferCounts[uid] = {};
    if (!userOfferCounts[uid][oid]) userOfferCounts[uid][oid] = [];
    
    userOfferCounts[uid][oid].push(uo);
  }
  
  for (const [uid, offersByOid] of Object.entries(userOfferCounts)) {
    for (const [oid, uos] of Object.entries(offersByOid)) {
      if (uos.length > 1) {
        const user = await users.findOne({ _id: new mongoose.Types.ObjectId(uid) });
        const offer = await offers.findOne({ _id: new mongoose.Types.ObjectId(oid) });
        console.log(`User ${user?.fullName || 'Unknown'} (Phone: ${user?.phone}, ID: ${uid}) has ${uos.length} active packages of '${offer?.titleEn || oid}'.`);
        
        for (let i = 0; i < uos.length; i++) {
          console.log(`  [${i}] useroffer ID: ${uos[i]._id}, Clinic: ${uos[i].assignedClinicId}`);
        }
      }
    }
  }

  process.exit(0);
}).catch(console.error);
