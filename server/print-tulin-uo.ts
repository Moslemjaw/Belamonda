import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const uos = await db.collection("useroffers").find({
    userId: "6a0c37ad1c344f6eae8c328e" // Let's check Tolene's ID or find by name Tolene / تولين
  }).toArray();

  if (uos.length === 0) {
    // Find by user's name
    const user = await db.collection("users").findOne({ fullName: /تولين/ });
    if (user) {
      console.log(`Found user: ${user.fullName} (${user._id})`);
      const userUos = await db.collection("useroffers").find({ userId: String(user._id) }).toArray();
      for (const uo of userUos) {
        console.log("UserOffer:", uo);
        const offer = await db.collection("offers").findOne({ _id: uo.offerId });
        console.log("Associated Offer:", offer);
        console.log("=========================================");
      }
    } else {
      console.log("User not found");
    }
  } else {
    console.log("Found by hardcoded ID");
  }

  await mongoose.disconnect();
}
main();
