require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Step 1: Find the user
    const users = await db.collection('users').find({
      $or: [
        { phone: { $regex: '50104408' } },
        { phone: '50104408' },
        { phone: '+96550104408' },
        { fullName: { $regex: /أماني/i } },
        { fullName: { $regex: /amani/i } }
      ]
    }).toArray();
    
    console.log("=== USERS FOUND ===");
    console.log("Count:", users.length);
    
    for (const u of users) {
      console.log(`\nUser: ${u.fullName} | Phone: ${u.phone} | _id: ${u._id}`);
      const userId = u._id.toString();
      
      // Step 2: Find BookingRequests for this user
      const breqs = await db.collection('bookingrequests').find({ userId: userId }).toArray();
      console.log(`\n  --- Booking Requests (${breqs.length}) ---`);
      for (const br of breqs) {
        console.log(`  BR _id: ${br._id}`);
        console.log(`    status: ${br.status}`);
        console.log(`    clinicPaymentStatus: ${br.clinicPaymentStatus}`);
        console.log(`    scheduledSessionId: ${br.scheduledSessionId}`);
        console.log(`    clinicId: ${br.clinicId}`);
        console.log(`    isStandalone: ${br.isStandalone}`);
        console.log(`    standaloneName: ${br.standaloneName}`);
        console.log(`    createdAt: ${br.createdAt}`);
        
        // Step 3: If there's a linked session, check it
        if (br.scheduledSessionId) {
          let session;
          try {
            session = await db.collection('bookingsessions').findOne({ _id: new mongoose.Types.ObjectId(br.scheduledSessionId) });
          } catch(e) {
            session = await db.collection('bookingsessions').findOne({ _id: br.scheduledSessionId });
          }
          if (session) {
            console.log(`    >>> Linked Session:`);
            console.log(`        session._id: ${session._id}`);
            console.log(`        session.status: ${session.status}`);
            console.log(`        session.scheduledAt: ${session.scheduledAt}`);
            console.log(`        session.completedAt: ${session.completedAt}`);
            console.log(`        session.clinicId: ${session.clinicId}`);
            
            // CHECK FOR DESYNC
            if (session.status === 'completed' && br.clinicPaymentStatus !== 'paid') {
              console.log(`    *** DESYNC DETECTED: Session is completed but BR payment is ${br.clinicPaymentStatus} ***`);
            }
            if (session.status === 'completed' && br.status !== 'completed') {
              console.log(`    *** DESYNC DETECTED: Session is completed but BR status is ${br.status} ***`);
            }
            if (session.status !== 'completed' && br.status === 'completed') {
              console.log(`    *** DESYNC DETECTED: BR is completed but session status is ${session.status} ***`);
            }
          } else {
            console.log(`    >>> WARNING: scheduledSessionId ${br.scheduledSessionId} NOT FOUND in bookingsessions`);
          }
        }
      }
      
      // Step 4: Find BookingSessions for this user directly
      const sessions = await db.collection('bookingsessions').find({ userId: userId }).toArray();
      console.log(`\n  --- Booking Sessions (${sessions.length}) ---`);
      for (const s of sessions) {
        console.log(`  Session _id: ${s._id}`);
        console.log(`    status: ${s.status}`);
        console.log(`    scheduledAt: ${s.scheduledAt}`);
        console.log(`    completedAt: ${s.completedAt}`);
        console.log(`    clinicId: ${s.clinicId}`);
        
        // Check if there's a matching booking request
        const matchingBR = await db.collection('bookingrequests').findOne({ scheduledSessionId: s._id.toString() });
        if (matchingBR) {
          console.log(`    >>> Has matching BR: ${matchingBR._id}, status=${matchingBR.status}, payment=${matchingBR.clinicPaymentStatus}`);
        } else {
          console.log(`    >>> No matching BookingRequest found for this session`);
        }
      }
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
