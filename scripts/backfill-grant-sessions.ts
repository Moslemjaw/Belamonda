import mongoose from "mongoose";
import { BookingSessionModel } from "../server/src/models/bookingSession.model.js";
import { BookingRequestModel } from "../server/src/models/bookingRequest.model.js";
import { UserOfferModel } from "../server/src/models/userOffer.model.js";
import { OfferModel } from "../server/src/models/offer.model.js";
import dotenv from "dotenv";
dotenv.config({ path: "../server/.env" });

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const sessions = await BookingSessionModel.find({});
  let count = 0;

  for (const s of sessions) {
    const existingReq = await BookingRequestModel.findOne({ scheduledSessionId: s._id.toString() });
    if (!existingReq) {
      count++;
      console.log(`Backfilling for session ${s._id}`);
      const uo = await UserOfferModel.findById(s.userOfferId);
      const offer = await OfferModel.findById(s.offerId);
      
      const isPaid = uo?.paymentMethod === "cash" || parseFloat(uo?.paymentAmountKwd || "0") > 0;
      
      await BookingRequestModel.create({
        userOfferId: s.userOfferId.toString(),
        userId: s.userId,
        offerId: s.offerId.toString(),
        clinicId: s.clinicId.toString(),
        status: s.status === "scheduled" ? "confirmed" : s.status,
        scheduledSessionId: s._id.toString(),
        clinicPaymentStatus: isPaid ? "paid" : "payment_pending",
        sessionPriceKwd: uo?.paymentAmountKwd || "0.000",
        isStandalone: true,
        standaloneName: offer?.name || "Manual Session",
        preferredAt: s.scheduledAt,
        confirmedAt: s.createdAt,
        confirmedBy: "system_backfill"
      });
    }
  }
  console.log(`Done backfilling ${count} sessions.`);
  process.exit(0);
}
run().catch(console.error);
