import mongoose from "mongoose";
import { UserModel } from "./dist/models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const usersWithRef = await UserModel.find({ referredBy: { $exists: true, $ne: null } }).select("username referredBy").lean();
  console.log("Users with referredBy:", usersWithRef.length);
  if (usersWithRef.length > 0) {
      console.log("Sample:", usersWithRef.slice(0, 5));
  }
  
  mongoose.disconnect();
}

run().catch(console.error);
