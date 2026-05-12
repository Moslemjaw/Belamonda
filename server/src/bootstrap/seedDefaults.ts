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
