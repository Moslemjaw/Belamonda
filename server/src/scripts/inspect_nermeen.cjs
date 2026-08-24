const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const BookingRequestSchema = new mongoose.Schema({}, { strict: false });
const BookingRequest = mongoose.model("BookingRequest", BookingRequestSchema);

const BookingSessionSchema = new mongoose.Schema({}, { strict: false });
const BookingSession = mongoose.model("BookingSession", BookingSessionSchema);

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const user = await User.findOne({
    $or: [
      { fullName: /nermeen/i },
      { fullName: /نرمين/i },
      { fullName: /alashwany/i },
      { fullName: /الشواني/i }
    ]
  }).lean();
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  console.log("Found User:", user._id.toString(), user.fullName, user.phone);

  const requests = await BookingRequest.find({ userId: user._id.toString() }).sort({ createdAt: -1 }).lean();
  console.log(`\nFound ${requests.length} BookingRequest(s):`);
  for (const r of requests) {
    console.log({
      id: r._id.toString(),
      status: r.status,
      userOfferId: r.userOfferId?.toString(),
      scheduledSessionId: r.scheduledSessionId?.toString(),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
      proposedAt: r.proposedAt ? new Date(r.proposedAt).toISOString() : null,
      preferredAt: r.preferredAt ? new Date(r.preferredAt).toISOString() : null,
      clinicPaymentStatus: r.clinicPaymentStatus,
      clinicPaymentMarkedAt: r.clinicPaymentMarkedAt ? new Date(r.clinicPaymentMarkedAt).toISOString() : null,
      clinicPaymentMarkedBy: r.clinicPaymentMarkedBy
    });
  }

  const sessions = await BookingSession.find({ userId: user._id.toString() }).sort({ scheduledAt: -1 }).lean();
  console.log(`\nFound ${sessions.length} BookingSession(s):`);
  for (const s of sessions) {
    console.log({
      id: s._id.toString(),
      status: s.status,
      userOfferId: s.userOfferId?.toString(),
      bookingRequestId: s.bookingRequestId?.toString(),
      scheduledAt: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : null,
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
      scheduledBy: s.scheduledBy,
      markedBy: s.markedBy
    });
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
