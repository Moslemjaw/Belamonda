import mongoose from "mongoose";
import { UserModel } from "./dist/models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const staff = await UserModel.find({ role: { $in: ["cs", "legal", "admin", "superadmin"] } }).lean();
  console.log("Staff users:", staff.map(s => ({ _id: s._id, username: s.username, role: s.role, displayName: s.displayName })));
  
  mongoose.disconnect();
}

run().catch(console.error);
