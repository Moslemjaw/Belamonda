require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Get the raw document to see exactly what's in the DB
    const br = await db.collection('bookingrequests').findOne({ _id: new mongoose.Types.ObjectId('6a3d8ea0004c270a9834a568') });
    console.log("=== RAW BookingRequest Document ===");
    console.log(JSON.stringify(br, null, 2));
    
    console.log("\n=== RAW BookingSession Document ===");
    const sess = await db.collection('bookingsessions').findOne({ _id: new mongoose.Types.ObjectId('6a40e17544c2ab598ba1d888') });
    console.log(JSON.stringify(sess, null, 2));
    
    // Check if "confirmed" is stored in status
    console.log("\n=== STATUS CHECK ===");
    console.log("BR status:", br?.status);
    console.log("Session status:", sess?.status);
    console.log("BR clinicPaymentStatus:", br?.clinicPaymentStatus);
    
    // Check if there are OTHER booking requests with status "confirmed" 
    const confirmedCount = await db.collection('bookingrequests').countDocuments({ status: "confirmed" });
    console.log("\nTotal BRs with status 'confirmed':", confirmedCount);
    
    // Check what the status was at confirm time — look for confirmedAt
    console.log("\nBR confirmedAt:", br?.confirmedAt);
    console.log("BR confirmedBy:", br?.confirmedBy);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
