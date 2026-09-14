require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const session = await db.collection('bookingsessions').findOne({ shortId: 's0004142' });
    console.log("SESSION s0004142:", JSON.stringify(session, null, 2));

    const user = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(session.userId) });
    console.log("USER:", JSON.stringify(user, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
