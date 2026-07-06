import { BookingRequestModel } from '../models/bookingRequest.model.js';
import { BookingSessionModel } from '../models/bookingSession.model.js';
import { UserModel } from '../models/user.model.js';
import { OfferModel } from '../models/offer.model.js';
import { connectMongo } from '../db/mongo.js';
import mongoose from 'mongoose';

async function run() {
  await connectMongo();

  const sessionDocs = await BookingSessionModel.find({}).sort({ scheduledAt: -1 }).limit(300).lean();
  const requestDocs = await BookingRequestModel.find({ status: { $ne: "confirmed" } }).sort({ createdAt: -1 }).limit(300).lean();

  const userIds = [
    ...sessionDocs.map((i: any) => i.userId),
    ...requestDocs.map((i: any) => i.userId)
  ];
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const users = await UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean();
  const userMap = new Map(users.map((u: any) => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));

  const offerIds = [
    ...sessionDocs.map((i: any) => i.offerId),
    ...requestDocs.map((i: any) => i.offerId)
  ];
  const uniqueOfferIds = [...new Set(offerIds.filter(id => !!id && mongoose.isValidObjectId(id)))];
  const offerDocs = uniqueOfferIds.length > 0 ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean() : [];
  const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), o.name]));

  const enrichedSessions = sessionDocs.map((doc: any) => ({
    id: doc._id.toString(),
    type: "session",
    status: doc.status,
    customerName: userMap.get(doc.userId?.toString())?.fullName || null,
  }));

  const enrichedRequests = requestDocs.map((doc: any) => ({
    id: doc._id.toString(),
    type: "request",
    status: doc.status,
    customerName: userMap.get(doc.userId?.toString())?.fullName || null,
  }));

  const allItems = [...enrichedSessions, ...enrichedRequests];
  const ritalItems = allItems.filter(i => i.customerName === "Rital tamer" && i.status === "scheduled");

  console.log("Rital tamer scheduled items from API logic:");
  console.log(ritalItems);
  process.exit(0);
}

run().catch(console.error);
