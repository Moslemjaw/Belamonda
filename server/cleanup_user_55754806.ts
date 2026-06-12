import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  
  const userList = await users.find({ phone: '55754806' }).toArray();
  
  if (userList.length === 0) {
    console.log("No user found with phone 55754806");
    process.exit(0);
  }
  
  const objectIds = userList.map(u => u._id);
  const userIds = objectIds.map(id => id.toString());
  
  console.log(`Found ${userList.length} users with phone 55754806.`);
  
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
