require('dotenv').config();
const mongoose = require('mongoose');

// Replicate the exact schema
const BookingRequestSchema = new mongoose.Schema({
  userId: String,
  clinicId: String,
  status: {
    type: String,
    enum: [
      "request_received", "slot_assigned", "scheduled", "checked_in",
      "in_progress", "completed", "cancelled", "rescheduled", "no_show"
    ],
    default: "request_received"
  },
  scheduledSessionId: String,
  clinicPaymentStatus: String,
}, { timestamps: true });

const BR = mongoose.model('BookingRequest', BookingRequestSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const brId = '6a3d8ea0004c270a9834a568';
    
    // Try to update status from "confirmed" -> "completed" using Mongoose
    console.log("Attempting to update BR status from 'confirmed' to 'completed' via Mongoose...");
    try {
      const result = await BR.findByIdAndUpdate(
        brId,
        { $set: { status: "completed" } },
        { new: true, runValidators: true }
      );
      console.log("Result:", result ? `status=${result.status}` : "null");
    } catch (err) {
      console.error("Mongoose update failed:", err.message);
    }
    
    // Verify
    const doc = await mongoose.connection.db.collection('bookingrequests').findOne({ _id: new mongoose.Types.ObjectId(brId) });
    console.log("\nAfter update - Raw DB status:", doc?.status);
    console.log("After update - Raw DB updatedAt:", doc?.updatedAt);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
