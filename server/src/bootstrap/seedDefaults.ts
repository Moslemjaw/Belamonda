import { CategoryModel } from "../models/category.model.js";
import { ClinicModel } from "../models/clinic.model.js";
import { UserModel } from "../models/user.model.js";
import bcrypt from "bcryptjs";

const DEFAULT_CATEGORIES: Array<{
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
}> = [
  { slug: "laser", nameEn: "Laser", nameAr: "ليزر", sortOrder: 0 },
  { slug: "beauty", nameEn: "Beauty", nameAr: "تجميل", sortOrder: 1 },
  { slug: "skincare", nameEn: "Skincare", nameAr: "عناية بالبشرة", sortOrder: 2 },
  { slug: "other", nameEn: "Other", nameAr: "أخرى", sortOrder: 3 }
];

export async function seedDefaultCategories(): Promise<void> {
  const existing = await CategoryModel.countDocuments();
  if (existing > 0) return;
  await CategoryModel.insertMany(
    DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      isActive: true
    }))
  );
}

const DEFAULT_CLINICS: Array<{ key: string; nameEn: string; nameAr: string }> = [
  { key: "qibla", nameEn: "Qibla Clinic", nameAr: "مركز القبلة" },
  { key: "nova", nameEn: "Nova Clinic", nameAr: "مركز نوفا" },
  { key: "marina_5", nameEn: "Marina 5", nameAr: "مارينا 5" }
];

/**
 * Local/dev bootstrap:
 * - Creates clinic records and demo users if DB is empty.
 * - Safe for re-runs (idempotent).
 */
export async function seedLocalDemoUsersAndClinics(): Promise<void> {
  // If you already have users, don't touch anything.
  const hasUsers = (await UserModel.countDocuments()) > 0;
  if (hasUsers) return;

  const createdClinics = new Map<string, string>(); // key -> clinicId
  for (const c of DEFAULT_CLINICS) {
    const doc = await ClinicModel.create({
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      address: "Kuwait",
      active: true
    });
    createdClinics.set(c.key, doc._id.toString());
  }

  const demoPassword = "demo12345";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  await UserModel.create([
    { username: "cust1", passwordHash, role: "customer", isActive: true },
    { username: "admin1", passwordHash, role: "admin", isActive: true },
    { username: "cs1", passwordHash, role: "cs", isActive: true },
    { username: "fin1", passwordHash, role: "finance", isActive: true },
    {
      username: "clinic_qibla",
      passwordHash,
      role: "clinicStaff",
      isActive: true,
      clinicId: createdClinics.get("qibla")
    },
    {
      username: "clinic_nova",
      passwordHash,
      role: "clinicStaff",
      isActive: true,
      clinicId: createdClinics.get("nova")
    },
    {
      username: "clinic_marina_5",
      passwordHash,
      role: "clinicStaff",
      isActive: true,
      clinicId: createdClinics.get("marina_5")
    }
  ] as any);
}
