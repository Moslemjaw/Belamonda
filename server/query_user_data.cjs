require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Find the user first
    const user = await db.collection('users').findOne({ phone: '50104408' });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User:', { id: user._id, name: user.fullName });
    
    // Find all their userOffers
    const offers = await db.collection('userOffers').find({ userId: user._id.toString() }).toArray();
    console.log('User Offers:', offers.length);
    
    // Check submissions
    const submissions = await db.collection('submissions').find({ userId: user._id.toString() }).toArray();
    console.log('Submissions:', submissions.length);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
