import mongoose from "mongoose";
import { UserModel } from "./dist/models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const baders = await UserModel.find({ 
      $or: [
          { fullName: { $regex: /بدر/ } }
      ] 
  }).lean();
  console.log("Bader users:", baders.map(b => ({ _id: b._id, fullName: b.fullName, role: b.role })));
  
  mongoose.disconnect();
}

run().catch(console.error);
