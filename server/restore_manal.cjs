require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.collection('bookingrequests').updateOne(
    { _id: new mongoose.Types.ObjectId('6a9438f4de987094a2f2f155') },
    { $set: { shownAt: new Date('2026-09-10T10:50:54.053Z') } }
  );
  console.log("Restored Manal request shownAt to 2026-09-10T10:50:54.053Z");
  process.exit(0);
}

run();
