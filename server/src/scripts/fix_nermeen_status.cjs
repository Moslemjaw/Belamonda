const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const BookingRequestSchema = new mongoose.Schema({}, { strict: false });
const BookingRequest = mongoose.model("BookingRequest", BookingRequestSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to DB");

  // Update request 6a80574d0daa63ec5df726c2 to status 'cancelled'
  const res = await BookingRequest.findByIdAndUpdate("6a80574d0daa63ec5df726c2", {
    $set: { status: "cancelled" }
  });

  console.log("Updated Nermeen's Aug 15 request to 'cancelled':", res ? res._id.toString() : "Not found");

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
