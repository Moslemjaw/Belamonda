import mongoose from "mongoose";

mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/test?retryWrites=true&w=majority&appName=ForAll").then(async () => {
  const schema = new mongoose.Schema({}, { strict: false });
  const Offer = mongoose.model('Offer', schema, 'offers');
  
  await Offer.updateOne({ name: '3 Sessions (Female)' }, { $set: { sessionIntervalDays: 25 } });
  console.log('Updated 3 Sessions (Female) to 25 days interval.');
  process.exit(0);
});
