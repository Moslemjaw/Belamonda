const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://moslem:0aXGkC0p0b7xXz8a@belamondadb.iicok.mongodb.net/belamonda?retryWrites=true&w=majority&appName=BelamondaDB')
  .then(async () => {
    const db = mongoose.connection.db;
    const docs = await db.collection('bookingsessions').find({ scheduledAt: { $lt: new Date('2026-07-01') } }).toArray();
    console.log("Total old docs:", docs.length);
    const notes = new Set(docs.map(d => d.notes));
    console.log("Notes found:", Array.from(notes));
    process.exit(0);
  });
