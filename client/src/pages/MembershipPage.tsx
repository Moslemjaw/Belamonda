import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicLayout from "../components/PublicLayout";
import { apiFetch } from "../lib/api";
import { getCategoryIcon } from "../components/CategoryIcons";

type Offer = {
  id: string;
  name: string;
  nameAr?: string;
  type: "A" | "B";
  category: string;
  subscriptionPriceKwd: string;
  validityDays: number;
  maxSessions?: number;
  sessionIntervalDays?: number;
  signupCashbackKwd: string;
  cashbackPerSessionKwd: string;
  cashbackActivationFeeKwd: string;
  isCashbackOnly?: boolean;
  allowFullPayment: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  allowDeposit: boolean;
  depositAmountKwd: string;
  tagsEn?: string[];
  tagsAr?: string[];
  imageUrl?: string;
  featured?: boolean;
  isGroupOffer?: boolean;
  groupSizeRequired?: number;
  groupRewardType?: string;
  groupRewardValue?: string;
  clinicLocked?: boolean;
  requireBranchSelection?: boolean;
  allowENet?: boolean;
};

export default function MembershipPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/offers")
      .then((raw) => {
        const d = raw as { items: Offer[] };
        setOffers(d.items || []);
      })
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, []);

  /** Build a human-readable feature list from the offer data */
  const buildFeatures = (o: Offer): string[] => {
    const f: string[] = [];
    const price = parseFloat(o.subscriptionPriceKwd || "0");
    const signupCB = parseFloat(o.signupCashbackKwd || "0");
    const perSessionCB = parseFloat(o.cashbackPerSessionKwd || "0");
    const activationFee = parseFloat(o.cashbackActivationFeeKwd || "0");
    const months = Math.round(o.validityDays / 30);

    // Sessions
    if (o.maxSessions) {
      f.push(
        isAr
          ? `${o.maxSessions} جلسات خلال ${months} ${months === 1 ? "شهر" : "شهور"}`
          : `${o.maxSessions} sessions over ${months} month${months === 1 ? "" : "s"}`
      );
    } else if (!o.isCashbackOnly) {
      f.push(
        isAr
          ? `جلسات غير محدودة / ${months} ${months === 1 ? "شهر" : "شهور"}`
          : `Unlimited sessions / ${months} month${months === 1 ? "" : "s"}`
      );
    }

    // Price info
    if (price > 0) {
      f.push(isAr ? `${o.subscriptionPriceKwd} د.ك إجمالاً` : `${o.subscriptionPriceKwd} KWD total`);
    }

    // Signup cashback
    if (signupCB > 0) {
      f.push(
        isAr
          ? `${o.signupCashbackKwd} د.ك كاش باك عند التسجيل`
          : `${o.signupCashbackKwd} KWD signup cashback`
      );
    }

    // Per-session cashback
    if (perSessionCB > 0) {
      f.push(
        isAr
          ? `${o.cashbackPerSessionKwd} د.ك كاش باك لكل جلسة`
          : `${o.cashbackPerSessionKwd} KWD per-session cashback`
      );
    }

    // Session interval
    if (o.sessionIntervalDays && o.sessionIntervalDays > 0) {
      f.push(
        isAr
          ? `${o.sessionIntervalDays} يوم فترة انتظار بين الجلسات`
          : `${o.sessionIntervalDays}-day session interval`
      );
    }

    // Clinic locked
    if (o.clinicLocked) {
      f.push(isAr ? "عيادة محددة من اختيارك" : "Linked clinic of choice");
    }

    // Cashback only
    if (o.isCashbackOnly) {
      f.push(isAr ? "كاش باك فقط — بدون حجز مواعيد" : "Cashback only — no appointment booking");
    }

    // Group offer
    if (o.isGroupOffer && o.groupSizeRequired) {
      const rt = o.groupRewardType;
      if (rt === 'unlock_membership') {
        f.push(isAr ? `🔓 يحتاج ${o.groupSizeRequired - 1} أشخاص لفتح العضوية` : `🔓 Needs ${o.groupSizeRequired - 1} people to unlock`);
      } else if (rt === 'free_session') {
        f.push(isAr ? `🎁 جلسة مجانية عند دعوة ${o.groupSizeRequired - 1} أصدقاء` : `🎁 Free session when ${o.groupSizeRequired - 1} friends join`);
      } else if (rt === 'discount') {
        f.push(isAr ? `💰 خصم ${o.groupRewardValue || ''} مع ${o.groupSizeRequired - 1} أصدقاء` : `💰 ${o.groupRewardValue || ''} discount with ${o.groupSizeRequired - 1} friends`);
      } else if (rt === 'cashback_bonus') {
        f.push(isAr ? `💎 ${o.groupRewardValue || ''} KWD كاش باك إضافي مع ${o.groupSizeRequired - 1} أصدقاء` : `💎 ${o.groupRewardValue || ''} KWD bonus cashback with ${o.groupSizeRequired - 1} friends`);
      } else if (rt === 'split_bill') {
        const price = parseFloat(o.subscriptionPriceKwd || '0');
        const pp = o.groupSizeRequired > 0 ? (price / o.groupSizeRequired).toFixed(3) : '0';
        f.push(isAr ? `🧾 تقسيم الفاتورة — ${pp} د.ك لكل شخص` : `🧾 Split bill — ${pp} KWD per person`);
      } else {
        f.push(isAr ? `عرض جماعي — حتى ${o.groupSizeRequired} أعضاء` : `Group offer — up to ${o.groupSizeRequired} members`);
      }
    }

    return f;
  };

  /** Build a highlight string for cashback / special perks */
  const buildHighlight = (o: Offer): string | null => {
    const signupCB = parseFloat(o.signupCashbackKwd || "0");
    const perSessionCB = parseFloat(o.cashbackPerSessionKwd || "0");
    const activationFee = parseFloat(o.cashbackActivationFeeKwd || "0");

    if (signupCB > 0 && activationFee > 0) {
      return isAr
        ? `${o.signupCashbackKwd} د.ك كاش باك + ${o.cashbackActivationFeeKwd} د.ك رسوم تفعيل`
        : `${o.signupCashbackKwd} KWD cashback + ${o.cashbackActivationFeeKwd} KWD activation`;
    }
    if (signupCB > 0) {
      return isAr
        ? `${o.signupCashbackKwd} د.ك كاش باك`
        : `${o.signupCashbackKwd} KWD cashback`;
    }
    if (perSessionCB > 0) {
      return isAr
        ? `${o.cashbackPerSessionKwd} د.ك كاش باك لكل جلسة`
        : `${o.cashbackPerSessionKwd} KWD/session cashback`;
    }
    if (o.isGroupOffer && o.groupSizeRequired) {
      const rt = o.groupRewardType;
      if (rt === 'unlock_membership') {
        return isAr
          ? `🔓 أنشئ مجموعة من ${o.groupSizeRequired} لفتح العضوية`
          : `🔓 Create a group of ${o.groupSizeRequired} to unlock`;
      } else if (rt === 'split_bill') {
        const price = parseFloat(o.subscriptionPriceKwd || "0");
        const perPerson = o.groupSizeRequired > 0 ? (price / o.groupSizeRequired).toFixed(3) : "0";
        return isAr
          ? `${perPerson} د.ك لكل شخص • ${o.groupSizeRequired} أشخاص`
          : `${perPerson} KWD per person • ${o.groupSizeRequired} people`;
      } else if (rt === 'free_session') {
        return isAr
          ? `🎁 جلسة مجانية مع ${o.groupSizeRequired - 1} أصدقاء`
          : `🎁 Free session with ${o.groupSizeRequired - 1} friends`;
      } else if (rt === 'discount') {
        return isAr
          ? `💰 خصم ${o.groupRewardValue || ''} مع مجموعة`
          : `💰 ${o.groupRewardValue || ''} group discount`;
      } else if (rt === 'cashback_bonus') {
        return isAr
          ? `💎 ${o.groupRewardValue || ''} KWD كاش باك جماعي`
          : `💎 ${o.groupRewardValue || ''} KWD group cashback`;
      } else {
        const price = parseFloat(o.subscriptionPriceKwd || "0");
        const perPerson = o.groupSizeRequired > 0 ? (price / o.groupSizeRequired).toFixed(3) : "0";
        return isAr
          ? `${perPerson} د.ك لكل شخص • حتى ${o.groupSizeRequired} أعضاء`
          : `${perPerson} KWD per person • up to ${o.groupSizeRequired} members`;
      }
    }
    return null;
  };

  /** Pick a gradient accent based on offer index */
  const accents = [
    "from-brand-pink-400 to-brand-pink-600",
    "from-brand-sage-400 to-brand-sage-600",
    "from-amber-300 to-brand-pink-400",
    "from-brand-pink-500 to-purple-500",
    "from-brand-sage-300 to-brand-pink-400",
    "from-brand-sage-200 to-brand-sage-400",
    "from-brand-pink-300 to-brand-pink-500",
    "from-violet-400 to-brand-pink-500",
    "from-emerald-300 to-brand-sage-500",
  ];

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
              "Curated programs designed to match your routine, your budget, and your glow goals.",
              "باقات منتقاة تناسب روتينك وميزانيتك وأهدافك."
            )}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="shimmer h-80 rounded-3xl" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">✨</div>
            <h2 className="text-xl font-bold text-surface-900">
              {t("No memberships available yet", "لا توجد عضويات متاحة حالياً")}
            </h2>
            <p className="mt-2 text-surface-500">
              {t("Check back soon for exciting offers!", "تابعينا قريباً لعروض مميّزة!")}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((o, idx) => {
              const price = parseFloat(o.subscriptionPriceKwd || "0");
              const features = buildFeatures(o);
              const highlight = buildHighlight(o);
              const accent = accents[idx % accents.length];
              const months = Math.round(o.validityDays / 30);
              const displayName = isAr ? (o.nameAr || o.name) : o.name;
              const tags = (isAr ? o.tagsAr : o.tagsEn) ?? [];
              const isPopular = o.featured || idx === 0;

              return (
                <div
                  key={o.id}
                  className={`relative card-elevated overflow-hidden transition-transform hover:-translate-y-1 duration-300 ${isPopular ? "ring-2 ring-brand-pink-500" : ""}`}
                >
                  {isPopular && (
                    <div className="absolute top-0 inset-x-0 bg-brand-pink-500 text-white text-center text-[10px] font-bold uppercase tracking-wider py-1">
                      ★ {t("Most popular", "الأكثر طلباً")}
                    </div>
                  )}
                  <div className={`h-2 bg-gradient-to-r ${accent} ${isPopular ? "mt-5" : ""}`} />
                  <div className="p-6">
                    <h3 className="text-2xl font-black text-surface-900">
                      {displayName}
                    </h3>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map((tag) => (
                          <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-sage-50 text-brand-sage-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price */}
                    <div className="mt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-surface-900">
                          {price > 0 ? o.subscriptionPriceKwd : "—"}
                        </span>
                        {price > 0 && (
                          <span className="text-xs font-bold text-surface-400">KWD</span>
                        )}
                      </div>
                      <div className="text-xs text-surface-500 mt-0.5">
                        {months > 0
                          ? isAr
                            ? `${months} ${months === 1 ? "شهر" : "شهور"}`
                            : `${months} month${months === 1 ? "" : "s"}`
                          : isAr
                            ? `${o.validityDays} يوم`
                            : `${o.validityDays} days`
                        }
                      </div>
                    </div>

                    {/* Highlight */}
                    {highlight && (
                      <div className="mt-4 rounded-xl bg-brand-pink-50 px-3 py-2 text-xs font-bold text-brand-pink-700">
                        🎁 {highlight}
                      </div>
                    )}

                    {/* Cashback-only badge */}
                    {o.isCashbackOnly && (
                      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700">
                        💳 {t("Cashback only — no sessions", "كاش باك فقط — بدون جلسات")}
                      </div>
                    )}

                    {/* Features */}
                    <ul className="mt-5 space-y-2">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-surface-700">
                          <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-[10px] font-bold">
                            ✓
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Payment methods summary */}
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {o.allowFullPayment && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-100 text-surface-600">
                          {t("Full Pay", "دفع كامل")}
                        </span>
                      )}
                      {o.allowInstallments && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-100 text-surface-600">
                          {t(`${o.maxInstallments}x Installments`, `${o.maxInstallments} أقساط`)}
                        </span>
                      )}
                      {o.allowDeposit && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-100 text-surface-600">
                          {t("Deposit", "عربون")}
                        </span>
                      )}
                      {o.allowENet && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          eNet
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/memberships/${o.id}`}
                      className={`btn ${isPopular ? "btn-primary" : "btn-secondary"} w-full mt-6 justify-center`}
                    >
                      {t("Choose plan", "اختاري الباقة")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 rounded-3xl bg-white border border-surface-100 p-6 sm:p-10 text-center">
          <h3 className="text-xl font-black text-surface-900">{t("Need help?", "تحتاجين مساعدة؟")}</h3>
          <p className="text-surface-600 mt-2">
            {t("Contact our customer service or browse available clinics.", "تواصلي مع خدمة العملاء أو تصفحي العيادات المتاحة.")}
          </p>
          <Link to="/clinics" className="btn-primary btn-sm mt-4">
            {t("View clinics", "عرض العيادات")}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
