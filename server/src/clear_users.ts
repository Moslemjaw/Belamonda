import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { UserModel } from './models/user.model.js';
import { UserOfferModel } from './models/userOffer.model.js';
import { BookingRequestModel } from './models/bookingRequest.model.js';
import { PaymentModel } from './models/payment.model.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to MongoDB');

  const users = await UserModel.find({ phone: { $in: ['905318501175', '97270771'] } }).lean();
  console.log('Found users:', users.map(u => u.phone));
  
  const userIds = users.map(u => String(u._id));
  
  if (userIds.length > 0) {
    const res1 = await UserOfferModel.deleteMany({ userId: { $in: userIds } });
    console.log('Deleted UserOffers:', res1.deletedCount);
    
    const res2 = await BookingRequestModel.deleteMany({ userId: { $in: userIds } });
    console.log('Deleted BookingRequests:', res2.deletedCount);
    
    const res3 = await PaymentModel.deleteMany({ userId: { $in: userIds } });
    console.log('Deleted Payments:', res3.deletedCount);
  } else {
    console.log('No users found.');
  }

  await mongoose.disconnect();
}
run().catch(console.error);