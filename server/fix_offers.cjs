const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/belamonda');
  const Offer = mongoose.model('Offer', new mongoose.Schema({}, { strict: false }));
  const res = await Offer.updateMany({ allowAppointmentBooking: false }, { $set: { allowAppointmentBooking: true } });
  console.log(res);
  process.exit(0);
}
run();
