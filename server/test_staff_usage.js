import mongoose from "mongoose";
import { UserOfferModel } from "./dist/models/userOffer.model.js";
import { PaymentModel } from "./dist/models/payment.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const badriaId = "6a12b18e27d67b93eef87027";
  const dianaId = "6a12e92b1e3af715b350e882";
  const haneenId = "6a12d1da7022845c74a0dc45";
  
  const uo1 = await UserOfferModel.find({ $or: [{ paymentConfirmedBy: badriaId }, { paymentConfirmedBy: dianaId }, { paymentConfirmedBy: haneenId }] }).lean();
  console.log("UserOffers confirmed by staff:", uo1.length);
  
  const p1 = await PaymentModel.find({ $or: [{ confirmedBy: badriaId }, { confirmedBy: dianaId }, { confirmedBy: haneenId }, { createdByUserId: badriaId }, { createdByUserId: dianaId }, { createdByUserId: haneenId }] }).lean();
  console.log("Payments confirmed/created by staff:", p1.length);
  
  // Also check if any USER has referredBy = staff
  const mongooseIds = [badriaId, dianaId, haneenId].map(id => new mongoose.Types.ObjectId(id));
  const { UserModel } = await import("./dist/models/user.model.js");
  const usersRef = await UserModel.find({ referredBy: { $in: mongooseIds } }).lean();
  console.log("Users referred by staff:", usersRef.length);

  mongoose.disconnect();
}

run().catch(console.error);
