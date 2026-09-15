/**
 * Fix script: Restore original scheduledAt for sessions marked completed today (15/9/2026).
 *
 * The bug in scheduling.router.ts was overwriting scheduledAt with completedAt
 * when marking sessions as completed. This script:
 *   1. Finds all BookingSessions with status="completed" and completedAt on 15/9/2026
 *   2. For each, looks up the linked BookingRequest via bookingRequestId or scheduledSessionId
 *   3. Restores scheduledAt from the BookingRequest's proposedAt / clinicScheduledAt / preferredAt
 *
 * Usage:  node --experimental-specifier-resolution=node server/scripts/fix-completed-dates.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "server", ".env") });

const MONGO_URI = process.env.MONGODB_URI;

const BookingSessionSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const BookingRequestSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const BookingSession = mongoose.model("BookingSession", BookingSessionSchema);
const BookingRequest = mongoose.model("BookingRequest", BookingRequestSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Find sessions completed today (15 Sep 2026)
  const todayStart = new Date("2026-09-15T00:00:00.000Z");
  const todayEnd   = new Date("2026-09-15T23:59:59.999Z");

  const completedToday = await BookingSession.find({
    status: "completed",
    completedAt: { $gte: todayStart, $lte: todayEnd }
  }).lean();

  console.log(`Found ${completedToday.length} sessions completed today`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const session of completedToday) {
    const sessionId = session._id.toString();
    const currentScheduledAt = session.scheduledAt;

    // Check if scheduledAt was overwritten to today
    if (currentScheduledAt) {
      const schedDate = new Date(currentScheduledAt);
      if (schedDate < todayStart || schedDate > todayEnd) {
        console.log(`  [SKIP] Session ${sessionId} - scheduledAt (${schedDate.toISOString()}) is NOT today, already correct`);
        skippedCount++;
        continue;
      }
    }

    // Find the linked booking request
    let breq = null;

    // Try by bookingRequestId on the session
    if (session.bookingRequestId) {
      breq = await BookingRequest.findById(session.bookingRequestId).lean();
    }

    // Try by scheduledSessionId on request
    if (!breq) {
      breq = await BookingRequest.findOne({ scheduledSessionId: sessionId }).lean();
    }

    if (!breq) {
      console.log(`  [WARN] Session ${sessionId} - no linked booking request found, cannot restore date`);
      skippedCount++;
      continue;
    }

    // Determine the original date from the booking request
    const originalDate = breq.proposedAt || breq.clinicScheduledAt || breq.adminSuggestedAt || breq.preferredAt;

    if (!originalDate) {
      console.log(`  [WARN] Session ${sessionId} - booking request ${breq._id} has no date fields, cannot restore`);
      skippedCount++;
      continue;
    }

    const origDateObj = new Date(originalDate);

    // Only fix if the original date is different from today
    if (origDateObj >= todayStart && origDateObj <= todayEnd) {
      console.log(`  [SKIP] Session ${sessionId} - original date is also today (${origDateObj.toISOString()}), no fix needed`);
      skippedCount++;
      continue;
    }

    console.log(`  [FIX] Session ${sessionId}: scheduledAt ${new Date(currentScheduledAt).toISOString()} → ${origDateObj.toISOString()}`);

    await BookingSession.findByIdAndUpdate(sessionId, {
      $set: { scheduledAt: origDateObj }
    });

    fixedCount++;
  }

  console.log(`\nDone. Fixed: ${fixedCount}, Skipped: ${skippedCount}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
