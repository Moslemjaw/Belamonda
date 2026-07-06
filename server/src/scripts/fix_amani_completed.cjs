require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const users = await db.collection('users').find({
      fullName: { $regex: /اماني ابراهيم/i }
    }).toArray();
    
    for (const user of users) {
      if (user.phone !== "65165533") continue;
      
      const userId = user._id.toString();
      
      // Get her booking request
      const br = await db.collection('bookingrequests').findOne({ userId: userId });
      if (br && br.status === "awaiting_session_payment") {
        await db.collection('bookingrequests').updateOne(
          { _id: br._id },
          { 
            $set: { 
              status: "completed",
              clinicPaymentStatus: "paid"
            } 
          }
        );
        console.log(`Updated BookingRequest ${br._id} to completed/paid for user ${user.fullName}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
