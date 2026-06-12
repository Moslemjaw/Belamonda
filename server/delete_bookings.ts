import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db!;
  const users = db.collection('users');

  // Find nermeen mohammad alaahwany
  const user = await users.findOne({ fullName: /nermeen/i });
  if (!user) {
    console.log("User not found by fullName, trying username...");
    const user2 = await users.findOne({ username: /nermeen/i });
    if (!user2) {
      console.log("User not found");
      process.exit(1);
    }
  }

  const u = user || (await users.findOne({ username: /nermeen/i }));
  console.log(`Found user: ${u!.fullName} (Phone: ${u!.phone}, ID: ${u!._id})`);
  const userId = String(u!._id);

  // List all collections to find booking-related ones
  const collections = await db.listCollections().toArray();
  console.log("\nAll collections:", collections.map(c => c.name).join(", "));

  // Delete from bookingsessions
  const bookingSessions = db.collection('bookingsessions');
  const bsResult = await bookingSessions.deleteMany({
    $or: [{ userId }, { userId: u!._id }]
  });
  console.log(`\nDeleted ${bsResult.deletedCount} booking sessions.`);

  // Delete from payments
  const payments = db.collection('payments');
  const pResult = await payments.deleteMany({
    $or: [{ userId }, { userId: u!._id }]
  });
  console.log(`Deleted ${pResult.deletedCount} payments.`);

  // Check for any other booking/request related collections
  for (const col of collections) {
    if (col.name.includes('booking') || col.name.includes('request') || col.name.includes('session')) {
      if (col.name === 'bookingsessions') continue; // already handled
      const collection = db.collection(col.name);
      const result = await collection.deleteMany({
        $or: [{ userId }, { userId: u!._id }]
      });
      if (result.deletedCount > 0) {
        console.log(`Deleted ${result.deletedCount} from ${col.name}.`);
      }
    }
  }

  console.log("\nDone!");
  process.exit(0);
}).catch(console.error);
