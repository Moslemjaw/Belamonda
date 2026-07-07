require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const form = await db.collection('eforms').findOne({ _id: new mongoose.Types.ObjectId('6a2db8bb4ba4fee087ad9e77') });
    console.log("Form:", form);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
