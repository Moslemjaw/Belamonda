import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { ObjectId } from "mongodb";
dotenv.config();

// Mongoose definitions
const bookingSessionSchema = new mongoose.Schema({
  userOfferId: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  offerId: mongoose.Schema.Types.ObjectId,
  clinicId: mongoose.Schema.Types.ObjectId,
  status: String,
  scheduledAt: Date,
  scheduledBy: String,
  createdAt: Date
}, { strict: false });

const bookingRequestSchema = new mongoose.Schema({
  userOfferId: String,
  userId: String,
  offerId: String,
  clinicId: String,
  status: String,
  scheduledSessionId: String,
  clinicPaymentStatus: String,
  sessionPriceKwd: String,
  isStandalone: Boolean,
  standaloneName: String,
  preferredAt: Date,
  confirmedAt: Date,
  confirmedBy: String,
  createdAt: Date,
  updatedAt: Date
}, { strict: false });

const userOfferSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  offerId: mongoose.Schema.Types.ObjectId,
  paymentAmountKwd: String,
  isStandalone: Boolean
}, { strict: false });

const offerSchema = new mongoose.Schema({
  name: String,
  subscriptionPriceKwd: String
}, { strict: false });

const BookingSessionModel = mongoose.model("BookingSession", bookingSessionSchema, "bookingsessions");
const BookingRequestModel = mongoose.model("BookingRequest", bookingRequestSchema, "bookingrequests");
const UserOfferModel = mongoose.model("UserOffer", userOfferSchema, "useroffers");
const OfferModel = mongoose.model("Offer", offerSchema, "offers");

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  // Find all sessions that don't have a booking request
  const allSessions = await BookingSessionModel.find({}).lean();
  console.log(`Total sessions: ${allSessions.length}`);

  const allRequests = await BookingRequestModel.find({ scheduledSessionId: { $exists: true, $ne: null } }).lean();
  const requestsBySession = new Set(allRequests.map(r => r.scheduledSessionId));

  const missingSessions = allSessions.filter(s => !requestsBySession.has(String(s._id)));
  console.log(`Sessions missing requests: ${missingSessions.length}`);

  let createdCount = 0;
  for (const s of missingSessions) {
    if (s.notes === "Historical session logged during enrollment") {
      continue; // skip historical
    }

    try {
      let price = "0.000";
      let standaloneName = "Backfilled Session";
      let isStandalone = true;

      if (s.userOfferId) {
        const uo = await UserOfferModel.findById(s.userOfferId).lean();
        if (uo) {
          if (uo.paymentAmountKwd) {
            price = uo.paymentAmountKwd;
          }
          if (uo.offerId) {
            const offer = await OfferModel.findById(uo.offerId).lean();
            if (offer) {
              standaloneName = offer.name || standaloneName;
              if (offer.subscriptionPriceKwd) {
                price = offer.subscriptionPriceKwd;
              }
            }
          }
        }
      }

      const breqData = {
        userOfferId: s.userOfferId ? String(s.userOfferId) : undefined,
        userId: String(s.userId),
        offerId: s.offerId ? String(s.offerId) : undefined,
        clinicId: String(s.clinicId),
        status: s.status, // use the session's status
        scheduledSessionId: String(s._id),
        clinicPaymentStatus: "payment_pending",
        sessionPriceKwd: price,
        isStandalone: true,
        standaloneName,
        preferredAt: s.scheduledAt,
        confirmedAt: s.createdAt,
        confirmedBy: s.scheduledBy || "system",
        createdAt: s.createdAt,
        updatedAt: new Date()
      };

      await BookingRequestModel.create(breqData);
      createdCount++;
      console.log(`Created request for session ${s._id}`);
    } catch (err: any) {
      console.error(`Failed for session ${s._id}:`, err.message);
    }
  }

  console.log(`Created ${createdCount} booking requests`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
