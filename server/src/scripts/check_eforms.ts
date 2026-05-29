import mongoose from "mongoose";
import { EFormModel } from "../models/eform.model.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  const eforms = await EFormModel.find({}).lean();
  console.log(JSON.stringify(eforms.map((f: any) => ({ id: f._id, title: f.title, targets: f.targets })), null, 2));
  process.exit(0);
}
run().catch(console.error);
