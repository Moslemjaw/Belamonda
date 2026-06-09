import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const recentSessions = await mongoose.connection.collection("bookingsessions").find().sort({ _id: -1 }).limit(5).toArray();
  console.log("Recent Sessions:");
  console.log(recentSessions);

  if (recentSessions.length > 0) {
    const userOfferId = recentSessions[0].userOfferId;
    const requests = await mongoose.connection.collection("bookingrequests").find({ userOfferId: String(userOfferId) }).toArray();
    console.log("Requests for that UserOffer:");
    console.log(requests);
    
    // Check what commerce.router returns for this user
    const uo = await mongoose.connection.collection("useroffers").findOne({ _id: userOfferId });
    console.log("User Offer:", uo);
  }

  process.exit(0);
}
main().catch(console.error);
