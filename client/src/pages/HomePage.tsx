import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { getCategoryIcon } from "../components/CategoryIcons";
import PublicLayout from "../components/PublicLayout";
import MembershipCard, { type PublicOffer } from "../components/OfferCard";
import { useAuth } from "../app/AuthContext";
import { useApi } from "../hooks/useApi";

type HomePayload = {
  featuredOffers: PublicOffer[];
  categoriesPreview: Array<{ id: string; nameEn: string; nameAr: string; slug: string }>;
  cashbackOffers: PublicOffer[];
  membershipOffers: PublicOffer[];
  services: Array<{ id: string; nameEn: string; nameAr: string; slug: string }>;
};

type Clinic = {
  id: string;
  nameEn: string;
  nameAr: string;
  address: string;
  phone?: string;
  categoryTags?: string[];
};

export default function HomePage() {
  const { i18n } = useTranslation();
  const { auth } = useAuth();
  const [data, setData] = useState<HomePayload | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const { data: walletApiData } = useApi<{
    wallet: { lockedBalance: string; unlockedBalance: string; ceiling: string } | null;
    txns: Array<{ id: string; type: string; amountKwd: string; reason?: string; createdAt: string }>;
  }>(auth ? "/wallet/me" : null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await apiFetch("/public/home")) as HomePayload;
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/clinics")
      .then((d: unknown) => {
        if (cancelled) return;
        const list = ((d as { items?: Clinic[]; clinics?: Clinic[] }).items
          ?? (d as { clinics?: Clinic[] }).clinics
          ?? []);
        setClinics(list);
      })
      .catch(() => { if (!cancelled) setClinics([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-gradient-soft" />
        <div className="absolute -top-20 -right-16 sm:-top-32 sm:-right-20 w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-brand-pink-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 sm:-bottom-32 sm:-left-20 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-brand-sage-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-6 py-10 sm:py-24 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="animate-fade-in text-center sm:text-start">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md border border-brand-pink-200 px-4 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-brand-pink-600 shadow-sm">
                ✨ {t("Premium aesthetic care", "عناية تجميلية فاخرة")}
              </span>
              <h1 className="mt-5 text-[2rem] sm:text-5xl lg:text-6xl font-black text-surface-900 leading-[1.1] sm:leading-[1.05] tracking-tight">
                {t("Glow on your terms.", "تألقي بطريقتك.")}
                <span className="block text-brand-gradient mt-1">
                  {t("Memberships, sessions & cashback.", "باقات العضوية وجلسات وكاش باك.")}
                </span>
              </h1>
              <p className="mt-4 sm:mt-5 text-[15px] sm:text-lg text-surface-600 leading-relaxed max-w-lg mx-auto sm:mx-0">
                {t(
                  "Browse curated memberships from Kuwait's top clinics. Pay full, in installments, or with a refundable deposit — and earn cashback on every session.",
                  "تصفّحي باقات منتقاة من أرقى عيادات الكويت. ادفعي كاملاً أو بالأقساط أو بعربون — واكسبي كاش باك على كل جلسة."
                )}
              </p>

              {/* Mobile decorative floating cards */}
              <div className="relative lg:hidden my-6 h-28 sm:h-32">
                <div className="absolute inset-x-4 top-0 bottom-0 rounded-[2rem] bg-brand-gradient/10 blur-xl" />
                <div className="absolute left-4 top-2 w-36 sm:w-40 rounded-2xl p-3 bg-white/95 backdrop-blur-md shadow-lg border border-white/60 animate-slide-up">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-brand-pink-500">{t("Cashback", "كاش باك")}</div>
                  <div className="text-xl sm:text-2xl font-black text-surface-900">1,500 <span className="text-[10px] sm:text-xs">KWD</span></div>
                  <div className="text-[10px] text-surface-500">{t("Jamali Program", "برنامج جمالي")}</div>
                </div>
                <div className="absolute right-4 bottom-0 w-36 sm:w-40 rounded-2xl p-3 bg-white/95 backdrop-blur-md shadow-lg border border-white/60 animate-slide-up" style={{ animationDelay: '200ms' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-brand-sage-100 text-brand-sage-700 grid place-items-center">
                      {getCategoryIcon("skincare")}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-surface-400 uppercase">{t("Today", "اليوم")}</div>
                      <div className="text-xs font-bold text-surface-900">{t("Hydrafacial", "هايدرافيشل")}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 items-center sm:items-start">
                <Link to="/memberships" className="btn-primary btn-lg shadow-glow-lg w-full sm:w-auto text-center justify-center">
                  {t("Browse memberships", "تصفّحي باقات العضوية")}
                  <span className="rtl:rotate-180">→</span>
                </Link>
                <Link to="/memberships" className="btn-secondary btn-lg w-full sm:w-auto text-center justify-center">
                  {t("View plans", "عرض الخطط")}
                </Link>
              </div>
              <div className="mt-6 sm:mt-8 flex items-center justify-center sm:justify-start gap-4 sm:gap-6 text-[11px] sm:text-xs font-semibold text-surface-500">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-[10px] sm:text-xs">✓</span>
                  {t("Verified clinics", "عيادات معتمدة")}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-brand-pink-100 text-brand-pink-600 grid place-items-center text-[10px] sm:text-xs">♥</span>
                  {t("Real cashback", "كاش باك حقيقي")}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-brand-sage-100 text-brand-sage-700 grid place-items-center text-[10px] sm:text-xs">⚡</span>
                  {t("Instant booking", "حجز فوري")}
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="relative aspect-square max-w-md mx-auto">
                <div className="absolute inset-8 rounded-[40%_60%_40%_60%/60%_30%_70%_40%] bg-brand-gradient shadow-2xl animate-pulse-soft" />
                <div className="absolute inset-16 rounded-[60%_40%_60%_40%/40%_70%_30%_60%] bg-white/40 backdrop-blur-xl" />
                <div className="absolute top-6 right-2 w-32 card-elevated p-3 bg-white/95 backdrop-blur animate-slide-up">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-brand-pink-500">{t("Cashback", "كاش باك")}</div>
                  <div className="text-2xl font-black text-surface-900">1,500 <span className="text-xs">KWD</span></div>
                  <div className="text-[10px] text-surface-500">{t("Jamali Program", "برنامج جمالي")}</div>
                </div>
                <div className="absolute bottom-8 left-0 w-36 card-elevated p-3 bg-white/95 backdrop-blur animate-slide-up animate-delay-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-sage-100 text-brand-sage-700 grid place-items-center">
                      {getCategoryIcon("skincare")}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-surface-400 uppercase">{t("Today", "اليوم")}</div>
                      <div className="text-xs font-bold text-surface-900">{t("Hydrafacial", "هايدرافيشل")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-surface-100 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-5 sm:py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            {[
              { v: "9+", l: t("Partner clinics", "عيادات شريكة"), icon: "🏥" },
              { v: "100+", l: t("Active memberships", "باقة عضوية نشطة"), icon: "💎" },
              { v: "1,500", l: t("Max cashback (KWD)", "أقصى كاش باك (د.ك)"), icon: "💰" },
              { v: "100%", l: t("Refundable deposits", "عربون قابل للاسترداد"), icon: "✅" },
            ].map((s) => (
              <div key={s.l} className="bg-white/70 sm:bg-transparent rounded-2xl sm:rounded-none p-3 sm:p-0 text-center shadow-sm sm:shadow-none border border-surface-100/60 sm:border-0">
                <div className="text-base sm:hidden mb-0.5">{s.icon}</div>
                <div className="text-lg sm:text-2xl font-black text-brand-pink-600">{s.v}</div>
                <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-surface-500 mt-0.5 sm:mt-1 leading-tight">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES — services anchor */}
      {data && data.categoriesPreview.length > 0 && (
        <section id="services" className="py-10 sm:py-16">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="flex items-end justify-between mb-5 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-3xl font-black text-surface-900">
                  {t("Browse by category", "تصفّحي حسب الفئة")}
                </h2>
                <p className="text-xs sm:text-sm text-surface-500 mt-1">{t("Find exactly what you need", "اعثري على ما يناسبك تماماً")}</p>
              </div>
              <Link to="/memberships" className="text-sm font-bold text-brand-pink-600 hover:text-brand-pink-700 hidden sm:inline-flex items-center gap-1">
                {t("View all", "عرض الكل")} <span className="rtl:rotate-180">→</span>
              </Link>
            </div>
          </div>
          {/* Mobile: horizontal scroll */}
          <div className="sm:hidden px-5 -mx-0.5">
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {data.categoriesPreview.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  to={`/memberships`}
                  className="snap-start shrink-0 w-[7.5rem] rounded-2xl bg-white border border-surface-100 p-4 flex flex-col items-center text-center gap-2.5 shadow-sm active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-pink-50 text-brand-pink-600 grid place-items-center [&_svg]:!w-6 [&_svg]:!h-6">
                    {getCategoryIcon(c.slug)}
                  </div>
                  <div className="text-[13px] font-bold text-surface-800 leading-tight">{isAr ? c.nameAr : c.nameEn}</div>
                </Link>
              ))}
            </div>
          </div>
          {/* Desktop: grid */}
          <div className="hidden sm:grid mx-auto max-w-6xl px-6 grid-cols-3 lg:grid-cols-6 gap-3">
            {data.categoriesPreview.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to={`/memberships`}
                className="card-elevated p-4 flex flex-col items-center text-center gap-2 hover:bg-brand-pink-50/40 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-pink-50 text-brand-pink-600 grid place-items-center group-hover:bg-brand-pink-100 transition-colors [&_svg]:!w-6 [&_svg]:!h-6">
                  {getCategoryIcon(c.slug)}
                </div>
                <div className="text-sm font-bold text-surface-800">{isAr ? c.nameAr : c.nameEn}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* PARTNER CLINICS */}
      {clinics.length > 0 && (
        <section id="clinics" className="bg-white border-y border-surface-100">
          <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10 sm:py-16">
            <div className="flex items-end justify-between mb-5 sm:mb-6">
              <div>
                <span className="inline-block rounded-full bg-brand-sage-100 px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-brand-sage-800">
                  {t("Where you'll glow", "أين ستتألقين")}
                </span>
                <h2 className="mt-2 sm:mt-3 text-xl sm:text-3xl font-black text-surface-900">
                  {t("Sessions take place at these clinics", "تُقام الجلسات في هذه العيادات")}
                </h2>
                <p className="text-xs sm:text-sm text-surface-500 mt-1">
                  {t("Hand-picked partners across Kuwait", "شركاء منتقون في جميع أنحاء الكويت")}
                </p>
              </div>
              <Link to="/clinics" className="text-sm font-bold text-brand-pink-600 hover:text-brand-pink-700 hidden sm:inline-flex items-center gap-1">
                {t("All clinics", "كل العيادات")} <span className="rtl:rotate-180">→</span>
              </Link>
            </div>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clinics.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  to={`/memberships`}
                  className="rounded-2xl sm:rounded-xl bg-white border border-surface-100 sm:border-0 p-4 sm:p-5 flex items-start gap-3 sm:gap-4 hover:bg-brand-pink-50/30 active:scale-[0.98] sm:active:scale-100 transition-all group shadow-sm sm:shadow-none card-elevated"
                >
                  <div className="shrink-0 w-11 sm:w-12 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-brand-pink-100 text-brand-pink-600 grid place-items-center font-black text-base sm:text-lg group-hover:bg-brand-pink-500 group-hover:text-white transition-colors">
                    {(isAr ? c.nameAr : c.nameEn).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-surface-900 leading-snug truncate text-sm sm:text-base">
                      {isAr ? c.nameAr : c.nameEn}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-surface-500 mt-0.5 sm:mt-1 line-clamp-2">
                      <span className="opacity-70">📍</span> {c.address}
                    </p>
                    <div className="mt-2 sm:mt-3 inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-brand-pink-600 group-hover:gap-2 transition-all">
                      {t("View memberships", "عرض الباقات")}
                      <span className="rtl:rotate-180">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-5 sm:hidden text-center">
              <Link to="/clinics" className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-surface-50 border border-surface-200 px-5 py-3 text-sm font-bold text-surface-700 hover:bg-surface-100 transition-colors">
                {t("All clinics", "كل العيادات")}
                <span className="rtl:rotate-180">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}


      {/* MEMBERSHIPS HIGHLIGHT — live from backend */}
      <section id="memberships" className="bg-gradient-to-b from-white to-brand-pink-50/40 border-y border-surface-100">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10 sm:py-20">
          <div className="flex items-end justify-between mb-8 sm:mb-10">
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-block rounded-full bg-brand-pink-100 px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-brand-pink-700">
                {t("Belamonda Memberships", "باقات بيلاموندو")}
              </span>
              <h2 className="mt-3 sm:mt-4 text-xl sm:text-3xl font-black text-surface-900">
                {t("Save more, glow more.", "وفّري أكثر، تألقي أكثر.")}
              </h2>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-surface-600 leading-relaxed">
                {t(
                  "Pick a yearly program that pays you back every visit. Free upgrades, locked cashback, exclusive access.",
                  "اختاري برنامجاً سنوياً يرد لكِ المال مع كل زيارة. ترقيات مجانية، كاش باك مقفل، ووصول حصري."
                )}
              </p>
            </div>
          </div>
          {data && (data.membershipOffers ?? []).length > 0 ? (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(data.membershipOffers ?? []).slice(0, 6).map((o) => (
                <MembershipCard key={o.id} offer={o} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-surface-500 text-sm">
              <Link to="/memberships" className="btn-secondary btn-sm">
                {t("View all packages", "عرض جميع الباقات")}
              </Link>
            </div>
          )}
          <div className="mt-6 sm:mt-8 text-center">
            <Link to="/memberships" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl sm:rounded-xl bg-surface-50 sm:bg-transparent border border-surface-200 sm:border-surface-200 px-5 py-3 sm:py-2.5 text-sm font-bold text-surface-700 hover:bg-surface-100 transition-colors">
              {t("Compare all packages", "قارني جميع الباقات")}
            </Link>
          </div>
        </div>
      </section>

      {/* CASHBACK EXPLAINER */}
      <section id="cashback" className="mx-auto max-w-6xl px-5 sm:px-6 py-10 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <div className="text-center sm:text-start">
            <span className="inline-block rounded-full bg-brand-sage-100 px-3 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-brand-sage-800">
              {t("How cashback works", "كيف يعمل الكاش باك")}
            </span>
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-3xl font-black text-surface-900">
              {t("Earn back on every session.", "استرجعي مع كل جلسة.")}
            </h2>
            <ol className="mt-5 sm:mt-6 space-y-4 text-start">
              {[
                { n: 1, t: t("Pick a membership or session plan", "اختاري باقة أو خطة جلسات"), d: t("Browse memberships and pick the right plan for you.", "تصفّحي الباقات واختاري الخطة الأنسب.") },
                { n: 2, t: t("Pay & get cashback locked", "ادفعي ويُقفل الكاش باك"), d: t("Cashback is added to your wallet — locked until you start using sessions.", "يُضاف الكاش باك إلى محفظتك ويُقفل حتى تبدئي باستخدام الجلسات.") },
                { n: 3, t: t("Spend cashback in clinic", "استخدميه في العيادة"), d: t("Use unlocked cashback as real KWD discount on services.", "استخدمي الكاش باك المفتوح كخصم حقيقي بالدينار على الخدمات.") },
              ].map((s) => (
                <li key={s.n} className="flex gap-3 sm:gap-4">
                  <div className="shrink-0 w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-brand-pink-500 text-white grid place-items-center font-black text-xs sm:text-sm shadow-md">
                    {s.n}
                  </div>
                  <div>
                    <div className="font-bold text-surface-900 text-sm sm:text-base">{s.t}</div>
                    <div className="text-xs sm:text-sm text-surface-600 mt-0.5 leading-relaxed">{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
            <Link to="/memberships" className="btn-primary btn-sm mt-6 sm:mt-8 inline-flex w-full sm:w-auto justify-center">
              {t("Browse cashback memberships", "تصفّحي عضويات الكاش باك")}
              <span className="rtl:rotate-180">→</span>
            </Link>
          </div>
          <div className="space-y-3">
            {(() => {
              const isLoggedIn = !!auth;
              const unlocked = isLoggedIn
                ? parseFloat(walletApiData?.wallet?.unlockedBalance || "0")
                : 240.000;
              const locked = isLoggedIn
                ? parseFloat(walletApiData?.wallet?.lockedBalance || "0")
                : 760.000;
              const used = isLoggedIn
                ? (walletApiData?.txns || []).filter(tx => tx.type === "deduction").reduce((s, tx) => s + parseFloat(tx.amountKwd || "0"), 0)
                : 500.000;
              const total = unlocked + locked;
              return (
                <div className="wallet-card max-w-sm mx-auto shadow-glow-lg">
                  <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <div>
                      <div className="text-white/80 text-xs sm:text-sm font-medium">{t("Cashback Wallet", "محفظة الكاش باك")}</div>
                      <div className="text-3xl sm:text-4xl font-black mt-1 text-white">
                        {total.toFixed(3)} <span className="text-lg sm:text-xl opacity-80">KWD</span>
                      </div>
                    </div>
                    <div className="bg-white/20 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-white backdrop-blur-md">
                      {isLoggedIn ? (total > 0 ? t("Active", "نشطة") : t("Inactive", "غير نشط")) : "demo"}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                    <div className="bg-white/15 rounded-xl p-2">
                      <div className="text-white/70 text-[9px] sm:text-[10px] mb-0.5 sm:mb-1">{t("Unlocked", "متاح")}</div>
                      <div className="text-white font-bold text-xs sm:text-sm">{unlocked.toFixed(3)}</div>
                    </div>
                    <div className="bg-white/15 rounded-xl p-2">
                      <div className="text-white/70 text-[9px] sm:text-[10px] mb-0.5 sm:mb-1">{t("Locked", "مقفل")}</div>
                      <div className="text-white font-bold text-xs sm:text-sm">{locked.toFixed(3)}</div>
                    </div>
                    <div className="bg-white/15 rounded-xl p-2">
                      <div className="text-white/70 text-[9px] sm:text-[10px] mb-0.5 sm:mb-1">{t("Used", "مستخدم")}</div>
                      <div className="text-white font-bold text-xs sm:text-sm">{used.toFixed(3)}</div>
                    </div>
                  </div>
                  {isLoggedIn && (
                    <Link to="/dashboard" className="mt-3 sm:mt-4 block text-center text-[11px] text-white/70 hover:text-white font-medium transition-colors">
                      {t("View full wallet →", "عرض المحفظة الكاملة ←")}
                    </Link>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 pb-10 sm:pb-16">
        <div className="rounded-[1.75rem] sm:rounded-3xl bg-brand-gradient p-7 sm:p-12 text-center text-white shadow-glow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h3 className="text-xl sm:text-3xl font-black">{t("Ready to start glowing?", "جاهزة للبدء؟")}</h3>
            <p className="mt-2 text-white/90 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
              {t("Create your free account and unlock your first cashback today.", "أنشئي حسابك المجاني واحصلي على أول كاش باك اليوم.")}
            </p>
            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center">
              <Link to="/signup" className="rounded-2xl sm:rounded-xl bg-white px-7 py-3.5 sm:py-3 text-sm font-extrabold text-brand-pink-600 hover:bg-surface-50 shadow-lg active:scale-95 transition-transform">
                {t("Create free account", "إنشاء حساب مجاني")}
              </Link>
              <Link to="/membership" className="rounded-2xl sm:rounded-xl bg-white/15 backdrop-blur border border-white/30 px-7 py-3.5 sm:py-3 text-sm font-extrabold text-white hover:bg-white/25 active:scale-95 transition-transform">
                {t("Browse memberships", "تصفّحي الباقات")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
