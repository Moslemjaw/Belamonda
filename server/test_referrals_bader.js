import mongoose from "mongoose";
import { UserModel } from "./dist/models/user.model.js";
import { PaymentModel } from "./dist/models/payment.model.js";
import { UserOfferModel } from "./dist/models/userOffer.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const baders = await UserModel.find({ username: { $regex: /bader/i } }).lean();
  console.log("Bader users:", baders.map(b => ({ _id: b._id, username: b.username, role: b.role })));
  
  const baderId = baders[0]?._id;
  const baderName = baders[0]?.username;
  
  if (baderId || baderName) {
      const p1 = await PaymentModel.findOne({ $or: [{ createdByUserId: String(baderId) }, { createdByUserId: baderName }, { confirmedBy: String(baderId) }, { confirmedBy: baderName }] }).lean();
      console.log("Payment by Bader:", !!p1);
      
      const uo = await UserOfferModel.findOne({ $or: [{ paymentConfirmedBy: String(baderId) }, { paymentConfirmedBy: baderName }] }).lean();
      console.log("UserOffer by Bader:", !!uo);
  }
  
  mongoose.disconnect();
}

run().catch(console.error);
