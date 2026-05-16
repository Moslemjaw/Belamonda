import { useState, useEffect } from "react";
import { useAuth } from "../app/AuthContext";
import i18n from "../app/i18n";
import { apiFetch, SITE_BASE_URL } from "../lib/api";

interface ReferralCodeData {
  code: string;
}

interface ReferralStatsData {
  referredCount: number;
  convertedCount: number;
  referredUsers: Array<{
    id: string;
    username?: string;
    fullName?: string;
    joinedAt: string;
  }>;
}

const ShareIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

export { ShareIcon };

export default function ShareLinkPage({ hideHeader }: { hideHeader?: boolean } = {}) {
  const { getAuthHeader, auth } = useAuth();
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const [codeData, setCodeData] = useState<ReferralCodeData | null>(null);
  const [statsData, setStatsData] = useState<ReferralStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyMsgCopied, setCopyMsgCopied] = useState(false);

  const isImpersonating = auth?.userId?.startsWith("impersonated_");

  const fullLink = codeData ? `${SITE_BASE_URL}/signup?ref=${codeData.code}` : "";

  const shareMessage = isAr
    ? `جربي Belamonda — منصة الجمال والعافية في الكويت! سجلي عبر رابطي الخاص واحصلي على أفضل العروض:\n${fullLink}`
    : `Try Belamonda — Kuwait's beauty & wellness platform! Register via my link for exclusive offers:\n${fullLink}`;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    if (isImpersonating) {
      setLoading(false);
      return;
    }

    const headers = getAuthHeader();
    Promise.all([
      apiFetch("/referral/my-code", { headers }),
      apiFetch("/referral/stats", { headers })
    ])
      .then(([code, stats]) => {
        if (!mounted) return;
        setCodeData(code as ReferralCodeData);
        setStatsData(stats as ReferralStatsData);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        console.error("[ShareLinkPage] Failed to load referral data:", err);
        setFetchError(true);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [getAuthHeader, retryCount, isImpersonating]);

  const copyLink = () => {
    if (!fullLink) return;
    navigator.clipboard.writeText(fullLink).catch((err: unknown) => {
      console.error("[ShareLinkPage] Failed to copy link:", err);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMessage = () => {
    if (!shareMessage) return;
    navigator.clipboard.writeText(shareMessage).catch((err: unknown) => {
      console.error("[ShareLinkPage] Failed to copy message:", err);
    });
    setCopyMsgCopied(true);
    setTimeout(() => setCopyMsgCopied(false), 2000);
  };

  if (isImpersonating) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-3 bg-surface-50 border border-surface-200 rounded-2xl">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3">⚠️</div>
        <h3 className="text-sm font-bold text-surface-900">
          {t("Referral Link Unavailable", "رابط الإحالة غير متاح")}
        </h3>
        <p className="text-xs text-surface-500">
          {t(
            "You are impersonating this clinic. Referral links are only available when the actual clinic staff logs in.",
            "أنت تحاكي هذه العيادة. روابط الإحالة متاحة فقط عند تسجيل دخول طاقم العيادة الفعلي."
          )}
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-3">
        <p className="text-sm text-red-500 font-medium">
          {t("Unable to load referral data.", "تعذّر تحميل بيانات الإحالة.")}
        </p>
        <button
          onClick={() => { setFetchError(false); setLoading(true); setRetryCount((c) => c + 1); }}
          className="btn-primary btn-sm text-xs"
        >
          {t("Try Again", "إعادة المحاولة")}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {!hideHeader && (
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{t("Share Link", "رابط الإحالة")}</h2>
          <p className="text-sm text-surface-500 mt-1">
            {t(
              "Share your unique referral link with potential customers. You'll be notified when they complete their first purchase.",
              "شارك رابطك الفريد مع العملاء المحتملين. ستصلك إشعار عند إتمام أول عملية شراء."
            )}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="stat-label">{t("Total Referred", "إجمالي المُحالين")}</div>
          <div className="stat-value text-brand-pink-500">
            {loading ? "—" : (statsData?.referredCount ?? 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("Conversions", "تحويلات (أول شراء)")}</div>
          <div className="stat-value text-emerald-600">
            {loading ? "—" : (statsData?.convertedCount ?? 0)}
          </div>
        </div>
      </div>

      {/* Referral link box */}
      <div className="card-elevated p-5">
        <div className="text-sm font-bold text-surface-900 mb-3">{t("Your Unique Link", "رابطك الفريد")}</div>
        {loading ? (
          <div className="shimmer h-12 rounded-xl" />
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={fullLink}
              className="input-field font-mono text-xs flex-1 bg-surface-50 select-all"
              dir="ltr"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={copyLink}
              className={`btn-primary px-4 shrink-0 transition-all ${copied ? "!bg-emerald-500 hover:!bg-emerald-600" : ""}`}
            >
              {copied ? t("Copied!", "تم!") : t("Copy", "نسخ")}
            </button>
          </div>
        )}
        {codeData && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-surface-400">{t("Your code:", "كودك:")}</span>
            <span className="text-xs font-mono font-bold bg-surface-100 px-2 py-0.5 rounded-lg text-surface-700 tracking-wider">
              {codeData.code}
            </span>
          </div>
        )}
      </div>

      {/* Share message */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold text-surface-900">{t("Ready-to-Share Message", "نص جاهز للمشاركة")}</div>
          <button
            onClick={copyMessage}
            disabled={!fullLink}
            className={`btn-ghost btn-sm text-xs border border-surface-200 ${copyMsgCopied ? "text-emerald-600 border-emerald-300 bg-emerald-50" : ""}`}
          >
            {copyMsgCopied ? t("Copied!", "تم النسخ!") : t("Copy message", "نسخ الرسالة")}
          </button>
        </div>
        <div className="bg-surface-50 rounded-xl p-4 text-sm text-surface-700 leading-relaxed whitespace-pre-line border border-surface-100">
          {fullLink
            ? shareMessage
            : <span className="shimmer block h-16 rounded-lg" />}
        </div>
      </div>

      {/* How it works */}
      <div className="card-elevated p-5">
        <div className="text-sm font-bold text-surface-900 mb-4">{t("How it works", "كيف يعمل")}</div>
        <div className="space-y-3">
          {[
            {
              step: "1",
              en: "Copy your unique link and share it with potential customers via WhatsApp, email, or social media.",
              ar: "انسخ رابطك الفريد وشاركيه مع العملاء عبر واتساب أو البريد أو وسائل التواصل."
            },
            {
              step: "2",
              en: "When they register using your link, they're tracked as your referral automatically.",
              ar: "عندما يسجلون عبر رابطك، يُسجَّلون كإحالة خاصة بك تلقائياً."
            },
            {
              step: "3",
              en: "You receive an in-app notification the moment they complete their first purchase.",
              ar: "تصلك إشعار فوري داخل التطبيق فور إتمامهم لأول عملية شراء."
            }
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-gradient text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </div>
              <p className="text-sm text-surface-600">{isAr ? item.ar : item.en}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referred users list */}
      {!loading && (statsData?.referredUsers || []).length > 0 && (
        <div className="card-elevated overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <div className="text-sm font-bold text-surface-900">{t("Referred Customers", "العملاء المُحالون")}</div>
            <div className="text-xs text-surface-400 mt-0.5">{t("Customers who registered via your link", "عملاء سجلوا عبر رابطك")}</div>
          </div>
          <div className="divide-y divide-surface-100">
            {(statsData!.referredUsers).map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="avatar avatar-sm text-xs">
                    {(u.fullName || u.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-surface-900 text-sm">
                      {u.fullName || u.username || t("Customer", "عميل")}
                    </div>
                    <div className="text-xs text-surface-400">
                      {t("Joined", "انضم")} {new Date(u.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (statsData?.referredUsers || []).length === 0 && (
        <div className="card-elevated p-10 text-center border-dashed border-2 border-surface-200">
          <div className="w-14 h-14 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShareIcon />
          </div>
          <div className="text-sm font-bold text-surface-700">{t("No referrals yet", "لا إحالات بعد")}</div>
          <div className="text-xs text-surface-400 mt-1">
            {t("Start sharing your link to bring in new customers.", "ابدأ بمشاركة رابطك لجلب عملاء جدد.")}
          </div>
        </div>
      )}
    </div>
  );
}
