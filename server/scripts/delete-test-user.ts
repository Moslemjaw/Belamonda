import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { PaymentModel } from "../src/models/payment.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const user = await UserModel.findOne({ phone: "96597270775" });
  if (!user) {
    console.log("User not found!");
    process.exit(0);
  }

  const userId = user._id;
  console.log("Deleting data for user:", userId);

  await WalletModel.deleteMany({ userId });
  await WalletTxnModel.deleteMany({ userId });
  await UserOfferModel.deleteMany({ userId });
  await BookingRequestModel.deleteMany({ userId });
  await BookingSessionModel.deleteMany({ userId });
  await PaymentModel.deleteMany({ userId });
  
  await UserModel.deleteOne({ _id: userId });

  console.log("Successfully deleted Test user and all associated records.");
  process.exit(0);
}

run().catch(console.error);
