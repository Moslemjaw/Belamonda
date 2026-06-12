import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const userIds = [
  '6a2a5a831e05c85ea7152385',
  '6a293d93e978be541f848a24',
  '6a293a16e978be541f84896c',
  '6a12d1da7022845c74a0dc45',
  '6a293712e978be541f8487ed',
];

const objectIds = userIds.map(id => new mongoose.Types.ObjectId(id));

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  console.log('Collections:', collections.map(c => c.name).join(', '));
  
  for (const col of collections) {
    const collection = db.collection(col.name);
    
    // Try deleting by userId (string)
    let res1 = await collection.deleteMany({ userId: { $in: userIds } });
    // Try deleting by userId (ObjectId)
    let res2 = await collection.deleteMany({ userId: { $in: objectIds } });
    // Try deleting by _id (for users collection itself, already deleted but just in case)
    let res3 = await collection.deleteMany({ _id: { $in: objectIds } });
    
    const total = res1.deletedCount + res2.deletedCount + res3.deletedCount;
    if (total > 0) {
      console.log(`  ${col.name}: deleted ${total} documents`);
    }
  }
  
  console.log('\nDone! All related data cleaned up.');
  process.exit(0);
}).catch(console.error);
