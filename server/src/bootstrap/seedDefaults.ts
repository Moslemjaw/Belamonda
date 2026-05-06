import { CategoryModel } from "../models/category.model.js";
import { ClinicModel } from "../models/clinic.model.js";
import { SessionTypeModel } from "../models/sessionType.model.js";
import { OfferModel } from "../models/offer.model.js";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model.js";
import bcrypt from "bcryptjs";

const DEFAULT_CATEGORIES: Array<{
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
}> = [
  { slug: "laser", nameEn: "Laser Services", nameAr: "خدمات الليزر", sortOrder: 0 },
  { slug: "injectables", nameEn: "Injectables", nameAr: "الحقن", sortOrder: 1 },
  { slug: "skincare", nameEn: "Skin Care", nameAr: "العناية بالبشرة", sortOrder: 2 },
  { slug: "beauty", nameEn: "Beauty Enhancements", nameAr: "التحسينات التجميلية", sortOrder: 3 },
  { slug: "body", nameEn: "Body & Slimming", nameAr: "الجسم والتخسيس", sortOrder: 4 },
  { slug: "dental", nameEn: "Dental Services", nameAr: "خدمات الأسنان", sortOrder: 5 },
  { slug: "medical", nameEn: "Medical & Meditation", nameAr: "الطب والتأمل", sortOrder: 6 },
  { slug: "other", nameEn: "Other", nameAr: "أخرى", sortOrder: 999 }
];

export async function seedDefaultCategories(): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await CategoryModel.updateOne(
      { slug: c.slug },
      {
        $set: {
          nameEn: c.nameEn,
          nameAr: c.nameAr,
          sortOrder: c.sortOrder
        },
        $setOnInsert: { isActive: true }
      },
      { upsert: true }
    );
  }
}

const DEFAULT_SESSION_TYPES: Array<{
  slug: string;
  nameEn: string;
  nameAr: string;
  tags: string[];
}> = [
  { slug: "filler-italian", nameEn: "Filler (Italian)", nameAr: "فيلر إيطالي", tags: ["injectables"] },
  { slug: "filler-princess", nameEn: "Filler (Princess)", nameAr: "فيلر برنسس", tags: ["injectables"] },
  { slug: "botox", nameEn: "Botox", nameAr: "بوتوكس", tags: ["injectables"] },
  { slug: "hydrafacial", nameEn: "Hydrafacial", nameAr: "هايدرا فيشل", tags: ["skincare"] },
  { slug: "dermapen", nameEn: "Dermapen (Microneedling)", nameAr: "ديرمابن", tags: ["skincare"] },
  { slug: "face-prp", nameEn: "Face Plasma (PRP)", nameAr: "بلازما الوجه", tags: ["beauty"] },
  { slug: "hair-prp", nameEn: "Hair Plasma (PRP)", nameAr: "بلازما الشعر", tags: ["beauty"] },
  { slug: "body-slimming", nameEn: "Body Slimming", nameAr: "تخسيس الجسم", tags: ["body"] },
  { slug: "fractional-laser", nameEn: "Fractional Laser", nameAr: "فراكشنال ليزر", tags: ["laser"] },
  { slug: "pico-laser", nameEn: "Pico Laser", nameAr: "بيكو ليزر", tags: ["laser"] },
  { slug: "teeth-cleaning", nameEn: "Teeth Cleaning", nameAr: "تنظيف أسنان", tags: ["dental"] },
  { slug: "teeth-whitening", nameEn: "Teeth Whitening", nameAr: "تبييض الأسنان", tags: ["dental"] },
  { slug: "physiotherapy", nameEn: "Physiotherapy Sessions", nameAr: "جلسات علاج طبيعي", tags: ["medical"] },
  { slug: "glutathione-drip", nameEn: "Glutathione Drip", nameAr: "إبرة الجلوتاثيون", tags: ["medical"] }
];

export async function seedDefaultSessionTypes(): Promise<void> {
  const categories = await CategoryModel.find({}).select("_id slug").lean();
  const catBySlug = new Map(categories.map((c: any) => [String(c.slug), c._id]));
  for (const s of DEFAULT_SESSION_TYPES) {
    const primaryCategorySlug = s.tags[0] || "other";
    const categoryId = catBySlug.get(primaryCategorySlug) ?? catBySlug.get("other");
    if (!categoryId) continue;
    await SessionTypeModel.updateOne(
      { slug: s.slug },
      {
        $set: {
          categoryId,
          nameEn: s.nameEn,
          nameAr: s.nameAr,
          tags: s.tags
        },
        $setOnInsert: { isActive: true }
      },
      { upsert: true }
    );
  }
}

const DEFAULT_OFFERS: Array<{
  name: string;
  type: "A" | "B";
  categorySlug: string;
  subscriptionPriceKwd: string;
  validityDays: number;
  description: string;
  imageUrl?: string;
  isCashbackOnly?: boolean;
  signupCashbackKwd?: string;
  cashbackActivationFeeKwd?: string;
  tagsEn?: string[];
  tagsAr?: string[];
  allowFullPayment?: boolean;
  allowInstallments?: boolean;
  maxInstallments?: number;
  allowDeposit?: boolean;
  depositAmountKwd?: string;
}> = [
  {
    name: "Mini Jamali Card Offer",
    type: "A",
    categorySlug: "beauty",
    subscriptionPriceKwd: "39.000",
    validityDays: 365,
    description: "600 KWD credit card (500 cashback + 100 services).",
    imageUrl:
      "https://images.unsplash.com/photo-1616394584738-fc6e612e71c9?auto=format&fit=crop&q=80&w=800",
    isCashbackOnly: true,
    signupCashbackKwd: "500.000",
    cashbackActivationFeeKwd: "0.000",
    tagsEn: ["600 KWD Cashback", "6 Months", "All Beauty Services"],
    tagsAr: ["كاش باك 600 دك", "6 أشهر", "جميع خدمات التجميل"],
    allowFullPayment: true,
    allowInstallments: false,
    maxInstallments: 1,
    allowDeposit: false,
    depositAmountKwd: "0.000"
  },
  { name: "Pain Relief Package (6 sessions)", type: "A", categorySlug: "medical", subscriptionPriceKwd: "146.000", validityDays: 180, description: "Physical therapy package with 6 sessions." },
  { name: "Laser Offer (Stomach + Back, 3 sessions)", type: "A", categorySlug: "laser", subscriptionPriceKwd: "49.000", validityDays: 120, description: "3 laser sessions + Jamali cashback context." },
  { name: "Full Body Laser (incl. stomach & back)", type: "A", categorySlug: "laser", subscriptionPriceKwd: "19.000", validityDays: 365, description: "Per session full body laser." },
  { name: "Morning Offer / Annual Membership", type: "A", categorySlug: "laser", subscriptionPriceKwd: "79.000", validityDays: 365, description: "Annual membership with special laser pricing." },
  { name: "Physical Therapy Package (Version 2)", type: "A", categorySlug: "medical", subscriptionPriceKwd: "146.000", validityDays: 180, description: "Another physical therapy package variant." },
  { name: "Unlimited Laser Membership (Naomi)", type: "A", categorySlug: "laser", subscriptionPriceKwd: "99.000", validityDays: 365, description: "Unlimited laser sessions annual membership." },
  { name: "6 Full Body Laser Sessions", type: "A", categorySlug: "laser", subscriptionPriceKwd: "89.000", validityDays: 180, description: "6 sessions package." }
];

export async function seedDefaultOffers(): Promise<void> {
  const categories = await CategoryModel.find({}).select("_id slug").lean();
  const catBySlug = new Map(categories.map((c: any) => [String(c.slug), c._id]));
  const clinic = (await ClinicModel.findOne({ active: true }).select("_id").lean()) as any;
  if (!clinic?._id) return;
  for (const o of DEFAULT_OFFERS) {
    const categoryId = catBySlug.get(o.categorySlug) ?? catBySlug.get("other");
    if (!categoryId) continue;
    await OfferModel.updateOne(
      { name: o.name },
      {
        $set: {
          type: o.type,
          category: o.categorySlug as any,
          categoryIds: [new mongoose.Types.ObjectId(String(categoryId))],
          clinicId: clinic._id,
          subscriptionPriceKwd: o.subscriptionPriceKwd,
          validityDays: o.validityDays,
          imageUrl: o.imageUrl,
          isCashbackOnly: o.isCashbackOnly ?? false,
          signupCashbackKwd: o.signupCashbackKwd ?? "0.000",
          cashbackActivationFeeKwd: o.cashbackActivationFeeKwd ?? "0.000",
          tagsEn: o.tagsEn ?? [],
          tagsAr: o.tagsAr ?? [],
          allowFullPayment: o.allowFullPayment ?? true,
          allowInstallments: o.allowInstallments ?? false,
          maxInstallments: o.maxInstallments ?? 1,
          allowDeposit: o.allowDeposit ?? false,
          depositAmountKwd: o.depositAmountKwd ?? "0.000",
          cashbackPerSessionKwd: "0.000",
          sessionIntervalDays: 0,
          active: true,
          featured: true,
          description: o.description
        }
      },
      { upsert: true }
    );
  }
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
