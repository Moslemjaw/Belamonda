import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import PublicLayout from "../components/PublicLayout";
import { getCategoryIcon } from "../components/CategoryIcons";
import { useAuth } from "../app/AuthContext";

type Offer = {
  id: string;
  name: string;
  nameAr?: string;
  type: "A" | "B";
  category: string;
  clinicId: string;
  subscriptionPriceKwd: string;
  validityDays: number;
  cashbackPerSessionKwd: string;
  sessionIntervalDays?: number;
  maxSessions?: number;
  signupCashbackKwd: string;
  cashbackActivationFeeKwd: string;
  allowFullPayment: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  allowDeposit: boolean;
  depositAmountKwd: string;
  description?: string;
  terms?: string;
  tagsEn?: string[];
  tagsAr?: string[];
  perVisitPriceKwd?: string;
  originalClinicPriceKwd?: string;
  imageUrl?: string;
  featured?: boolean;
  status?: string;
};
type Clinic = { id: string; nameEn: string; nameAr: string; address: string; phone?: string };

export default function OfferDetailPage() {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/offers/${id}`)
      .then(async (raw) => {
        const d = raw as { offer: Offer };
        setOffer(d.offer);
        try {
          const cRaw = await apiFetch(`/clinics`);
          const c = cRaw as { items: Clinic[] };
          const found = c.items.find((x) => x.id === d.offer.clinicId);
          if (found) setClinic(found);
        } catch {
          /* ignore clinic fetch errors */
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
          <div className="h-64 shimmer rounded-3xl" />
          <div className="mt-6 h-6 w-1/2 shimmer rounded" />
          <div className="mt-3 h-4 w-1/3 shimmer rounded" />
        </div>
      </PublicLayout>
    );
  }

  if (error || !offer) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-20 text-center">
          <h1 className="text-2xl font-black text-surface-900">{t("Membership not found", "العضوية غير موجودة")}</h1>
          <p className="mt-2 text-surface-500">{error}</p>
          <Link to="/memberships" className="btn-primary btn-sm mt-6">{t("Browse memberships", "تصفّحي العضويات")}</Link>
        </div>
      </PublicLayout>
    );
  }

  const tags = (isAr ? offer.tagsAr : offer.tagsEn) ?? [];
  const cashback = parseFloat(offer.signupCashbackKwd ?? "0");
  const perSession = parseFloat(offer.cashbackPerSessionKwd ?? "0");

  return (
    <PublicLayout>
      <section className="border-b border-surface-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 text-xs text-surface-500">
          <Link to="/" className="hover:text-brand-pink-600">{t("Home", "الرئيسية")}</Link>
          <span className="mx-2">/</span>
          <Link to="/memberships" className="hover:text-brand-pink-600">{t("Memberships", "العضويات")}</Link>
          <span className="mx-2">/</span>
          <span className="text-surface-700 font-semibold">{offer.name}</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 lg:py-12 grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-[16/9] rounded-3xl overflow-hidden bg-gradient-to-br from-brand-pink-100 via-brand-pink-50 to-brand-sage-100 grid place-items-center">
            {offer.imageUrl ? (
              <img src={offer.imageUrl} alt={offer.name} className="absolute inset-0 w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
            ) : (
              <div className="text-brand-pink-400/70 [&_svg]:!w-24 [&_svg]:!h-24">
                {getCategoryIcon(offer.category)}
              </div>
            )}
            {offer.featured && (
              <span className="absolute top-4 start-4 rounded-full bg-white/95 backdrop-blur px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-pink-600 shadow">
                ✨ {t("Featured", "مميّز")}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-pink-500">
              <span className="[&_svg]:!w-4 [&_svg]:!h-4">{getCategoryIcon(offer.category)}</span>
              {offer.category}
              <span className="text-surface-300">•</span>
              {offer.type === "A" ? t("Subscription", "اشتراك") : t("Per visit", "بزيارة")}
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-surface-900 leading-tight">
              {isAr ? (offer.nameAr || offer.name) : offer.name}
            </h1>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-brand-sage-50 px-3 py-1 text-xs font-semibold text-brand-sage-700">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {offer.description && (
            <div>
              <h2 className="text-lg font-bold text-surface-900 mb-2">{t("About this membership", "عن هذه العضوية")}</h2>
              <p className="text-surface-600 leading-relaxed whitespace-pre-line">{offer.description}</p>
            </div>
          )}

          {/* Highlights */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Highlight label={t("Validity", "الصلاحية")} value={`${offer.validityDays} ${t("days", "يوم")}`} icon="📅" />
            {offer.maxSessions && (
              <Highlight label={t("Max sessions", "الحد الأقصى للجلسات")} value={String(offer.maxSessions)} icon="✨" />
            )}
            {offer.sessionIntervalDays != null && offer.sessionIntervalDays > 0 && (
              <Highlight label={t("Session interval", "الفاصل بين الجلسات")} value={`${offer.sessionIntervalDays} ${t("days", "يوم")}`} icon="⏱" />
            )}
            {offer.type === "B" && offer.perVisitPriceKwd && (
              <Highlight label={t("Per-visit price", "سعر الزيارة")} value={`${offer.perVisitPriceKwd} KWD`} icon="💎" />
            )}
            {cashback > 0 && (
              <Highlight label={t("Signup cashback", "كاش باك التسجيل")} value={`${offer.signupCashbackKwd} KWD`} icon="🎁" />
            )}
            {perSession > 0 && (
              <Highlight label={t("Per-session cashback", "كاش باك الجلسة")} value={`${offer.cashbackPerSessionKwd} KWD`} icon="💝" />
            )}
          </div>

          {offer.terms && (
            <div className="rounded-2xl bg-surface-50 border border-surface-100 p-5">
              <h3 className="font-bold text-surface-900 mb-2 text-sm">{t("Terms & Conditions", "الشروط والأحكام")}</h3>
              <p className="text-xs text-surface-600 leading-relaxed whitespace-pre-line">{offer.terms}</p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-2 space-y-4">
          <div className="card-elevated p-6 sticky top-20">
            {offer.type === "B" && offer.originalClinicPriceKwd && (
              <div className="text-xs text-surface-400 line-through">{offer.originalClinicPriceKwd} KWD</div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-brand-pink-600">{offer.subscriptionPriceKwd}</span>
              <span className="text-sm font-bold text-surface-400">KWD</span>
            </div>
            <div className="text-xs text-surface-500 mt-0.5">
              {offer.type === "A" ? t("Total package price", "سعر الباقة الكامل") : t("Per visit", "للزيارة الواحدة")}
            </div>

            <div className="mt-5 space-y-2">
              {offer.allowFullPayment && (
                <PayOption label={t("Full payment", "دفع كامل")} sub={t("Pay once, done.", "ادفعي مرة واحدة.")} amount={`${offer.subscriptionPriceKwd} KWD`} />
              )}
              {offer.allowInstallments && offer.maxInstallments > 1 && (
                <PayOption
                  label={t("Installments", "أقساط")}
                  sub={`${offer.maxInstallments} × ${(parseFloat(offer.subscriptionPriceKwd) / offer.maxInstallments).toFixed(3)} KWD`}
                  amount={t("Flexible", "مرن")}
                />
              )}
              {offer.allowDeposit && parseFloat(offer.depositAmountKwd) > 0 && (
                <PayOption
                  label={t("Deposit", "عربون")}
                  sub={t("Pay deposit, rest in clinic.", "ادفعي العربون والباقي في العيادة.")}
                  amount={`${offer.depositAmountKwd} KWD`}
                />
              )}
            </div>

            {offer.status === "expired" ? (
              <button disabled className="btn-secondary w-full mt-5 justify-center opacity-70 cursor-not-allowed">
                {t("Offer Expired", "العرض منتهي")}
              </button>
            ) : auth ? (
              auth.role === "customer" ? (
                <Link
                  to={`/dashboard?offerId=${offer.id}`}
                  className="btn-primary w-full mt-5 justify-center"
                >
                  {t("Get this offer", "احصلي على العرض")}
                </Link>
              ) : (
                <Link to="/dashboard" className="btn-primary w-full mt-5 justify-center">
                  {t("Open dashboard", "افتح لوحة التحكم")}
                </Link>
              )
            ) : (
                <Link
                to={`/login?next=/memberships/${offer.id}`}
                className="btn-primary w-full mt-5 justify-center"
              >
                {t("Sign in to purchase", "سجّلي الدخول لشراء العضوية")}
              </Link>
            )}
            <p className="text-[10px] text-surface-400 text-center mt-2">
              {t("Mock checkout — no real charge.", "بيع تجريبي — لا توجد رسوم حقيقية.")}
            </p>

            {clinic && (
              <div className="mt-5 pt-5 border-t border-surface-100">
                <div className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-2">
                  {t("Clinic", "العيادة")}
                </div>
                <div className="font-bold text-surface-900">{isAr ? clinic.nameAr : clinic.nameEn}</div>
                <div className="text-xs text-surface-500 mt-0.5">{clinic.address}</div>
                {clinic.phone && <div className="text-xs text-surface-500 mt-0.5">📞 {clinic.phone}</div>}
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* Mobile sticky CTA bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-surface-200 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-black text-brand-pink-600">{offer.subscriptionPriceKwd} <span className="text-xs font-semibold text-surface-400">KWD</span></div>
          <div className="text-[10px] text-surface-500">{offer.type === "A" ? t("Total package", "سعر الباقة") : t("Per visit", "للزيارة")}</div>
        </div>
        {offer.status === "expired" ? (
          <button disabled className="btn-secondary flex-1 max-w-[200px] justify-center opacity-70 cursor-not-allowed">
            {t("Expired", "منتهي")}
          </button>
        ) : auth && auth.role === "customer" ? (
          <Link to={`/dashboard?offerId=${offer.id}`} className="btn-primary flex-1 max-w-[200px] justify-center">
            {t("Get this offer", "احصلي على العرض")}
          </Link>
        ) : (
          <Link
            to={auth ? "/dashboard" : `/login?next=/memberships/${offer.id}`}
            className="btn-primary flex-1 max-w-[200px] justify-center"
          >
            {auth ? t("Open dashboard", "لوحة التحكم") : t("Sign in to purchase", "سجّلي الدخول")}
          </Link>
        )}
      </div>
      {/* spacer so content isn't hidden behind mobile CTA */}
      <div className="lg:hidden h-16" />
    </PublicLayout>
  );
}

function Highlight({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card-elevated p-4 flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{label}</div>
        <div className="font-bold text-surface-900 text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

function PayOption({ label, sub, amount }: { label: string; sub: string; amount: string }) {
  return (
    <div className="rounded-xl border border-surface-200 p-3 flex items-center justify-between hover:border-brand-pink-300 transition-colors">
      <div>
        <div className="font-bold text-sm text-surface-900">{label}</div>
        <div className="text-[11px] text-surface-500">{sub}</div>
      </div>
      <div className="text-sm font-bold text-brand-pink-600">{amount}</div>
    </div>
  );
}
