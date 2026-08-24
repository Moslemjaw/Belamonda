const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const BookingSessionSchema = new mongoose.Schema({ scheduledAt: Date, notes: String, status: String }, { strict: false });
const BookingSession = mongoose.model("CheckBS", BookingSessionSchema, "bookingsessions");

const BookingRequestSchema = new mongoose.Schema({ status: String, proposedAt: Date, preferredAt: Date, createdAt: Date }, { strict: false });
const BookingRequest = mongoose.model("CheckBR", BookingRequestSchema, "bookingrequests");

async function check() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.\n");

  const totalSessions = await BookingSession.countDocuments({});
  const totalRequests = await BookingRequest.countDocuments({});
  console.log("Total BookingSession documents in DB:", totalSessions);
  console.log("Total BookingRequest documents in DB:", totalRequests);

  const baseDate = new Date("2026-07-01T00:00:00Z");
  const filteredSessions = await BookingSession.countDocuments({
    notes: { $ne: "Historical session logged during enrollment" },
    scheduledAt: { $gte: baseDate }
  });
  console.log("Sessions with scheduledAt >= 2026-07-01 (excluding historical):", filteredSessions);

  const filteredRequests = await BookingRequest.countDocuments({
    status: { $ne: "confirmed" },
    $or: [
      { proposedAt: { $gte: baseDate } },
      { preferredAt: { $gte: baseDate } },
      { createdAt: { $gte: baseDate } }
    ]
  });
  console.log("Requests with date >= 2026-07-01 (excluding confirmed):", filteredRequests);

  // Let's print the first 5 sessions
  const firstSessions = await BookingSession.find({
    notes: { $ne: "Historical session logged during enrollment" },
    scheduledAt: { $gte: baseDate }
  }).sort({ scheduledAt: -1 }).limit(5).lean();
  console.log("\nRecent 5 sessions:");
  console.log(JSON.stringify(firstSessions, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
