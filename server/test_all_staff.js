import mongoose from "mongoose";
import { UserModel } from "./dist/models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const staff = await UserModel.find({ role: { $ne: "customer" } }).lean();
  console.log("All staff:", staff.map(s => ({ _id: s._id, username: s.username, fullName: s.fullName, role: s.role, email: s.email, referralCode: s.referralCode })));
  
  mongoose.disconnect();
}

run().catch(console.error);
