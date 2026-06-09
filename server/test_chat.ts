import 'dotenv/config';
import mongoose from 'mongoose';
import { UserModel } from './src/models/user.model.js';
import { signAccessToken } from './src/modules/auth/token.js';

await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll');
const user = await UserModel.findOne({ username: 'qibla' }).lean();
const token = signAccessToken({ sub: String(user._id), role: user.role, clinicId: user.clinicId ? String(user.clinicId) : undefined });

console.log('Fetching conversations using token:', token.substring(0, 20) + '...');
try {
  const res = await fetch('http://localhost:5001/chat/conversations', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Items length:', data.items?.length);
  console.log(JSON.stringify(data, null, 2));
} catch (e) {
  console.error(e);
}
process.exit(0);
