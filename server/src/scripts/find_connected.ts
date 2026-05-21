import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const generalOffer = await db.collection("offers").findOne({ name: "General Service" });
  const otherOffer = await db.collection("offers").findOne({ name: "Other" });

  if (generalOffer) {
    const generalUos = await db.collection("useroffers").find({ offerId: generalOffer._id }).toArray();
    for (const uo of generalUos) {
      const user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(uo.userId) });
      console.log(`[General Service] Client: ${user?.fullName || "Unknown"} (User ID: ${uo.userId})`);
    }
  }

  if (otherOffer) {
    const otherUos = await db.collection("useroffers").find({ offerId: otherOffer._id }).toArray();
    for (const uo of otherUos) {
      const user = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(uo.userId) });
      console.log(`[Other] Client: ${user?.fullName || "Unknown"} (User ID: ${uo.userId})`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
