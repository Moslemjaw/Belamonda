import mongoose from 'mongoose';
import { BookingRequestModel } from './src/models/bookingRequest.model.js';
import { BookingSessionModel } from './src/models/bookingSession.model.js';
import dotenv from 'dotenv';
dotenv.config({path: './.env'});

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const reqs = await BookingRequestModel.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $match: { $or: [
        { customerName: { $regex: /amani|أماني|ابراهيم|ibrahim/i } }, 
        { 'user.fullName': { $regex: /amani|أماني|ابراهيم|ibrahim/i } },
        { standaloneName: { $regex: /amani|أماني|ابراهيم|ibrahim/i } }
      ] 
    } }
  ]);
  console.log('Requests for Amani/Ibrahim:');
  reqs.forEach(r => console.log(`ID: ${r._id}, Name: ${r.customerName || r.user?.fullName || r.standaloneName}, Status: ${r.status}, Payment: ${r.clinicPaymentStatus}, SessionID: ${r.scheduledSessionId}`));

  const sess = await BookingSessionModel.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $match: { $or: [
        { customerName: { $regex: /amani|أماني|ابراهيم|ibrahim/i } }, 
        { 'user.fullName': { $regex: /amani|أماني|ابراهيم|ibrahim/i } },
        { standaloneName: { $regex: /amani|أماني|ابراهيم|ibrahim/i } }
      ] 
    } }
  ]);
  console.log('\nSessions for Amani/Ibrahim:');
  sess.forEach(s => console.log(`ID: ${s._id}, Name: ${s.customerName || s.user?.fullName || s.standaloneName}, Status: ${s.status}`));

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
