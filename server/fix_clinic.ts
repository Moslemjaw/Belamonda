import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const badId = '6a12b5000053279023e1ffea';
  const goodId = new mongoose.Types.ObjectId('6a026bbba50390b2cfb8a50d');

  const r1 = await mongoose.connection.collection('useroffers').updateMany(
    { clinicId: new mongoose.Types.ObjectId(badId) },
    { $set: { clinicId: goodId } }
  );
  console.log('Fixed UserOffers:', r1.modifiedCount);

  const r2 = await mongoose.connection.collection('bookingrequests').updateMany(
    { clinicId: badId },
    { $set: { clinicId: '6a026bbba50390b2cfb8a50d' } }
  );
  console.log('Fixed BookingRequests:', r2.modifiedCount);

  process.exit(0);
}
main();
