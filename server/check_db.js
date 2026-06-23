import mongoose from "mongoose";

mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/test?retryWrites=true&w=majority&appName=ForAll").then(async () => {
  const schema = new mongoose.Schema({}, { strict: false });
  const Offer = mongoose.model('Offer', schema, 'offers');
  const UserOffer = mongoose.model('UserOffer', schema, 'useroffers');
  
  const o = await Offer.findOne({ name: '3 Sessions (Female)' }).lean();
  console.log('Offer sessionIntervalDays:', o.sessionIntervalDays);
  
  const uos = await UserOffer.find({ offerId: o._id, sessionsUsed: { $gt: 0 } }).lean();
  for (const uo of uos) {
    console.log('UserOffer lastManualSessionAt:', uo.lastManualSessionAt);
  }
  process.exit(0);
});
