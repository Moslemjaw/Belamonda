import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

// Important models that might reference userId
import { UserModel } from "./src/models/user.model.js";
import { UserOfferModel } from "./src/models/userOffer.model.js";
import { PaymentModel } from "./src/models/payment.model.js";
import { BookingRequestModel } from "./src/models/bookingRequest.model.js";
import { WalletModel, WalletTxnModel } from "./src/models/kyc.model.js";

async function main() {
  console.log("Connecting to", process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda");
  
  const phoneToMatch = "905318501175";
  const nameToMatch = "Musallam Jawish";
  
  // Try finding user by phone or name
  let user = await UserModel.findOne({ phone: new RegExp(phoneToMatch) });
  if (!user) {
    user = await UserModel.findOne({ name: new RegExp(nameToMatch, "i") });
  }

  if (!user) {
    console.log("User not found!");
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (Phone: ${user.phone}, ID: ${user._id})`);
  const userId = String(user._id);

  // Perform deletions
  const userOfferRes = await UserOfferModel.deleteMany({ userId });
  console.log(`Deleted ${userOfferRes.deletedCount} UserOffers.`);

  const paymentRes = await PaymentModel.deleteMany({ userId });
  console.log(`Deleted ${paymentRes.deletedCount} Payments.`);

  const bookingRes = await BookingRequestModel.deleteMany({ userId });
  console.log(`Deleted ${bookingRes.deletedCount} BookingRequests.`);

  const walletRes = await WalletModel.deleteMany({ userId });
  console.log(`Deleted ${walletRes.deletedCount} KYCWallets.`);

  const ledgerRes = await WalletTxnModel.deleteMany({ userId });
  console.log(`Deleted ${ledgerRes.deletedCount} KYCLedger entries.`);

  // If there are other models (like Forms, etc.) we can delete them as well, but this covers the main ones
  // that deal with money, bookings, and memberships.
  
  const userRes = await UserModel.deleteOne({ _id: user._id });
  console.log(`Deleted ${userRes.deletedCount} User.`);

  console.log("Deletion complete.");
  process.exit(0);
}
main().catch(console.error);
