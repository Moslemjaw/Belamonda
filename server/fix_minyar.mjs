import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const users = db.collection('users');
  const bookingRequests = db.collection('bookingrequests');

  const user = await users.findOne({ fullName: { $regex: 'منيار الزواري', $options: 'i' } });
  if (!user) {
    console.log("User not found.");
    process.exit(1);
  }

  console.log(`User: ${user.fullName} (${user.phone}), ID: ${user._id}`);

  // Find stranded requests
  const openStatuses = ["request_received", "slot_assigned", "scheduled"];
  const reqs = await bookingRequests.find({ 
    userId: user._id.toString(),
    status: { $in: openStatuses }
  }).toArray();
  
  if (reqs.length === 0) {
    console.log("No open requests found for this user.");
  }

  for (const r of reqs) {
    console.log(`Found open request ID: ${r._id} (Status: ${r.status})`);
    if (r.status === 'scheduled') {
      console.log(`Force cancelling stranded scheduled request ${r._id}...`);
      await bookingRequests.updateOne(
        { _id: r._id },
        { $set: { status: 'cancelled' } }
      );
      
      if (r.userOfferId) {
         const userOffers = db.collection('useroffers');
         const uoIdStr = r.userOfferId.toString();
         let uoIdObj = null;
         try {
           uoIdObj = new mongoose.Types.ObjectId(uoIdStr);
         } catch (e) {}

         const uo = await userOffers.findOne({ _id: uoIdObj || uoIdStr });
         if (uo && uo.sessionsUsed > 0) {
           console.log(`Decrementing sessionsUsed for UserOffer ${uo._id}`);
           await userOffers.updateOne(
             { _id: uo._id },
             { $inc: { sessionsUsed: -1 } }
           );
         }
      }
    }
  }

  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
