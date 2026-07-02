import fetch from 'node-fetch';

async function run() {
  // First, we need a valid token. Let's get the token for taifnashmi
  const mongoose = require('mongoose');
  const dotenv = require('dotenv');
  const jwt = require('jsonwebtoken');
  dotenv.config();

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  
  // Find Taif Nashmi
  const user = await User.findById("6a30176deab158de1f8b7f8c");
  if (!user) {
    console.log("User not found");
    process.exit(1);
  }
  
  const token = jwt.sign(
    { userId: user._id, role: user.role, sessionV: user.sessionVersion || 0 },
    process.env.JWT_SECRET || 'belamonda_secret_key',
    { expiresIn: "7d" }
  );

  console.log("Fetching offers for user:", user.fullName);
  
  try {
    const res = await fetch('http://127.0.0.1:3002/api/commerce/me/offers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("Error fetching api:", e);
  }
  
  process.exit(0);
}
run();
