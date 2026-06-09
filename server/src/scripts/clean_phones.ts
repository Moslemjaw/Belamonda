import mongoose from "mongoose";
import { UserModel } from "../models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function clean() {
  const mongoUri = process.env.MONGODB_URI!;
  if (!mongoUri) { console.error("MONGODB_URI not set"); process.exit(1); }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  try {
    console.log("Dropping unique phone index...");
    await UserModel.collection.dropIndex("phone_1");
    console.log("Dropped phone_1 index successfully.");
  } catch (err: any) {
    if (err.code === 27) {
      console.log("Index phone_1 does not exist, skipping drop.");
    } else {
      console.error("Error dropping index:", err.message);
    }
  }

  console.log("Cleaning up appended indexes from phone numbers...");
  const users = await UserModel.find({ phone: { $regex: /-\d+$/ } });
  
  let count = 0;
  for (const u of users) {
    if (u.phone) {
      const cleanPhone = u.phone.split("-")[0];
      await UserModel.updateOne({ _id: u._id }, { $set: { phone: cleanPhone } });
      count++;
    }
  }
  
  console.log(`Successfully cleaned ${count} phone numbers.`);

  await mongoose.disconnect();
  process.exit(0);
}

clean();
