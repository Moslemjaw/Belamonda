require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const staffUsers = await db.collection('users').find({
      fullName: { $regex: 'Asnanco', $options: 'i' }
    }).toArray();

    console.log("STAFF USERS:", JSON.stringify(staffUsers, null, 2));

    const alkoutClinic = await db.collection('clinics').findOne({ _id: new mongoose.Types.ObjectId("6a4d47fa9ee61c125ac0a91a") });
    console.log("ALKOUT CLINIC:", alkoutClinic ? (alkoutClinic.nameAr || alkoutClinic.name) : "Not found");

    const asnancoClinic = await db.collection('clinics').findOne({
      $or: [
        { nameAr: { $regex: 'اسنانكو' } },
        { nameEn: { $regex: 'Asnanco', $options: 'i' } }
      ]
    });
    console.log("ASNANCO CLINIC:", asnancoClinic ? (asnancoClinic.nameAr || asnancoClinic.name) : "Not found");

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
