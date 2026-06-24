require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const users = await db.collection('users').find({
      fullName: { $regex: 'عالية', $options: 'i' }
    }).toArray();
    
    console.log(JSON.stringify(users.map(u => ({_id: u._id, username: u.username, phone: u.phone, fullName: u.fullName})), null, 2));
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
