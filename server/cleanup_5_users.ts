import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const phonesToDelete = [
  '60076765',
  '51608798',
  '50709749',
  '55404031',
  '66771994'
];

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  
  const userList = await users.find({ phone: { $in: phonesToDelete } }).toArray();
  
  if (userList.length === 0) {
    console.log("No users found with those phone numbers.");
    process.exit(0);
  }
  
  const objectIds = userList.map(u => u._id);
  const userIds = objectIds.map(id => id.toString());
  
  console.log(`Found ${userList.length} users to delete.`);
  userList.forEach(u => console.log(` - ${u.name} (${u.phone})`));
  
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const collection = db.collection(col.name);
    
    // Try deleting by userId (string)
    let res1 = await collection.deleteMany({ userId: { $in: userIds } });
    // Try deleting by userId (ObjectId)
    let res2 = await collection.deleteMany({ userId: { $in: objectIds } });
    // Try deleting by _id (for users collection itself)
    let res3 = await collection.deleteMany({ _id: { $in: objectIds } });
    
    const total = res1.deletedCount + res2.deletedCount + res3.deletedCount;
    if (total > 0) {
      console.log(`  ${col.name}: deleted ${total} documents`);
    }
  }
  
  console.log('\nDone! All related data cleaned up.');
  process.exit(0);
}).catch(console.error);
