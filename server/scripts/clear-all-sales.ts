import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { PaymentModel } from "../src/models/payment.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { WalletModel, WalletTxnModel, KycSubmissionModel } from "../src/models/kyc.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  console.log("Deleting all sales, memberships, payments, and wallets...");

  const paymentsRes = await PaymentModel.deleteMany({});
  console.log(`Deleted ${paymentsRes.deletedCount} payments.`);

  const offersRes = await UserOfferModel.deleteMany({});
  console.log(`Deleted ${offersRes.deletedCount} user offers/memberships.`);

  const bookingsRes = await BookingRequestModel.deleteMany({});
  console.log(`Deleted ${bookingsRes.deletedCount} booking requests.`);

  const walletsRes = await WalletModel.deleteMany({});
  console.log(`Deleted ${walletsRes.deletedCount} wallets.`);

  const walletTxnsRes = await WalletTxnModel.deleteMany({});
  console.log(`Deleted ${walletTxnsRes.deletedCount} wallet transactions.`);

  const kycRes = await KycSubmissionModel.deleteMany({});
  console.log(`Deleted ${kycRes.deletedCount} KYC submissions.`);

  const phonesToDelete = ["64848464848", "97270484545", "96597270775"];
  console.log(`\nDeleting users with phones: ${phonesToDelete.join(", ")}`);
  
  const usersRes = await UserModel.deleteMany({ phone: { $in: phonesToDelete } });
  console.log(`Deleted ${usersRes.deletedCount} users.`);

  console.log("\nDone clearing all sales data and specific users!");
  process.exit(0);
}

run().catch(console.error);
