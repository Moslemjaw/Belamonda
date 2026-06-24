import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { UserOfferModel } from "./src/models/userOffer.model.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "");
  const invites = await UserOfferModel.find({ groupInviteCode: { $ne: null } }).select("groupInviteCode userId").lean();
  console.log("All group invites:");
  console.log(invites);
  process.exit(0);
}
main();
