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
  console.log("Connected to DB");

  const user = await User.findOne({ fullName: /نور.*احمد.*سلامة/i }).lean();
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  console.log("Found user:", user._id.toString(), user.fullName);

  const requests = await BookingRequest.find({ userId: user._id.toString() }).lean();
  console.log(`Found ${requests.length} total request(s):`);
  for (const r of requests) {
    console.log(`  Req ID: ${r._id} | status: ${r.status} | userOfferId: ${r.userOfferId} | scheduledSessionId: ${r.scheduledSessionId} | createdAt: ${r.createdAt} | proposedAt: ${r.proposedAt} | preferredAt: ${r.preferredAt}`);
  }

  const sessions = await BookingSession.find({ userId: user._id.toString() }).lean();
  console.log(`Found ${sessions.length} total session(s):`);
  for (const s of sessions) {
    console.log(`  Sess ID: ${s._id} | status: ${s.status} | scheduledAt: ${s.scheduledAt} | userOfferId: ${s.userOfferId} | bookingRequestId: ${s.bookingRequestId}`);
  }

  if (process.argv.includes("--fix")) {
    console.log("\nFixing past scheduled requests...");
    const openStatuses = ["request_received", "slot_assigned", "scheduled"];
    const now = new Date();
    for (const r of requests) {
      if (openStatuses.includes(r.status)) {
        // If there's an associated session that is completed, or if date is in the past
        let isPast = false;
        const dateToCheck = r.proposedAt || r.preferredAt || r.createdAt;
        if (dateToCheck && new Date(dateToCheck) < now) {
          isPast = true;
        }

        let linkedSess = null;
        if (r.scheduledSessionId) {
          linkedSess = await BookingSession.findById(r.scheduledSessionId).lean();
        } else {
          linkedSess = await BookingSession.findOne({ bookingRequestId: r._id }).lean();
        }

        if (linkedSess && (linkedSess.status === "completed" || linkedSess.status === "no_show")) {
          console.log(`  Updating request ${r._id} to status '${linkedSess.status}' (linked session is ${linkedSess.status})`);
          await BookingRequest.findByIdAndUpdate(r._id, { $set: { status: linkedSess.status } });
        } else if (isPast) {
          console.log(`  Updating past request ${r._id} to status 'completed' (past date: ${dateToCheck})`);
          await BookingRequest.findByIdAndUpdate(r._id, { $set: { status: "completed" } });
        }
      }
    }
    console.log("Done fixing.");
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
