import mongoose from 'mongoose';
import { UserModel } from './server/src/models/user.model.js';
import { BookingRequestModel } from './server/src/models/bookingRequest.model.js';
import { BookingSessionModel } from './server/src/models/bookingSession.model.js';
import dotenv from 'dotenv';
dotenv.config({path: './server/.env'});

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const users = await UserModel.find({ fullName: /Amani/i });
  console.log('Users:', users.map(u => ({ id: u._id, name: u.fullName })));
  
  if (users.length > 0) {
    for (const user of users) {
      const userId = user._id.toString();
      const reqs = await BookingRequestModel.find({ userId });
      console.log('Requests for', user.fullName, ':', reqs.map(r => ({ id: r._id, status: r.status, payment: r.clinicPaymentStatus, sessionId: r.scheduledSessionId })));
      
      const sess = await BookingSessionModel.find({ userId });
      console.log('Sessions for', user.fullName, ':', sess.map(s => ({ id: s._id, status: s.status })));
    }
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
