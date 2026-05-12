import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicLayout from "../components/PublicLayout";

type Plan = {
  code: string;
  nameEn: string;
  nameAr: string;
  price: string;
  durationEn: string;
  durationAr: string;
  tagline: { en: string; ar: string };
  highlight?: { en: string; ar: string };
  featuresEn: string[];
  featuresAr: string[];
  accent: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    code: "jamali",
    nameEn: "Jamali",
    nameAr: "جمالي",
    price: "—",
    durationEn: "12 months",
    durationAr: "١٢ شهر",
    tagline: { en: "Maximum cashback. Maximum glow.", ar: "أقصى كاش باك. أقصى تألق." },
    highlight: { en: "1,500 KWD cashback + 100 KWD free", ar: "١٥٠٠ د.ك كاش باك + ١٠٠ د.ك مجاناً" },
    featuresEn: [
      "1,500 KWD cashback locked at signup",
      "100 KWD free services in same clinic",
      "Use cashback across any partner clinic",
      "Year-long validity",
    ],
    featuresAr: [
      "١٥٠٠ د.ك كاش باك مقفل عند التسجيل",
      "١٠٠ د.ك خدمات مجانية في نفس العيادة",
      "استخدمي الكاش باك في أي عيادة شريكة",
      "صلاحية سنة كاملة",
    ],
    accent: "from-brand-pink-400 to-brand-pink-600",
    popular: true,
  },
  {
    code: "mini_jamali",
    nameEn: "Mini Jamali",
    nameAr: "ميني جمالي",
    price: "—",
    durationEn: "6 months",
    durationAr: "٦ شهور",
    tagline: { en: "Half the time, full the value.", ar: "نصف المدة، كامل القيمة." },
    highlight: { en: "500 KWD cashback + 100 KWD free", ar: "٥٠٠ د.ك كاش باك + ١٠٠ د.ك مجاناً" },
    featuresEn: [
      "500 KWD cashback locked",
      "100 KWD free services",
      "Cross-clinic redemption",
      "6-month validity",
    ],
    featuresAr: [
      "٥٠٠ د.ك كاش باك مقفل",
      "١٠٠ د.ك خدمات مجانية",
      "استرداد متعدد العيادات",
      "صلاحية ٦ شهور",
    ],
    accent: "from-brand-sage-400 to-brand-sage-600",
  },
  {
    code: "nuomi_classic",
    nameEn: "Nuomi Classic",
    nameAr: "نعومي كلاسيك",
    price: "—",
    durationEn: "8 months",
    durationAr: "٨ شهور",
    tagline: { en: "Smooth & sorted, six sessions in.", ar: "نعومة كاملة في ٦ جلسات." },
    featuresEn: [
      "6 laser sessions",
      "8-month booking window",
      "Same-clinic only",
      "Great starter package",
    ],
    featuresAr: [
      "٦ جلسات ليزر",
      "نافذة حجز ٨ شهور",
      "نفس العيادة فقط",
      "باقة بداية مثالية",
    ],
    accent: "from-amber-300 to-brand-pink-400",
  },
  {
    code: "nuomi_plus",
    nameEn: "Nuomi Plus",
    nameAr: "نعومي بلس",
    price: "—",
    durationEn: "12 months",
    durationAr: "١٢ شهر",
    tagline: { en: "Unlimited sessions, unlimited confidence.", ar: "جلسات غير محدودة، ثقة بلا حدود." },
    highlight: { en: "20 KWD/session cashback", ar: "٢٠ د.ك كاش باك لكل جلسة" },
    featuresEn: [
      "Unlimited laser sessions / year",
      "Earn 20 KWD per attended session",
      "Linked clinic of choice",
      "Premium tier",
    ],
    featuresAr: [
      "جلسات ليزر غير محدودة سنوياً",
      "اكسبي ٢٠ د.ك مع كل جلسة",
      "عيادة محددة من اختيارك",
      "المستوى المميّز",
    ],
    accent: "from-brand-pink-500 to-purple-500",
  },
  {
    code: "sabaya",
    nameEn: "Sabaya",
    nameAr: "صبايا",
    price: "79.000",
    durationEn: "12 months",
    durationAr: "١٢ شهر",
    tagline: { en: "Friends pay-per-use, together.", ar: "للصبايا، بالاستخدام." },
    highlight: { en: "9.900 KWD per session • up to 3 members", ar: "٩٫٩٠٠ د.ك للجلسة • حتى ٣ أعضاء" },
    featuresEn: [
      "79 KWD yearly access fee",
      "9.900 KWD per attended session",
      "Share with up to 3 members",
      "Linked Jamali cashback option",
    ],
    featuresAr: [
      "٧٩ د.ك رسوم سنوية",
      "٩٫٩٠٠ د.ك لكل جلسة",
      "للمشاركة حتى ٣ أعضاء",
      "خيار ربط مع كاش باك جمالي",
    ],
    accent: "from-brand-sage-300 to-brand-pink-400",
  },
  {
    code: "single_session",
    nameEn: "Single Session",
    nameAr: "جلسة واحدة",
    price: "19.000",
    durationEn: "Pay-per-visit",
    durationAr: "بالزيارة",
    tagline: { en: "Try once. No commitment.", ar: "جرّبي مرة. بدون التزام." },
    featuresEn: [
      "19 KWD single visit",
      "Optional 30 KWD cashback (+5 KWD)",
      "Perfect for first-timers",
    ],
    featuresAr: [
      "١٩ د.ك للزيارة",
      "خيار كاش باك ٣٠ د.ك (+٥ د.ك)",
      "مناسب للزيارة الأولى",
    ],
    accent: "from-brand-sage-200 to-brand-sage-400",
  },
  {
    code: "three_sessions",
    nameEn: "3 Sessions",
    nameAr: "٣ جلسات",
    price: "49.000",
    durationEn: "5 months",
    durationAr: "٥ شهور",
    tagline: { en: "A trio for the perfect routine.", ar: "ثلاثية لروتين مثالي." },
    highlight: { en: "Optional 100 KWD cashback (+9 KWD)", ar: "خيار كاش باك ١٠٠ د.ك (+٩ د.ك)" },
    featuresEn: [
      "3 sessions over 5 months",
      "49 KWD total",
      "Optional cashback boost",
    ],
    featuresAr: [
      "٣ جلسات خلال ٥ شهور",
      "٤٩ د.ك إجمالاً",
      "خيار تعزيز الكاش باك",
    ],
    accent: "from-brand-pink-300 to-brand-pink-500",
  },
];

export default function MembershipPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <PublicLayout>
      <section className="bg-brand-gradient-soft border-b border-surface-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 text-center">
          <span className="inline-block rounded-full bg-white/80 backdrop-blur border border-brand-pink-200 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-pink-600">
            {t("Belamonda Memberships", "باقات بيلاموندو")}
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black text-surface-900 leading-tight">
            {t("Pick the program that pays you back.", "اختاري الباقة التي ترد لكِ المال.")}
          </h1>
          <p className="mt-4 text-surface-600 max-w-2xl mx-auto">
            {t(
              "Seven curated programs designed to match your routine, your budget, and your glow goals.",
              "سبع باقات منتقاة تناسب روتينك وميزانيتك وأهدافك."
            )}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.code}
              className={`relative card-elevated overflow-hidden ${p.popular ? "ring-2 ring-brand-pink-500" : ""}`}
            >
              {p.popular && (
                <div className="absolute top-0 inset-x-0 bg-brand-pink-500 text-white text-center text-[10px] font-bold uppercase tracking-wider py-1">
                  ★ {t("Most popular", "الأكثر طلباً")}
                </div>
              )}
              <div className={`h-2 bg-gradient-to-r ${p.accent} ${p.popular ? "mt-5" : ""}`} />
              <div className="p-6">
                <h3 className="text-2xl font-black text-surface-900">
                  {isAr ? p.nameAr : p.nameEn}
                </h3>
                <p className="text-sm text-surface-500 mt-1 leading-snug">{isAr ? p.tagline.ar : p.tagline.en}</p>

                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-surface-900">{p.price}</span>
                    {p.price !== "—" && <span className="text-xs font-bold text-surface-400">KWD</span>}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">{isAr ? p.durationAr : p.durationEn}</div>
                </div>

                {p.highlight && (
                  <div className="mt-4 rounded-xl bg-brand-pink-50 px-3 py-2 text-xs font-bold text-brand-pink-700">
                    🎁 {isAr ? p.highlight.ar : p.highlight.en}
                  </div>
                )}

                <ul className="mt-5 space-y-2">
                  {(isAr ? p.featuresAr : p.featuresEn).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-surface-700">
                      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-[10px] font-bold">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/signup" className={`btn ${p.popular ? "btn-primary" : "btn-secondary"} w-full mt-6 justify-center`}>
                  {t("Choose plan", "اختاري الباقة")}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-white border border-surface-100 p-6 sm:p-10 text-center">
          <h3 className="text-xl font-black text-surface-900">{t("Need help?", "تحتاجين مساعدة؟")}</h3>
          <p className="text-surface-600 mt-2">{t("Contact our customer service or browse available clinics.", "تواصلحي مع خدمة العملاء أو تصفحي العيادات المتاحة.")}</p>
          <Link to="/clinics" className="btn-primary btn-sm mt-4">{t("View clinics", "عرض العيادات")}</Link>
        </div>
      </section>
    </PublicLayout>
  );
}
