import mongoose from "mongoose";
import { BookingRequestModel } from "./src/models/bookingRequest.model.js";
import { UserModel } from "./src/models/user.model.js";

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/belamonda");
  const users = await UserModel.find({ fullName: /tttt/i }).lean();
  console.log("Users matching 'tttt':", users);
  const userIds = users.map(u => u._id.toString());
  
  const reqs = await BookingRequestModel.find().lean();
  console.log("Total booking requests:", reqs.length);
  
  const tReqs = reqs.filter(r => userIds.includes(r.userId) || r.standaloneName === "tttt");
  console.log("Requests for 'tttt':");
  tReqs.forEach(r => {
    console.log("- id:", r._id);
    console.log("  status:", r.status);
    console.log("  proposedAt:", r.proposedAt);
    console.log("  clinicId:", r.clinicId);
  });
  
  // Test bookingRequestsStore simulation of useBookingRequests behavior
  const openReqs = reqs.filter(r => r.status === "request_received" || r.status === "slot_assigned");
  console.log("Requests returned for 'open' (Old UI behavior):", openReqs.length);
  
  const requestReceivedReqs = reqs.filter(r => r.status === "request_received");
  console.log("Requests returned for 'request_received' (New UI behavior):", requestReceivedReqs.length);
  
  process.exit(0);
}

main().catch(console.error);
