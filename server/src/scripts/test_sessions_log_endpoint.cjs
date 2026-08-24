const mongoose = require("mongoose");
const MONGO_URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const BookingSessionSchema = new mongoose.Schema({}, { strict: false });
const BookingSession = mongoose.model("AlaaBS", BookingSessionSchema, "bookingsessions");

const BookingRequestSchema = new mongoose.Schema({}, { strict: false });
const BookingRequest = mongoose.model("AlaaBR", BookingRequestSchema, "bookingrequests");

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("AlaaUser", UserSchema, "users");

async function check() {
  await mongoose.connect(MONGO_URI);

  const user = await User.findOne({ fullName: /الاء.*رضوان.*يونس/i }).lean();
  if (!user) {
    console.log("User not found");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found User: ${user.fullName} (${user._id})`);

  const sessions = await BookingSession.find({ userId: user._id.toString() }).lean();
  console.log(`\nBooking Sessions (${sessions.length}):`);
  for (const s of sessions) {
    console.log(JSON.stringify(s, null, 2));
  }

  const requests = await BookingRequest.find({ userId: user._id.toString() }).lean();
  console.log(`\nBooking Requests (${requests.length}):`);
  for (const r of requests) {
    console.log(JSON.stringify(r, null, 2));
  }

  await mongoose.disconnect();
}

check().catch(console.error);
