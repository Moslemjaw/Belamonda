import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'test' });
  console.log("Connected to MongoDB (database: test).");

  const db = mongoose.connection;
  const users = db.collection('users');
  const useroffers = db.collection('useroffers');
  const offers = db.collection('offers');
  const clinics = db.collection('clinics');
  const bookingRequests = db.collection('bookingrequests');

  // Find the user
  const user = await users.findOne({ fullName: { $regex: 'الاء عشري ابو الريش', $options: 'i' } });
  if (!user) {
    console.log("User not found: الاء عشري ابو الريش");
    process.exit(1);
  }

  console.log(`User: ${user.fullName} (${user.phone}), ID: ${user._id}`);
  
  // Find their active user offers
  const userOffers = await useroffers.find({ userId: user._id.toString() }).toArray();
  
  if (userOffers.length === 0) {
     console.log("No user offers found for this user.");
     process.exit(1);
  }
  
  // Pick the first offer
  const uo = userOffers[0];
  console.log(`Using UserOffer ID: ${uo._id}`);
  
  const clinicId = uo.clinicId || user.assignedClinicId || '6a026bbca50390b2cfb8a51f'; // default to Maroo's if none
  const offerId = uo.offerId ? uo.offerId.toString() : null;

  const newRequest = {
    userOfferId: uo._id.toString(),
    userId: user._id.toString(),
    offerId: offerId,
    clinicId: clinicId.toString(),
    status: 'request_received',
    isStandalone: false,
    bookingRoute: 'cs',
    preferredAt: new Date(),
    clinicPaymentStatus: 'payment_pending',
    extraItems: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await bookingRequests.insertOne(newRequest);
  console.log(`Booking request created successfully! ID: ${result.insertedId}`);

  process.exit(0);
}

run().catch(console.error);
