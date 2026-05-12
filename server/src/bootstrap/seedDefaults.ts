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
}> = [];

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
