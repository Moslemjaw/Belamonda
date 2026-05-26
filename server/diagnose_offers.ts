import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const userId = "6a14989e4b6ae706d27314c3"; // the user from previous diagnosis
  const items = await mongoose.connection.collection("useroffers").find({ userId }).toArray();
  
  const userOfferIdsStr = items.map((i: any) => String(i._id));
  const userOfferObjectIds = items.map((i: any) => new mongoose.Types.ObjectId(i._id));

  const [pendingRequests, scheduledSessions, lastCompletedSessions] = await Promise.all([
    mongoose.connection.collection("bookingrequests").find({
      userOfferId: { $in: userOfferIdsStr },
      status: { $in: ["awaiting_session_payment", "under_review", "slot_proposed", "slot_accepted"] } // my fixed logic
    }).toArray(),
    mongoose.connection.collection("bookingsessions").find({
      userOfferId: { $in: userOfferObjectIds },
      status: "scheduled"
    }).toArray(),
    mongoose.connection.collection("bookingsessions").aggregate([
      { $match: { userOfferId: { $in: userOfferObjectIds }, status: "completed" } },
      { $sort: { completedAt: -1 } },
      { $group: { _id: "$userOfferId", lastCompletedAt: { $first: "$completedAt" } } }
    ]).toArray()
  ]);

  const activeBookingsSet = new Set([
    ...pendingRequests.map(r => r.userOfferId),
    ...scheduledSessions.map(s => String(s.userOfferId))
  ]);

  console.log("Pending Requests:", pendingRequests.map(r => ({ _id: r._id, status: r.status, uo: r.userOfferId })));
  console.log("Scheduled Sessions:", scheduledSessions.map(s => ({ _id: s._id, status: s.status, uo: String(s.userOfferId) })));
  console.log("Active Bookings Set:", Array.from(activeBookingsSet));
  
  for (const uo of items) {
    console.log(`UserOffer ${uo._id}: hasActiveBooking=${activeBookingsSet.has(String(uo._id))}`);
  }

  process.exit(0);
}
main().catch(console.error);
