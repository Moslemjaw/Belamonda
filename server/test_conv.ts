import 'dotenv/config';
import mongoose from 'mongoose';
import { chatStore } from './src/modules/chat/chat.store.js';
import { bookingRequestsStore } from './src/modules/scheduling/bookingRequests.store.js';
import { ensureConversationFor } from './src/modules/scheduling/scheduling.router.js';

await mongoose.connect('mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll');
const breqId = '6a14a97c5e94c5d59a4ad590';
const res = await ensureConversationFor(breqId);
console.log(JSON.stringify(res.conv, null, 2));
process.exit(0);
