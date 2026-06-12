import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const userOffers = db.collection('useroffers');
  
  // Nuraan Al Sharif ID as string
  const userIdStr = "6a2a7a8eaae09ee0efb0348f";
  
  // Find all their packages (check both string and ObjectId just in case)
  const packages = await userOffers.find({ 
    $or: [
      { userId: userIdStr },
      { userId: new mongoose.Types.ObjectId(userIdStr) }
    ]
  }).toArray();
  
  console.log(`Found ${packages.length} packages for the user.`);
  
  // Sort by _id (which is basically timestamp) ascending
  packages.sort((a, b) => {
    if (a._id < b._id) return -1;
    if (a._id > b._id) return 1;
    return 0;
  });
  
  // Keep the first one, delete the rest
  for (let i = 1; i < packages.length; i++) {
    const pkg = packages[i];
    await userOffers.deleteOne({ _id: pkg._id });
    console.log(`Deleted duplicate package ${pkg._id}`);
  }
  
  console.log("Cleanup complete.");
  process.exit(0);
}).catch(console.error);
