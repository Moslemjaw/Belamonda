const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const BookingSessionSchema = new mongoose.Schema({}, { strict: false });
const BookingSession = mongoose.model("FixBS", BookingSessionSchema, "bookingsessions");

async function fix() {
  await mongoose.connect(MONGO_URI);
  
  // Fix the document missing createdAt by setting it to its scheduledAt
  const doc = await BookingSession.findById("6a8bfa50caad3e2f045d8c83").lean();
  if (doc && !doc.createdAt) {
    await BookingSession.updateOne(
      { _id: "6a8bfa50caad3e2f045d8c83" },
      { $set: { createdAt: doc.scheduledAt || new Date() } }
    );
    console.log("✅ Fixed document 6a8bfa50caad3e2f045d8c83 - set createdAt to:", doc.scheduledAt || new Date());
  } else {
    console.log("Document already has createdAt or not found.");
  }
  
  // Check for any other sessions missing createdAt
  const missing = await BookingSession.find({ createdAt: { $exists: false } }).lean();
  console.log(`Found ${missing.length} other sessions missing createdAt`);
  for (const m of missing) {
    await BookingSession.updateOne(
      { _id: m._id },
      { $set: { createdAt: m.scheduledAt || new Date() } }
    );
    console.log(`  ✅ Fixed ${m._id}`);
  }
  
  await mongoose.disconnect();
}

fix().catch(console.error);
