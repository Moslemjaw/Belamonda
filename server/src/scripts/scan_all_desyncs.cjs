require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Find all BRs with status "confirmed" that have a linked completed session
    const confirmedBRs = await db.collection('bookingrequests').find({ status: "confirmed" }).toArray();
    console.log(`Total BRs with status 'confirmed': ${confirmedBRs.length}`);
    
    let desyncCount = 0;
    const desynced = [];
    
    for (const br of confirmedBRs) {
      if (br.scheduledSessionId) {
        let session;
        try {
          session = await db.collection('bookingsessions').findOne({ _id: new mongoose.Types.ObjectId(br.scheduledSessionId) });
        } catch(e) {}
        
        if (session && session.status === 'completed') {
          desyncCount++;
          desynced.push({
            brId: br._id.toString(),
            sessionId: br.scheduledSessionId,
            brStatus: br.status,
            sessionStatus: session.status,
            brPayment: br.clinicPaymentStatus,
            userId: br.userId
          });
        }
      }
    }
    
    console.log(`\nDesynced BRs (confirmed but session is completed): ${desyncCount}`);
    for (const d of desynced) {
      // Look up user name
      const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(d.userId) });
      console.log(`  BR: ${d.brId} | Session: ${d.sessionId} | Payment: ${d.brPayment} | User: ${user?.fullName || 'Unknown'}`);
    }
    
    // Also check for "confirmed" BRs without a linked session
    const noSession = confirmedBRs.filter(br => !br.scheduledSessionId);
    console.log(`\nConfirmed BRs without scheduledSessionId: ${noSession.length}`);
    
    // BRs with "confirmed" status + linked session that is NOT completed
    const notCompletedSession = [];
    for (const br of confirmedBRs) {
      if (br.scheduledSessionId) {
        let session;
        try {
          session = await db.collection('bookingsessions').findOne({ _id: new mongoose.Types.ObjectId(br.scheduledSessionId) });
        } catch(e) {}
        if (session && session.status !== 'completed') {
          notCompletedSession.push({
            brId: br._id.toString(),
            sessionId: br.scheduledSessionId,
            sessionStatus: session.status,
            brPayment: br.clinicPaymentStatus
          });
        }
      }
    }
    console.log(`Confirmed BRs with non-completed sessions: ${notCompletedSession.length}`);
    for (const d of notCompletedSession) {
      console.log(`  BR: ${d.brId} | Session: ${d.sessionId} | SessionStatus: ${d.sessionStatus} | Payment: ${d.brPayment}`);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
