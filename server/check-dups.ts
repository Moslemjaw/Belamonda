import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();
import { BookingSessionModel } from "./src/models/bookingSession.model.js";
import { BookingRequestModel } from "./src/models/bookingRequest.model.js";
import { UserModel } from "./src/models/user.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const users = await UserModel.find({ fullName: /Rital tamer/i }).lean();
  console.log("Users:", users.map(u => ({ id: u._id, name: u.fullName })));
  
  if (users.length === 0) {
    console.log("No user found");
    process.exit(0);
  }
  
  const userId = users[0]._id;
  
  const sessions = await BookingSessionModel.find({ userId }).lean();
  console.log(`Sessions for user: ${sessions.length}`);
  for (const s of sessions) {
    console.log(`- Session ID: ${s._id}, scheduledAt: ${s.scheduledAt}, status: ${s.status}`);
  }
  
  const requests = await BookingRequestModel.find({ userId }).lean();
  console.log(`Requests for user: ${requests.length}`);
  for (const r of requests) {
    console.log(`- Request ID: ${r._id}, session: ${r.scheduledSessionId}, status: ${r.status}`);
  }
  
  process.exit(0);
}
run();
