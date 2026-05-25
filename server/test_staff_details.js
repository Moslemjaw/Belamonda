import mongoose from "mongoose";
import { UserModel } from "./dist/models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const user = await UserModel.findById("6a12e92b1e3af715b350e882").lean();
  console.log("User 6a12e92b1e3af715b350e882:", user);
  
  mongoose.disconnect();
}

run().catch(console.error);
