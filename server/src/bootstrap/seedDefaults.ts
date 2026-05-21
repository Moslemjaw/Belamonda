import { CategoryModel } from "../models/category.model.js";
import { ClinicModel } from "../models/clinic.model.js";
import { ClinicSessionOfferingModel } from "../models/clinicSessionOffering.model.js";
import { OfferModel } from "../models/offer.model.js";
import { SessionTypeModel } from "../models/sessionType.model.js";

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
  // Ensure "Qibla Clinic" exists so offers always have a valid clinicId
  let qiblaClinic = await ClinicModel.findOne({ nameEn: "Qibla Clinic" });
  if (!qiblaClinic) {
    qiblaClinic = await ClinicModel.create({
      nameEn: "Qibla Clinic",
      nameAr: "عيادة القبلة",
      active: true
    });
  }

  const offers = [
    // ── 1. Jamali (باكيج 89 / جمالي) ─ 6 free sessions ──────────────────────
    {
      name: "Jamali",
      nameAr: "جمالي",
      type: "A",
      category: "laser",
      offerKind: "laser",
      membershipType: "free_sessions",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "89.000",
      validityDays: 240,
      maxSessions: 6,
      allowInstallments: true,
      maxInstallments: 2,
      tagsEn: ["8 Months", "6 Full Body Sessions", "No Hidden Fees"],
      tagsAr: ["8 أشهر", "6 جلسات كامل الجسم", "بدون رسوم خفية"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800"
    },
    // ── 2. Naumi Plus (باكيج 99) ─ unlimited sessions, 20 KWD cashback/session
    {
      name: "Naumi Plus",
      nameAr: "ناعمي بلس",
      type: "A",
      category: "laser",
      offerKind: "cashback",
      membershipType: "cashback",
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
    // ── 3. Single Session (جلسة واحدة) ─ normal session, NOT a membership ───
    {
      name: "Single Session",
      nameAr: "جلسة واحدة",
      type: "A",
      category: "laser",
      offerKind: "laser",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "19.000",
      validityDays: 30,
      maxSessions: 1,
      tagsEn: ["Single Visit", "Full Body Laser"],
      tagsAr: ["زيارة واحدة", "ليزر كامل الجسم"],
      active: true,
      imageUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800"
    },
    // ── 4. Single Session with Cashback (جلسة مع كاش باك) ─ 30 KWD cashback ─
    {
      name: "Single Session with Cashback",
      nameAr: "جلسة مع كاش باك",
      type: "A",
      category: "laser",
      offerKind: "cashback",
      membershipType: "cashback",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "24.000",
      validityDays: 30,
      maxSessions: 1,
      signupCashbackKwd: "30.000",
      tagsEn: ["30 KWD Cashback", "Single Session"],
      tagsAr: ["كاش باك 30 دك", "جلسة واحدة"],
      active: true,
      imageUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800"
    },
    // ── 5. Package 49 (باكيج 49) ─ 3 sessions, 100 KWD cashback ─────────────
    {
      name: "Package 49",
      nameAr: "باكيج 49",
      type: "A",
      category: "laser",
      offerKind: "cashback",
      membershipType: "cashback",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "49.000",
      validityDays: 150,
      maxSessions: 3,
      signupCashbackKwd: "100.000",
      tagsEn: ["5 Months", "3 Sessions", "100 KWD Cashback"],
      tagsAr: ["5 أشهر", "3 جلسات", "كاش باك 100 دك"],
      active: true,
      imageUrl: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=800"
    },
    // ── 6. Package 59 (باكيج 59) ─ 4 free sessions ──────────────────────────
    {
      name: "Package 59",
      nameAr: "باكيج 59",
      type: "A",
      category: "laser",
      offerKind: "laser",
      membershipType: "free_sessions",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "59.000",
      validityDays: 180,
      maxSessions: 4,
      tagsEn: ["6 Months", "4 Free Sessions"],
      tagsAr: ["6 أشهر", "4 جلسات مجانية"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800"
    },
    // ── 7. Mini Jamali ─ cashback-only beauty membership ─────────────────────
    {
      name: "Mini Jamali",
      nameAr: "ميني جمالي",
      type: "A",
      category: "beauty",
      offerKind: "cashback",
      membershipType: "cashback",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "39.000",
      validityDays: 180,
      signupCashbackKwd: "500.000",
      isCashbackOnly: true,
      tagsEn: ["500 KWD Cashback", "6 Months", "All Beauty Services"],
      tagsAr: ["كاش باك 500 دك", "6 أشهر", "جميع خدمات التجميل"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1616394584738-fc6e612e71c9?auto=format&fit=crop&q=80&w=800"
    },
    // ── 8. Sabaya (صبايا) ─ group membership ─────────────────────────────────
    {
      name: "Sabaya",
      nameAr: "صبايا",
      type: "A",
      category: "laser",
      offerKind: "membership",
      membershipType: "group",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "79.000",
      validityDays: 365,
      maxSessions: 6,
      signupCashbackKwd: "300.000",
      isGroupOffer: true,
      groupSizeRequired: 3,
      tagsEn: ["1 Year", "Up to 3 Members", "300 KWD Cashback"],
      tagsAr: ["سنة واحدة", "حتى 3 مشتركات", "كاش باك 300 دك"],
      active: true,
      featured: true,
      imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800"
    },
    // ── 9. Other (أخرى) ─ catch-all ──────────────────────────────────────────
    {
      name: "Other",
      nameAr: "أخرى",
      type: "A",
      category: "other",
      offerKind: "treatment",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "0.000",
      validityDays: 365,
      maxSessions: 1,
      tagsEn: ["Custom Service"],
      tagsAr: ["خدمة مخصصة"],
      active: true
    },
    // ── 10. General Service ─ fallback for unmapped clients ───────────────────
    {
      name: "General Service",
      nameAr: "خدمة عامة",
      type: "A",
      category: "other",
      offerKind: "treatment",
      clinicId: qiblaClinic._id,
      subscriptionPriceKwd: "0.000",
      validityDays: 365,
      maxSessions: 1,
      tagsEn: ["General"],
      tagsAr: ["عام"],
      active: true
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
