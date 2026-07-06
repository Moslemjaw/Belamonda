import { UserModel } from '../models/user.model.js';
import { BookingRequestModel } from '../models/bookingRequest.model.js';
import { BookingSessionModel } from '../models/bookingSession.model.js';
import { connectMongo } from '../db/mongo.js';

async function run() {
  await connectMongo();
  const users = await UserModel.find({ fullName: /Rital/i });
  
  for (const u of users) {
    console.log(`\n--- ${u.fullName} (${u._id}) ---`);
    
    const reqs = await BookingRequestModel.find({ userId: u._id }).sort({ createdAt: -1 });
    console.log(`\nRequests (${reqs.length}):`);
    for (const r of reqs) {
      console.log(`- ID: ${r._id}, Status: ${r.status}, standalone: ${r.standaloneName}, offer: ${r.offerId}`);
    }

    const sessions = await BookingSessionModel.find({ userId: u._id }).sort({ createdAt: -1 });
    console.log(`\nSessions (${sessions.length}):`);
    for (const s of sessions) {
      console.log(`- ID: ${s._id}, Status: ${s.status}, offer: ${s.offerId}, scheduledAt: ${s.scheduledAt}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
