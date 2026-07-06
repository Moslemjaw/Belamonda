require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Fix all "confirmed" BRs that have linked completed sessions → set status to "completed"
    const confirmedBRs = await db.collection('bookingrequests').find({ status: "confirmed" }).toArray();
    console.log(`Total BRs with status 'confirmed': ${confirmedBRs.length}`);
    
    let fixedCompleted = 0;
    let fixedScheduled = 0;
    
    for (const br of confirmedBRs) {
      if (br.scheduledSessionId) {
        let session;
        try {
          session = await db.collection('bookingsessions').findOne({ _id: new mongoose.Types.ObjectId(br.scheduledSessionId) });
        } catch(e) {}
        
        if (session) {
          if (session.status === 'completed') {
            // Session completed → BR should be "completed"
            await db.collection('bookingrequests').updateOne(
              { _id: br._id },
              { $set: { status: "completed", updatedAt: new Date() } }
            );
            fixedCompleted++;
            console.log(`  Fixed BR ${br._id} → completed (session was completed)`);
          } else {
            // Session is still scheduled/other → BR should be "scheduled" (the correct valid enum value)
            await db.collection('bookingrequests').updateOne(
              { _id: br._id },
              { $set: { status: "scheduled", updatedAt: new Date() } }
            );
            fixedScheduled++;
            console.log(`  Fixed BR ${br._id} → scheduled (session was ${session.status})`);
          }
        } else {
          // No linked session found → set to "scheduled" as that's the post-confirm valid state
          await db.collection('bookingrequests').updateOne(
            { _id: br._id },
            { $set: { status: "scheduled", updatedAt: new Date() } }
          );
          fixedScheduled++;
          console.log(`  Fixed BR ${br._id} → scheduled (no linked session found)`);
        }
      } else {
        // No scheduledSessionId → set to "scheduled"
        await db.collection('bookingrequests').updateOne(
          { _id: br._id },
          { $set: { status: "scheduled", updatedAt: new Date() } }
        );
        fixedScheduled++;
        console.log(`  Fixed BR ${br._id} → scheduled (no scheduledSessionId)`);
      }
    }
    
    console.log(`\nDone! Fixed ${fixedCompleted} to 'completed', ${fixedScheduled} to 'scheduled'`);
    
    // Verify
    const remaining = await db.collection('bookingrequests').countDocuments({ status: "confirmed" });
    console.log(`Remaining BRs with status 'confirmed': ${remaining}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
