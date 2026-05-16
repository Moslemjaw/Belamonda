import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  const userId = "6a08a505307270f12df2e6df";
  const user = await UserModel.findById(userId);

  if (!user) {
    console.log("User not found!");
    process.exit(0);
  }

  console.log(`Deleting user ${user.displayName} (${userId}) and all associated records...`);

  await WalletModel.deleteMany({ userId });
  console.log("Deleted wallets.");

  await WalletTxnModel.deleteMany({ userId });
  console.log("Deleted wallet transactions.");

  await UserOfferModel.deleteMany({ userId });
  console.log("Deleted user offers.");

  await BookingRequestModel.deleteMany({ userId });
  console.log("Deleted bookings.");

  await UserModel.deleteOne({ _id: userId });
  console.log("Deleted user account.");

  console.log("\nDone!");
  process.exit(0);
}

run().catch(console.error);
