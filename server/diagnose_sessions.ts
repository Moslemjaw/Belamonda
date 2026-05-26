import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const userOfferId = new mongoose.Types.ObjectId("6a1498ea4b6ae706d273165e");
  const sessions = await mongoose.connection.collection("bookingsessions").find({ userOfferId }).toArray();
  console.log(sessions);

  const requests = await mongoose.connection.collection("bookingrequests").find({ userOfferId: "6a1498ea4b6ae706d273165e" }).toArray();
  console.log("Requests:");
  console.log(requests);

  process.exit(0);
}
main().catch(console.error);
