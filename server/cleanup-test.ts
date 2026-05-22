import mongoose from "mongoose";
import { UserModel } from "./src/models/user.model.js";
import { BookingSessionModel } from "./src/models/bookingSession.model.js";
import { PaymentModel } from "./src/models/payment.model.js";
import { BookingRequestModel } from "./src/models/bookingRequest.model.js";
import { UserOfferModel } from "./src/models/userOffer.model.js";

async function run() {
  await mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll");

  // Find the 'test' user
  const user = await UserModel.findOne({ fullName: "test" });
  if (!user) {
    console.log("User 'test' not found.");
  } else {
    const userId = user._id.toString();
    console.log(`Found user 'test' with ID: ${userId}`);

    // Delete associated data
    const sessionsRes = await BookingSessionModel.deleteMany({ userId });
    console.log(`Deleted ${sessionsRes.deletedCount} BookingSessions`);

    const paymentsRes = await PaymentModel.deleteMany({ userId });
    console.log(`Deleted ${paymentsRes.deletedCount} Payments`);

    const requestsRes = await BookingRequestModel.deleteMany({ userId });
    console.log(`Deleted ${requestsRes.deletedCount} BookingRequests`);

    const offersRes = await UserOfferModel.deleteMany({ userId });
    console.log(`Deleted ${offersRes.deletedCount} UserOffers`);

    // Delete user
    const userRes = await UserModel.deleteOne({ _id: user._id });
    console.log(`Deleted ${userRes.deletedCount} User`);
  }

  // Count total sessions currently in the DB
  const totalSessions = await BookingSessionModel.countDocuments();
  console.log(`Total sessions in the DB now: ${totalSessions}`);

  await mongoose.disconnect();
}

run().catch(console.error);
