import { CategoryModel } from "../models/category.model.js";
import { ClinicModel } from "../models/clinic.model.js";
import { ClinicSessionOfferingModel } from "../models/clinicSessionOffering.model.js";
import { OfferModel } from "../models/offer.model.js";
import { SessionTypeModel } from "../models/sessionType.model.js";
import { UserModel, type UserDoc } from "../models/user.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import bcrypt from "bcryptjs";

const DEFAULT_CATEGORIES: Array<{
  slug: string;
  nameEn: string;
  nameAr: string;
  sortOrder: number;
}> = [
  { slug: "all", nameEn: "All", nameAr: "الكل", sortOrder: 0 },
  { slug: "laser", nameEn: "Laser Services", nameAr: "خدمات الليزر", sortOrder: 1 },
  { slug: "injectables", nameEn: "Injectables", nameAr: "الحقن", sortOrder: 2 },
  { slug: "skincare", nameEn: "Skin Care", nameAr: "العناية بالبشرة", sortOrder: 3 },
  { slug: "beauty", nameEn: "Beauty Enhancements", nameAr: "التحسينات التجميلية", sortOrder: 4 },
  { slug: "body", nameEn: "Body & Slimming", nameAr: "الجسم والتخسيس", sortOrder: 5 },
  { slug: "dental", nameEn: "Dental Services", nameAr: "خدمات الأسنان", sortOrder: 6 },
  { slug: "medical", nameEn: "Medical & Meditation", nameAr: "الطب والتأمل", sortOrder: 7 }
];

export async function seedDefaultCategories(): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await CategoryModel.findOneAndUpdate(
      { slug: c.slug },
      { $set: { ...c, isActive: true } },
      { upsert: true, new: true }
    );
  }
}

export async function seedLocalDemoUsersAndClinics(): Promise<void> {

  const demoPassword = "demo12345";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const demoUsers: Array<{
    username: string;
    role: "customer" | "admin" | "cs" | "finance" | "clinicStaff";
    email?: string;
    clinicId?: string;
  }> = [
    // Customers
    { username: "cust1", role: "customer" },
    { username: "cust2", role: "customer" },
    { username: "cust3", role: "customer" },

    // Admins
    { username: "admin1", role: "admin" },
    { username: "admin2", role: "admin" },

    // Customer Service
    { username: "cs1", role: "cs" },
    { username: "cs2", role: "cs" },
    { username: "cs3", role: "cs" },

    // Finance
    { username: "fin1", role: "finance" },
    { username: "fin2", role: "finance" }
  ];

  // Keep local demo logins deterministic in dev.
  for (const u of demoUsers) {
    const email = u.email ?? `${u.username}@belamonda.local`;
    const existing = await UserModel.findOne({ username: u.username });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = u.role;
      existing.isActive = true;
      if (u.role === "clinicStaff") existing.clinicId = u.clinicId as string;
      await existing.save();
      continue;
    }

    await UserModel.create({
      username: u.username,
      email,
      passwordHash,
      role: u.role,
      isActive: true,
      clinicId: u.role === "clinicStaff" ? u.clinicId : undefined
    });
  }

  console.log(
    `[seed] Demo accounts ready (password: demo12345):\n` +
    `  Customers : cust1, cust2, cust3\n` +
    `  Admins    : admin1, admin2\n` +
    `  CS        : cs1, cs2, cs3\n` +
    `  Finance   : fin1, fin2`
  );

  // Remove all subscriptions for cust1 on every dev startup so the demo account stays clean.
  const cust1User = await UserModel.findOne({ username: "cust1" }).lean<UserDoc | null>();
  if (cust1User) {
    const deleted = await UserOfferModel.deleteMany({ userId: cust1User._id.toString() });
    if (deleted.deletedCount > 0) {
      console.log(`[seed] Cleared ${deleted.deletedCount} subscription(s) for cust1.`);
    }
  }
}

const DEFAULT_SESSION_TYPES: Array<{
  slug: string;
  nameEn: string;
  nameAr: string;
  categorySlug: string;
  priceKwd: string;
  cashbackDeductionKwd: string;
}> = [
  { slug: "filler-italian", nameEn: "Filler (Italian)", nameAr: "فيلر إيطالي", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "filler-princess", nameEn: "Filler (Princess)", nameAr: "فيلر برنسس", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "filler-tosyal", nameEn: "Filler (Tosyal)", nameAr: "فيلر توسيال", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "cheek-filler-texas-jawline-contouring", nameEn: "Cheek Filler & Texas (Jawline Contouring)", nameAr: "فيلر الخدود وتكساس", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "body-filler-10-ml", nameEn: "Body Filler (10 ml)", nameAr: "فيلر للجسم (10 مل)", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "filler-dissolving", nameEn: "Filler Dissolving", nameAr: "تذويب الفيلر", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "botox-one-area", nameEn: "Botox (One Area)", nameAr: "بوتوكس (منطقة واحدة)", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "botox-full-face", nameEn: "Botox (Full Face)", nameAr: "بوتوكس (كامل الوجه)", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "botox-hyperhidrosis", nameEn: "Botox (Hyperhidrosis / Sweating)", nameAr: "بوتوكس (فرط التعرق)", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "baby-face-injection", nameEn: "Baby Face Injection", nameAr: "إبرة بيبي فيس", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "asala-injection-olidia", nameEn: "Asala Injection (Olidia)", nameAr: "إبرة أصالة (أوليديا)", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "glow-injection", nameEn: "Glow Injection", nameAr: "إبرة النضارة (جلو)", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "amber-injection", nameEn: "Amber Injection", nameAr: "إبرة العنبر", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "salmon-injection", nameEn: "Salmon Injection", nameAr: "إبرة السلمون", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "filter-injection", nameEn: "Filter Injection", nameAr: "إبرة الفلتر", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "under-eye-brightening-injections", nameEn: "Under-Eye Brightening Injections", nameAr: "إبر تفتيح تحت العين", categorySlug: "injectables", priceKwd: "150.000", cashbackDeductionKwd: "50.000" },
  { slug: "hydrafacial", nameEn: "Hydrafacial", nameAr: "هايدرا فيشل", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "deep-facial-cleansing", nameEn: "Deep Facial Cleansing", nameAr: "تنظيف بشره عميق", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "dermaplaning", nameEn: "Dermaplaning", nameAr: "ديرما بلانينج", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "facial-bleaching-face", nameEn: "Facial Bleaching (Face)", nameAr: "تشقير الوجه", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "facial-bleaching-eyebrows", nameEn: "Facial Bleaching (Eyebrows)", nameAr: "تشقير الحواجب", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "green-peel-facial-peeling", nameEn: "Green Peel (Facial Peeling)", nameAr: "التقشير الأخضر", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "carbon-treatment-pigmentation", nameEn: "Carbon Treatment (Pigmentation)", nameAr: "التقشير الكربوني", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "dermapen-microneedling", nameEn: "Dermapen (Microneedling)", nameAr: "ديرمابن", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "led-therapy", nameEn: "LED Therapy", nameAr: "علاج الإضاءة LED", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "onda-device-double-chin", nameEn: "ONDA Device (Double Chin)", nameAr: "جهاز أوندا (اللغلوغ)", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "exosome-therapy", nameEn: "Exosome Therapy", nameAr: "علاج الإكسوسوم", categorySlug: "skincare", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "face-plasma-prp", nameEn: "Face Plasma (PRP)", nameAr: "بلازما الوجه", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "hair-plasma-prp", nameEn: "Hair Plasma (PRP)", nameAr: "بلازما الشعر", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "plasma-dermapen-combo", nameEn: "Plasma + Dermapen Combo", nameAr: "بلازما + ديرمابن", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "hair-mesotherapy-biotin", nameEn: "Hair Mesotherapy (Biotin)", nameAr: "ميزوثيرابي للشعر (بيوتين)", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "lip-tinting", nameEn: "Lip Tinting", nameAr: "توريد الشفايف", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "lip-blushing", nameEn: "Lip Blushing", nameAr: "كونتور الشفايف", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "under-eye-treatments", nameEn: "Under-Eye Treatments", nameAr: "تجميل تحت العين", categorySlug: "beauty", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "body-whitening", nameEn: "Body Whitening", nameAr: "تبييض الجسم", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "body-peeling-elbows-knees", nameEn: "Body Peeling (Elbows & Knees)", nameAr: "تقشير الجسم (الكوع والركبة)", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "body-sculpting-tightening-sessions", nameEn: "Body Sculpting / Tightening Sessions", nameAr: "نحت وشد الجسم", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "body-slimming-fat-reduction", nameEn: "Body Slimming / Fat Reduction", nameAr: "تخسيس الجسم", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "stretch-mark-treatment", nameEn: "Stretch Mark Treatment", nameAr: "علاج علامات التمدد", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "skin-repair-treatment-cracks", nameEn: "Skin Repair Treatment (Cracks)", nameAr: "إصلاح تشققات الجلد", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "double-chin-fat-dissolving", nameEn: "Double Chin Fat Dissolving", nameAr: "إذابة دهون اللغلوغ", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "facial-slimming", nameEn: "Facial Slimming", nameAr: "تنحيف الوجه", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "fat-dissolving-injections-packages", nameEn: "Fat Dissolving Injections (Packages)", nameAr: "إبر إذابة الدهون", categorySlug: "body", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "fractional-laser", nameEn: "Fractional Laser", nameAr: "فراكشنال ليزر", categorySlug: "laser", priceKwd: "60.000", cashbackDeductionKwd: "20.000" },
  { slug: "pico-laser", nameEn: "Pico Laser", nameAr: "بيكو ليزر", categorySlug: "laser", priceKwd: "60.000", cashbackDeductionKwd: "20.000" },
  { slug: "tattoo-removal-body-eyebrow", nameEn: "Tattoo Removal (Body & Eyebrow)", nameAr: "إزالة التاتو (الجسم والحواجب)", categorySlug: "laser", priceKwd: "60.000", cashbackDeductionKwd: "20.000" },
  { slug: "skin-tags-removal", nameEn: "Skin Tags Removal", nameAr: "إزالة الزوائد الجلدية", categorySlug: "laser", priceKwd: "60.000", cashbackDeductionKwd: "20.000" },
  { slug: "white-hair-removal", nameEn: "White Hair Removal", nameAr: "إزالة الشعر الأبيض", categorySlug: "laser", priceKwd: "60.000", cashbackDeductionKwd: "20.000" },
  { slug: "full-body-laser-hair-removal", nameEn: "Full Body Laser Hair Removal", nameAr: "ليزر إزالة الشعر كامل الجسم", categorySlug: "laser", priceKwd: "60.000", cashbackDeductionKwd: "20.000" },
  { slug: "consultation", nameEn: "Consultation", nameAr: "استشارة", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "x-ray", nameEn: "X-Ray", nameAr: "أشعة", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "teeth-cleaning", nameEn: "Teeth Cleaning", nameAr: "تنظيف الأسنان", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "gum-cleaning", nameEn: "Gum Cleaning", nameAr: "تنظيف اللثة", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "fillings", nameEn: "Fillings", nameAr: "حشوات", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "root-canal-all-types", nameEn: "Root Canal (All Types)", nameAr: "علاج عصب", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "tooth-extraction-simple", nameEn: "Tooth Extraction (Simple)", nameAr: "خلع الأسنان (بسيط)", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "tooth-extraction-surgical", nameEn: "Tooth Extraction (Surgical)", nameAr: "خلع الأسنان (جراحي)", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "teeth-whitening", nameEn: "Teeth Whitening", nameAr: "تبييض الأسنان", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "polishing", nameEn: "Polishing", nameAr: "تلميع", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "crowns", nameEn: "Crowns", nameAr: "تلبيسات الأسنان", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "veneers", nameEn: "Veneers", nameAr: "فينير الأسنان", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "hollywood-smile", nameEn: "Hollywood Smile", nameAr: "ابتسامة هوليود", categorySlug: "dental", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "glutathione-drip", nameEn: "Glutathione Drip", nameAr: "إبرة الجلوتاثيون", categorySlug: "medical", priceKwd: "90.000", cashbackDeductionKwd: "20.000" },
  { slug: "physiotherapy-sessions", nameEn: "Physiotherapy Sessions", nameAr: "جلسات علاج طبيعي", categorySlug: "medical", priceKwd: "90.000", cashbackDeductionKwd: "20.000" }
];

const STALE_SESSION_TYPE_SLUGS = [
  "botox-one-area-full-face-hyperhidrosis",
  "facial-bleaching-face-eyebrows",
  "teeth-cleaning-gum-cleaning",
  "tooth-extraction-simple-surgical"
];

export async function seedDefaultSessionTypesAndOfferings(): Promise<void> {
  await SessionTypeModel.deleteMany({ slug: { $in: STALE_SESSION_TYPE_SLUGS } });

  const qiblaClinic = (await ClinicModel.findOne({ nameEn: "Qibla Clinic" }).lean()) as { _id?: unknown } | null;
  if (!qiblaClinic?._id) return;

  for (const t of DEFAULT_SESSION_TYPES) {
    const sessionType = (await SessionTypeModel.findOneAndUpdate(
      { slug: t.slug },
      {
        $set: {
          slug: t.slug,
          nameEn: t.nameEn,
          nameAr: t.nameAr,
          categorySlug: t.categorySlug,
          isActive: true
        }
      },
      { upsert: true, new: true }
    )) as { _id: unknown };

    await ClinicSessionOfferingModel.findOneAndUpdate(
      { clinicId: qiblaClinic._id, sessionTypeId: sessionType._id },
      {
        $set: {
          isActive: true,
          priceKwd: t.priceKwd,
          cashbackDeductionKwd: t.cashbackDeductionKwd
        }
      },
      { upsert: true, new: true }
    );
  }
}

export async function seedDefaultOffers(): Promise<void> {
  const qiblaClinic = await ClinicModel.findOne({ nameEn: "Qibla Clinic" });
  if (!qiblaClinic) return;

  const offers = [
    {
      name: "Mini Jamali Card Membership",
      type: "A",
      category: "beauty",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "39.000",
      validityDays: 180,
      signupCashbackKwd: "500.000",
      isCashbackOnly: true,
      tagsEn: ["600 KWD Cashback", "6 Months", "All Beauty Services"],
      tagsAr: ["كاش باك 600 دك", "6 أشهر", "جميع خدمات التجميل"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1616394584738-fc6e612e71c9?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "Jamali Beauty Program",
      type: "A",
      category: "beauty",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "1500.000",
      validityDays: 365,
      signupCashbackKwd: "1500.000",
      isCashbackOnly: true,
      allowInstallments: true,
      maxInstallments: 4,
      tagsEn: ["1500 KWD Cashback", "1 Year", "100 KWD Free Services"],
      tagsAr: ["كاش باك 1500 دك", "سنة واحدة", "100 دك أعمال مجانية"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "Pain Relief Package (6 Sessions)",
      type: "A",
      category: "medical",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "146.000",
      validityDays: 180,
      maxSessions: 6,
      signupCashbackKwd: "34.000",
      allowInstallments: true,
      maxInstallments: 3,
      tagsEn: ["34 KWD Cashback", "Joint Pain Relief"],
      tagsAr: ["كاش باك 34 دك", "تخفيف آلام المفاصل"],
      active: true,
      imageUrl: "https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "Laser Membership (Stomach + Back)",
      type: "A",
      category: "laser",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "49.000",
      validityDays: 150,
      maxSessions: 3,
      allowDeposit: true,
      depositAmountKwd: "9.000",
      cashbackActivationFeeKwd: "9.000",
      tagsEn: ["5 Months", "100 KWD Cashback (+9 KWD)"],
      tagsAr: ["5 أشهر", "كاش باك 100 دك (+9 دك)"],
      active: true,
      imageUrl: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "Full Body Laser (Single Session)",
      type: "A",
      category: "laser",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "19.000",
      validityDays: 30,
      maxSessions: 1,
      allowDeposit: true,
      depositAmountKwd: "5.000",
      cashbackActivationFeeKwd: "5.000",
      tagsEn: ["Optional 30 KWD Cashback (+5 KWD)"],
      tagsAr: ["تفعيل كاش باك 30 دك (+5 دك)"],
      active: true,
      imageUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "Annual Membership (Sabaya)",
      type: "A",
      category: "laser",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "79.000",
      validityDays: 365,
      signupCashbackKwd: "300.000",
      tagsEn: ["1 Year", "Up to 3 Members", "300 KWD Cashback", "Sessions at 9.9 KWD"],
      tagsAr: ["سنة واحدة", "حتى 3 مشتركات", "كاش باك 300 دك", "الجلسة بـ 9.9 دك"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "Unlimited Laser Membership (Naomi Plus)",
      type: "A",
      category: "laser",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "99.000",
      validityDays: 365,
      cashbackPerSessionKwd: "20.000",
      allowInstallments: true,
      maxInstallments: 3,
      tagsEn: ["1 Year", "Unlimited Sessions", "20 KWD Cashback/Session"],
      tagsAr: ["سنة واحدة", "جلسات غير محدودة", "كاش باك 20 دك لكل جلسة"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800"
    },
    {
      name: "6 Full Body Laser Sessions (Naomi Classic)",
      type: "A",
      category: "laser",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "89.000",
      validityDays: 240,
      maxSessions: 6,
      allowInstallments: true,
      maxInstallments: 2,
      tagsEn: ["8 Months", "No Hidden Fees"],
      tagsAr: ["8 أشهر", "بدون رسوم خفية"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800"
    }
  ];

  for (const o of offers) {
    await OfferModel.findOneAndUpdate(
      { name: o.name },
      { $set: o },
      { upsert: true, new: true }
    );
  }
}
