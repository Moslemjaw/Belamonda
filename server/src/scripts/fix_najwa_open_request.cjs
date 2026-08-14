const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("Set MONGODB_URI or MONGO_URI env var");
  process.exit(1);
}

const BookingRequestSchema = new mongoose.Schema({}, { strict: false });
const BookingRequest = mongoose.model("BookingRequest", BookingRequestSchema);
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Find the user by name
  const user = await User.findOne({ fullName: /نجوى.*ابراهيم/i }).lean();
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  console.log("Found user:", user._id.toString(), user.fullName);

  // Find all open booking requests
  const openStatuses = ["request_received", "slot_assigned", "scheduled"];
  const openRequests = await BookingRequest.find({
    userId: user._id.toString(),
    status: { $in: openStatuses }
  }).lean();

  console.log(`Found ${openRequests.length} open booking request(s):`);
  for (const r of openRequests) {
    console.log(`  ID: ${r._id} | status: ${r.status} | userOfferId: ${r.userOfferId} | clinicPaymentStatus: ${r.clinicPaymentStatus} | createdAt: ${r.createdAt}`);
  }

  if (openRequests.length === 0) {
    console.log("No open requests found. Checking if there is a scheduled BookingSession blocking...");
    const BookingSessionSchema = new mongoose.Schema({}, { strict: false });
    const BookingSession = mongoose.model("BookingSession", BookingSessionSchema);
    const openSessions = await BookingSession.find({
      userId: user._id.toString(),
      status: { $in: ["scheduled", "checked_in", "in_progress"] }
    }).lean();
    console.log(`Found ${openSessions.length} active session(s):`);
    for (const s of openSessions) {
      console.log(`  ID: ${s._id} | status: ${s.status} | scheduledAt: ${s.scheduledAt} | userOfferId: ${s.userOfferId}`);
    }
  }

  if (process.argv.includes("--fix") && openRequests.length > 0) {
    console.log("\nCancelling orphaned open requests...");
    for (const r of openRequests) {
      await BookingRequest.findByIdAndUpdate(r._id, {
        $set: { status: "cancelled" }
      });
      console.log(`  Cancelled: ${r._id}`);
    }
    console.log("Done! Customer can now book again.");
  } else if (openRequests.length > 0) {
    console.log("\nRun with --fix to cancel them.");
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
