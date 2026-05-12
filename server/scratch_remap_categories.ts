import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const SessionTypeSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  nameEn: { type: String, required: true, trim: true },
  nameAr: { type: String, required: true, trim: true },
  categorySlug: { type: String, lowercase: true, trim: true, default: "other" },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  tags: { type: [String], default: [] }
}, { timestamps: true, strict: false });
const SessionTypeModel = mongoose.models.SessionType || mongoose.model("SessionType", SessionTypeSchema, "sessiontypes");

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri!, { dbName: "test" });
  console.log("Connected to MongoDB test DB");

  // Re-map categories
  const mappings = [
    { old: "laser-services", new: "laser_services" },
    { old: "body-treatments", new: "body-slimming" },
    { old: "fat-reduction", new: "body-slimming" },
    { old: "advanced-skin", new: "skin-care" },
    { old: "plasma-hair", new: "medical" },
    { old: "removal-treatments", new: "medical" },
  ];

  for (const mapping of mappings) {
    const res = await SessionTypeModel.updateMany(
      { categorySlug: mapping.old },
      { $set: { categorySlug: mapping.new } }
    );
    console.log(`Mapped ${mapping.old} -> ${mapping.new} : ${res.modifiedCount} treatments updated.`);
  }

  // Specifically fix some treatments
  await SessionTypeModel.updateOne(
    { slug: "filler-dissolving" },
    { $set: { categorySlug: "injectables" } }
  );
  await SessionTypeModel.updateOne(
    { slug: "white-hair-removal" },
    { $set: { categorySlug: "laser_services" } }
  );
  await SessionTypeModel.updateOne(
    { slug: "face-plasma-prp" },
    { $set: { categorySlug: "skin-care" } }
  );
  await SessionTypeModel.updateOne(
    { slug: "plasma-dermapen-combo" },
    { $set: { categorySlug: "skin-care" } }
  );

  console.log("Treatment re-mapping completed.");

  await mongoose.disconnect();
}

run().catch(console.error);
