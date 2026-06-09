import { connectMongo } from "../src/db/mongo.js";
import { 
  UserModel, 
  UserOfferModel, 
  BookingSessionModel, 
  PaymentModel,
  KycSubmissionModel,
  WalletModel,
  WalletTxnModel,
  BookingRequestModel,
  TaskModel,
  ComplaintModel
} from "../src/models/index.js";
import mongoose from "mongoose";

async function run() {
  await connectMongo();
  const phones = ["8795875466365", "6754548484"];
  for (const phone of phones) {
    const user = await UserModel.findOne({ phone });
    if (!user) {
      console.log(`User with phone ${phone} not found`);
      continue;
    }
    const userId = user._id;
    console.log(`Deleting data for user: ${user.fullName} / ${user.phone} (${userId})`);

    const delSessions = await BookingSessionModel.deleteMany({ userId });
    console.log(`  Deleted ${delSessions.deletedCount} BookingSessions`);

    const delOffers = await UserOfferModel.deleteMany({ userId });
    console.log(`  Deleted ${delOffers.deletedCount} UserOffers`);

    const delPayments = await PaymentModel.deleteMany({ userId });
    console.log(`  Deleted ${delPayments.deletedCount} Payments`);

    const delKyc = await KycSubmissionModel.deleteMany({ userId });
    console.log(`  Deleted ${delKyc.deletedCount} KycSubmissions`);

    const delWallet = await WalletModel.deleteMany({ userId });
    console.log(`  Deleted ${delWallet.deletedCount} Wallets`);

    const delWalletTxns = await WalletTxnModel.deleteMany({ userId });
    console.log(`  Deleted ${delWalletTxns.deletedCount} WalletTxns`);

    const delReqs = await BookingRequestModel.deleteMany({ userId });
    console.log(`  Deleted ${delReqs.deletedCount} BookingRequests`);

    const delTasks = await TaskModel.deleteMany({ customerId: userId });
    console.log(`  Deleted ${delTasks.deletedCount} Tasks`);

    const delComplaints = await ComplaintModel.deleteMany({ customerId: userId });
    console.log(`  Deleted ${delComplaints.deletedCount} Complaints`);

    const delUser = await UserModel.deleteOne({ _id: userId });
    console.log(`  Deleted ${delUser.deletedCount} User records`);

    console.log(`Deleted successfully for ${phone}.`);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
