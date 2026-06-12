import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const userOffers = db.collection('useroffers');
  const offers = db.collection('offers');
  const users = db.collection('users');
  
  const allUserOffers = await userOffers.find({}).toArray();
  
  const userOfferCounts: Record<string, any[]> = {};
  for (const uo of allUserOffers) {
    const uid = uo.userId.toString();
    if (!userOfferCounts[uid]) userOfferCounts[uid] = [];
    userOfferCounts[uid].push(uo);
  }
  
  for (const [uid, uos] of Object.entries(userOfferCounts)) {
    if (uos.length > 1) {
      const user = await users.findOne({ _id: new mongoose.Types.ObjectId(uid) });
      console.log(`User ${user?.fullName || 'Unknown'} (Phone: ${user?.phone}, ID: ${uid}) has ${uos.length} packages total.`);
      
      for (let i = 0; i < uos.length; i++) {
        const offer = await offers.findOne({ _id: new mongoose.Types.ObjectId(uos[i].offerId) });
        console.log(`  [${i}] useroffer ID: ${uos[i]._id}, Offer: ${offer?.titleEn}, Clinic: ${uos[i].assignedClinicId}, isActive: ${uos[i].isActive}`);
      }
    }
  }

  process.exit(0);
}).catch(console.error);
