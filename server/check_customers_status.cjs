require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const inputList = [
  { phone: "55575900", dateStr: "2026-07-12" },
  { phone: "50810035", dateStr: "2026-07-12" },
  { phone: "94111075", dateStr: "2026-07-16" },
  { phone: "60067703", dateStr: "2026-07-26" },
  { phone: "94111075", dateStr: "2026-08-05" },
  { phone: "55575900", dateStr: "2026-08-08" },
  { phone: "50810035", dateStr: "2026-08-10" },
  { phone: "65029032", dateStr: "2026-08-12" },
  { phone: "66692224", dateStr: "2026-08-19" },
  { phone: "66033160", dateStr: "2026-08-19" },
  { phone: "64446088", dateStr: "2026-08-20" },
  { phone: "51227057", dateStr: "2026-08-24" },
  { phone: "94725861", dateStr: "2026-08-24" },
  { phone: "50100670", dateStr: "2026-08-24" },
  { phone: "50523103", dateStr: "2026-08-24" },
  { phone: "99532776", dateStr: "2026-08-24" },
  { phone: "50768703", dateStr: "2026-08-25" },
  { phone: "97994606", dateStr: "2026-08-30" },
  { phone: "66936468", dateStr: "2026-08-31" },
  { phone: "97858533", dateStr: "2026-08-31" }
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const usersCol = db.collection('users');
    const sessionsCol = db.collection('bookingsessions');
    const requestsCol = db.collection('bookingrequests');
    const scansCol = db.collection('scanlogs');
    const userOffersCol = db.collection('useroffers');
    const offersCol = db.collection('offers');
    const clinicsCol = db.collection('clinics');

    const allClinics = await clinicsCol.find({}).toArray();
    const clinicMap = {};
    allClinics.forEach(c => { clinicMap[c._id.toString()] = c.nameAr || c.name || c.nameEn; });

    const allOffers = await offersCol.find({}).toArray();
    const offerMap = {};
    allOffers.forEach(o => { offerMap[o._id.toString()] = o.titleAr || o.titleEn || o.title || o.name; });

    const results = [];

    for (let i = 0; i < inputList.length; i++) {
      const item = inputList[i];
      const cleanPhone = item.phone.trim();
      const targetDate = item.dateStr;

      const users = await usersCol.find({
        $or: [
          { phone: cleanPhone },
          { phone: { $regex: cleanPhone } }
        ]
      }).toArray();

      if (users.length === 0) {
        results.push({
          row: i + 1,
          inputPhone: cleanPhone,
          targetDate: targetDate,
          userFound: false,
          user: null,
          sessions: [],
          requests: [],
          scans: [],
          userOffersCount: 0
        });
        continue;
      }

      for (const user of users) {
        const userIdStr = user._id.toString();

        const userOffers = await userOffersCol.find({
          $or: [ { userId: userIdStr }, { userId: user._id } ]
        }).toArray();

        const userOffersDetails = userOffers.map(uo => ({
          _id: uo._id,
          offerTitle: offerMap[uo.offerId?.toString()] || uo.offerId,
          clinicName: clinicMap[uo.clinicId?.toString()] || uo.clinicId,
          totalSessions: uo.totalSessions,
          usedSessions: uo.usedSessions,
          remainingSessions: uo.remainingSessions,
          createdAt: uo.createdAt
        }));

        const sessions = await sessionsCol.find({
          $or: [ { userId: userIdStr }, { userId: user._id } ]
        }).toArray();

        const formattedSessions = sessions.map(s => ({
          _id: s._id,
          shortId: s.shortId,
          scheduledAt: s.scheduledAt,
          status: s.status,
          clinicName: clinicMap[s.clinicId?.toString()] || s.clinicId,
          offerTitle: offerMap[s.offerId?.toString()] || s.offerId,
          finalPaidKwd: s.finalPaidKwd,
          notes: s.notes,
          createdAt: s.createdAt
        }));

        const requests = await requestsCol.find({
          $or: [ { userId: userIdStr }, { userId: user._id } ]
        }).toArray();

        const formattedRequests = requests.map(r => ({
          _id: r._id,
          status: r.status,
          preferredAt: r.preferredAt,
          clinicScheduledAt: r.clinicScheduledAt,
          clinicName: clinicMap[r.clinicId?.toString()] || r.clinicId,
          offerTitle: offerMap[r.offerId?.toString()] || r.offerId,
          rejectionReason: r.rejectionReason,
          notes: r.notes,
          createdAt: r.createdAt
        }));

        const scans = await scansCol.find({
          $or: [ { userId: userIdStr }, { userId: user._id } ]
        }).toArray();

        const formattedScans = scans.map(sc => ({
          _id: sc._id,
          status: sc.status,
          offerName: sc.offerName,
          hadScheduledSession: sc.hadScheduledSession,
          clinicName: clinicMap[sc.clinicId?.toString()] || sc.clinicId,
          scannedAt: sc.scannedAt,
          createdAt: sc.createdAt
        }));

        results.push({
          row: i + 1,
          inputPhone: cleanPhone,
          targetDate: targetDate,
          userFound: true,
          user: {
            id: userIdStr,
            shortId: user.shortId,
            fullName: user.fullName,
            phone: user.phone,
            createdAt: user.createdAt
          },
          userOffersCount: userOffers.length,
          userOffers: userOffersDetails,
          sessions: formattedSessions,
          requests: formattedRequests,
          scans: formattedScans
        });
      }
    }

    fs.writeFileSync('output_results.json', JSON.stringify(results, null, 2));
    console.log("SUCCESSFULLY WRITTEN TO output_results.json");

  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
