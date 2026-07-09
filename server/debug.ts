import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/belamonda");
  
  // Get sessions exactly as the backend does
  const sessionDocs = await mongoose.connection.db.collection("bookingsessions")
    .find({
      notes: { $ne: "Historical session logged during enrollment" },
      scheduledAt: { $gte: new Date("2026-07-01T00:00:00Z") }
    }).sort({ scheduledAt: -1 }).limit(300).toArray();
    
  const sessionIds = sessionDocs.map(s => s._id.toString());
  const requestsForSessions = sessionIds.length > 0
    ? await mongoose.connection.db.collection("bookingrequests")
        .find({ scheduledSessionId: { $in: sessionIds } }).toArray()
    : [];
  
  const requestsBySessionMap = new Map(requestsForSessions.map(r => [r.scheduledSessionId?.toString(), r]));
  
  const enrichedSessions = sessionDocs.map(doc => {
    const req = requestsBySessionMap.get(doc._id.toString());
    return {
      id: doc._id.toString(),
      type: "session",
      status: doc.status,
      clinicPaymentStatus: req?.clinicPaymentStatus || "pending",
      requestId: req?._id?.toString()
    };
  });
  
  // Find "Awaiting" sessions based on frontend logic:
  // const attendanceStatus = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status) ? 'awaiting'
  
  const awaitingSessions = enrichedSessions.filter(s => 
    ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status)
  );
  
  console.log(`Total Awaiting Sessions (Frontend Attendance Status): ${awaitingSessions.length}`);
  
  let missingButtons = 0;
  awaitingSessions.forEach(s => {
    // Condition for Paid/Edit Price button: s.clinicPaymentStatus !== 'paid' && (s.type === 'request' || s.requestId)
    const buttonCondition = s.clinicPaymentStatus !== 'paid' && (s.type === 'request' || s.requestId);
    
    if (!buttonCondition) {
      missingButtons++;
      console.log(`Missing Button for Awaiting Session ${s.id} | paymentStatus: ${s.clinicPaymentStatus} | hasReqId: ${!!s.requestId}`);
    }
  });
  
  console.log(`\nTotal Awaiting Sessions missing buttons: ${missingButtons}`);
  
  process.exit(0);
}
run();
