import mongoose from "mongoose";

mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/test?retryWrites=true&w=majority&appName=ForAll").then(async () => {
  const uoSchema = new mongoose.Schema({}, { strict: false });
  const UserOffer = mongoose.model('UserOffer', uoSchema, 'useroffers');
  const bsSchema = new mongoose.Schema({}, { strict: false });
  const BookingSession = mongoose.model('BookingSession', bsSchema, 'bookingsessions');
  
  const offers = await UserOffer.find({ sessionsUsed: { $gt: 0 }, lastManualSessionAt: { $exists: false } });
  for (const o of offers) {
    const hasSession = await BookingSession.findOne({ userOfferId: o._id, status: 'completed' });
    if (!hasSession) {
      await UserOffer.updateOne({ _id: o._id }, { $set: { lastManualSessionAt: o.updatedAt || new Date() } });
      console.log('Fixed', o._id);
    }
  }
  process.exit(0);
});
