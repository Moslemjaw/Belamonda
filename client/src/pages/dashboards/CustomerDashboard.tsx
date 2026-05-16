import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../app/AuthContext";
import { useMyReservations, type ReservationItem } from "../../hooks/useApi";
import { useWallet, useMyOffers, useMySessions, useMyComplaints, useNotifications, useApi, useMyClinicChangeRequests, invalidateCache } from "../../hooks/useApi";
import { apiFetch, API_BASE_URL, SITE_BASE_URL } from "../../lib/api";
import i18n from "../../app/i18n";
import { BelamondaIcon } from "../../components/BelamondaLogo";
import QRCodeCanvas from "../../components/QRCodeCanvas";
import QRCode from "qrcode";
import { treatmentCategories, allTreatments, clinics } from "../../lib/treatments";
import { getCategoryIcon } from "../../components/CategoryIcons";
import CheckoutModal from "../../components/CheckoutModal";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
type ApiOfferRow = {
  id: string;
  _id?: string;
  name: string;
  subtitle?: string;
  originalClinicPriceKwd?: string;
  type: "A" | "B";
  category: string;
  clinicId: string;
  subscriptionPriceKwd: string;
  maxSessions?: number;
  active: boolean;
  allowFullPayment?: boolean;
  allowInstallments?: boolean;
  maxInstallments?: number;
  allowDeposit?: boolean;
  depositAmountKwd?: string;
  signupCashbackKwd?: string;
  cashbackPerSessionKwd?: string;
  isCashbackOnly?: boolean;
};

const ar = () => i18n.language === "ar";

function computeOfferCashbackParts(o: {
  cashbackBalanceKwd?: string;
  totalSignupCashbackKwd?: string;
  cashbackGrantedKwd?: string;
  signupCashbackKwd?: string;
}) {
  const remainingCb = parseFloat(o.cashbackBalanceKwd || "0");
  const totalSignup = parseFloat(o.totalSignupCashbackKwd || o.signupCashbackKwd || "0");
  const granted = parseFloat(o.cashbackGrantedKwd || "0");
  if (totalSignup > 0) {
    return {
      unlocked: remainingCb,
      locked: Math.max(0, totalSignup - granted),
      total: totalSignup,
      hasInstallmentTracking: true,
    };
  }
  return {
    unlocked: remainingCb,
    locked: 0,
    total: remainingCb,
    hasInstallmentTracking: false,
  };
}

function CashbackProgressBar({ unlocked, locked }: { unlocked: number; locked: number }) {
  const total = unlocked + locked;
  const pct = total > 0 ? Math.min((unlocked / total) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

const CustomerIcons = {
  home: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  offers: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
  wallet: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  profile: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  help: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0 9 9 0 0112.728 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01M11 13a1 1 0 011-1 2 2 0 10-2-2"/></svg>,
  card: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>,
};

// ==========================================
// Purchase Modal Component
// ==========================================
function ReservationConvertControls({
  userOfferId,
  preferredPlan,
  ar,
  getAuthHeader,
  onDone
}: {
  userOfferId: string;
  preferredPlan?: string;
  ar: boolean;
  getAuthHeader: () => Record<string, string> | undefined;
  onDone: (message: string) => void | Promise<void>;
}) {
  const initialPlan = (preferredPlan as "full" | "installments_2" | "installments_3" | "installments_4_enet" | undefined) || "full";
  const [plan, setPlan] = useState<"full" | "installments_2" | "installments_3" | "installments_4_enet">(initialPlan);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await apiFetch("/checkout/deposit/convert", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ userOfferId, plan })
      });
      await onDone(ar ? "تم تفعيل العرض" : "Offer activated");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ar ? "فشل الإكمال" : "Failed";
      await onDone(msg);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value as typeof plan)}
        disabled={busy}
        className="text-xs rounded-lg border border-blue-300 bg-white px-2 py-1.5 font-medium"
      >
        <option value="full">{ar ? "دفع كامل" : "Full payment"}</option>
        <option value="installments_2">{ar ? "قسطين" : "2 installments"}</option>
        <option value="installments_3">{ar ? "ثلاثة أقساط" : "3 installments"}</option>
        <option value="installments_4_enet">{ar ? "٤ أقساط (ENET)" : "4 installments (ENET)"}</option>
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg"
      >
        {busy ? (ar ? "جاري…" : "Working…") : ar ? "أكملي الدفع" : "Complete balance"}
      </button>
    </div>
  );
}

function SessionPaymentRow({
  request,
  clinicName,
  ar,
  getAuthHeader,
  onDone
}: {
  request: { id: string; sessionPriceKwd?: string; preferredAt?: string; createdAt: string };
  clinicName: string;
  ar: boolean;
  getAuthHeader: () => Record<string, string> | undefined;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      await apiFetch(`/scheduling/me/requests/${request.id}/pay-session`, {
        method: "POST",
        headers: getAuthHeader()
      });
      await onDone();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ar ? "فشل الدفع" : "Payment failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <div className="font-bold text-amber-900 text-sm">{ar ? "رسوم الجلسة مطلوبة" : "Session fee required"}</div>
          <div className="text-xs text-amber-700 mt-0.5">{ar ? "العيادة:" : "Clinic:"} <span className="font-semibold">{clinicName}</span></div>
          {request.preferredAt && (
            <div className="text-xs text-amber-600 mt-0.5">{ar ? "التاريخ المفضل:" : "Preferred:"} {new Date(request.preferredAt).toLocaleDateString()}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {request.sessionPriceKwd && (
          <span className="font-black text-amber-700">{request.sessionPriceKwd} KWD</span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void pay()}
          className="text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors"
        >
          {busy ? (ar ? "جاري…" : "Processing…") : ar ? "ادفع رسوم الجلسة" : "Pay session fee"}
        </button>
      </div>
    </div>
  );
}

function PurchaseModal({ pkg, onClose, inviteCode }: { pkg: any; onClose: () => void, inviteCode?: string | null }) {
  const [paymentOption, setPaymentOption] = useState(() => {
    if (pkg.allowFullPayment) return "full";
    if (pkg.allowInstallments) return "installments";
    if (pkg.allowENet) return "enet4";
    if (pkg.allowDeposit) return "deposit";
    return "full";
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  
  const priceNum = parseFloat(pkg.subscriptionPriceKwd || pkg.price || "0");
  const isInstallment = pkg.allowInstallments && pkg.maxInstallments;
  const installmentAmount = isInstallment ? priceNum / pkg.maxInstallments : 0;

  const handlePurchase = async () => {
     setLoading(true);
     setErrorMsg(null);
     try {
       let endpoint = "";
       let body: any = { offerId: pkg.id || pkg._id };
       if (inviteCode) body.groupInviteCode = inviteCode;
       if (paymentOption === "full") {
          endpoint = "/checkout/full";
       } else if (paymentOption === "installments") {
          endpoint = "/checkout/installments";
          body.count = parseInt(pkg.maxInstallments) || 2;
       } else if (paymentOption === "enet4") {
          endpoint = "/checkout/enet4";
       } else if (paymentOption === "deposit") {
          endpoint = "/checkout/deposit";
       }
       
       await apiFetch(endpoint, {
         method: "POST",
         headers: getAuthHeader(),
         body: JSON.stringify(body)
       });
       alert(ar() ? "تم الاشتراك بنجاح!" : "Subscribed successfully!");
       onClose();
       window.location.reload();
     } catch (e: any) {
       const msg = e instanceof Error ? e.message : "Error";
       const data = (e as any)?.data as { forms?: any[] } | undefined;
       if (msg === "EFORMS_REQUIRED" && data?.forms?.[0]) {
         const first = data.forms[0];
         onClose();
         navigate(`/forms/fill/${first.id || first.formId}?offerId=${pkg.id || pkg._id}&return=/dashboard`);
       } else {
         setErrorMsg(msg);
       }
     } finally {
       setLoading(false);
     }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-md animate-fade-in">
       <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
         <div className="p-6 border-b border-surface-100 flex justify-between items-center bg-surface-50">
            <div>
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "تأكيد العضوية" : "Confirm Membership"}</h3>
              <div className="text-sm font-medium text-brand-pink-500 mt-1">{pkg.name || pkg.title}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors">✕</button>
         </div>
         <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            
            {pkg.isGroupOffer && (
              <div className={`border rounded-2xl p-4 flex gap-3 ${pkg.groupRewardType === 'split_bill' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl ${pkg.groupRewardType === 'split_bill' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                  {pkg.groupRewardType === 'split_bill' ? '🧾' : '👥'}
                </div>
                <div>
                  {pkg.groupRewardType === 'split_bill' ? (
                    <>
                      <h4 className="font-bold text-blue-800 text-sm mb-1">{ar() ? "تقسيم الفاتورة بين الأصدقاء!" : "Split the Bill with Friends!"}</h4>
                      <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        {(() => {
                          const total = parseFloat(pkg.price ?? pkg.subscriptionPriceKwd ?? '0') || 0;
                          const count = pkg.groupSizeRequired || 1;
                          const perPerson = (total / count).toFixed(3);
                          return ar()
                            ? `ادفع ${perPerson} KWD فقط! شارك مع ${count} أشخاص بالضبط وتقاسموا الفاتورة الكلية (${total.toFixed(3)} KWD). يجب أن يكون العدد ${count} أشخاص لا أقل.`
                            : `Pay only ${perPerson} KWD each! Group up with exactly ${count} people and split the total bill (${total.toFixed(3)} KWD). Minimum ${count} people required — no less accepted.`;
                        })()}
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-emerald-800 text-sm mb-1">{ar() ? "عرض جماعي متاح!" : "Group Offer Available!"}</h4>
                      <p className="text-xs text-emerald-600 leading-relaxed font-medium">
                        {ar() ? `بعد الاشتراك، قم بدعوة ${pkg.groupSizeRequired - 1} أصدقاء للحصول على ${pkg.groupRewardType === 'free_session' ? 'جلسة مجانية' : 'مكافأة'}!` : `After subscribing, invite ${pkg.groupSizeRequired - 1} friends to unlock ${pkg.groupRewardType === 'free_session' ? 'a free session' : 'a special reward'}!`}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
               <h4 className="font-bold text-surface-900 mb-4">{ar() ? "اختر طريقة الدفع" : "Select Payment Method"}</h4>
               {errorMsg && <div className="p-3 mb-4 text-xs font-bold text-red-700 bg-red-100 rounded-lg">{errorMsg}</div>}
               <div className="space-y-3">
                 
                 {/* FULL PAYMENT */}
                 {pkg.allowFullPayment && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'full' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="full" checked={paymentOption === 'full'} onChange={() => setPaymentOption('full')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "دفع كامل" : "Full Payment"}</div>
                        <div className="text-sm text-surface-500">{ar() ? "ادفع المبلغ كاملاً الآن" : "Pay the full amount now"}</div>
                      </div>
                      <div className="font-black text-brand-pink-600">{priceNum.toFixed(3)} KWD</div>
                   </label>
                 )}

                 {/* INSTALLMENTS */}
                 {pkg.allowInstallments && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'installments' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="installments" checked={paymentOption === 'installments'} onChange={() => setPaymentOption('installments')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "أقساط العيادة" : "Clinic Installments"}</div>
                        <div className="text-xs text-surface-500 mt-1">{ar() ? `ادفع على ${pkg.maxInstallments} دفعات ميسرة` : `Pay flexibly in ${pkg.maxInstallments} installments`}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{installmentAmount.toFixed(3)} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "للدفعة الواحدة" : "per installment"}</div>
                      </div>
                   </label>
                 )}

                 {/* eNet (4 Installments) */}
                 {pkg.allowENet && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'enet4' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="enet4" checked={paymentOption === 'enet4'} onChange={() => setPaymentOption('enet4')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "الدفع الإلكتروني (4 أقساط eNet)" : "eNet (Pay in 4)"}</div>
                        <div className="text-xs text-surface-500 mt-1">{ar() ? "قسم مشترياتك على 4 أقساط شهرية عبر eNet" : "Split your purchase into 4 monthly payments via eNet"}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{(priceNum / 4).toFixed(3)} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "للدفعة" : "per month"}</div>
                      </div>
                   </label>
                 )}

                 {/* PAY LATER (Deposit) */}
                 {pkg.allowDeposit && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'deposit' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="deposit" checked={paymentOption === 'deposit'} onChange={() => setPaymentOption('deposit')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "عربون (الدفع لاحقاً)" : "Pay Deposit"}</div>
                        <div className="text-sm text-surface-500">{ar() ? "ادفع عربون الآن والباقي في العيادة" : "Pay a deposit now, rest at the clinic"}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{parseFloat(pkg.depositAmountKwd || pkg.depositAmount || "0").toFixed(3)} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "عربون" : "Deposit"}</div>
                      </div>
                   </label>
                 )}
               </div>
            </div>

         </div>
         <div className="p-6 border-t border-surface-100 bg-surface-50 flex gap-3">
            <button disabled={loading} className="btn-primary flex-1 py-3.5 text-base font-bold shadow-brand-pink-500/30 shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:hover:scale-100" onClick={handlePurchase}>{loading ? (ar() ? "جاري المعالجة..." : "Processing...") : (ar() ? "تأكيد ودفع" : "Confirm & Pay")}</button>
         </div>
       </div>
    </div>
  )
}

// ==========================================
// KYC Page Component
// ==========================================
function KycVerificationPage({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { getAuthHeader } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [form, setForm] = useState({
    civilId: "",
    terms1: false,
    terms2: false,
    terms3: false,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const submitKyc = async () => {
    setKycError(null);
    if (!form.terms1 || !form.terms2 || !form.terms3) {
      setKycError(ar() ? "يرجى الموافقة على جميع الشروط" : "Please agree to all terms");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/kyc/submit", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          civilIdNumber: form.civilId || "290100000012",
          civilIdFrontRef: "front.png",
          civilIdBackRef: "back.png",
          signatureRef: "sig.png",
          checkboxes: { termsAndConditions: true, dataPrivacyConsent: true, serviceLiabilityWaiver: true, age18Plus: true, paymentTermsAcknowledgment: true },
        }),
      });
      onComplete();
    } catch (e: any) {
      setKycError(e.message || (ar() ? "فشل الإرسال" : "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <header className="bg-white border-b border-surface-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={onCancel} className="p-2 -ml-2 text-surface-500 hover:bg-surface-100 rounded-full transition-colors rtl:-mr-2 rtl:-ml-0">
          <svg className="h-6 w-6 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-bold text-surface-900">{ar() ? "توثيق الحساب (KYC)" : "Identity Verification"}</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 lg:p-8 animate-fade-in">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-brand-pink-400" : "bg-surface-200"}`} />
          ))}
        </div>

        {kycError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 font-medium animate-fade-in">
            {kycError}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-slide-in-right">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-pink-100 text-brand-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
              </div>
              <h2 className="text-xl font-bold text-surface-900">{ar() ? "الرقم المدني" : "Civil ID Details"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "يرجى إدخال رقمك المدني المكون من 12 رقم" : "Please enter your 12-digit Civil ID number"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">{ar() ? "الرقم المدني" : "Civil ID Number"}</label>
              <input type="text" className="input-field text-center text-lg tracking-widest" placeholder="290XXXXXXXXX" value={form.civilId} onChange={e => setForm({...form, civilId: e.target.value})} maxLength={12} />
            </div>
            <button className="btn-primary w-full btn-lg" onClick={() => setStep(2)} disabled={form.civilId.length < 12}>{ar() ? "متابعة" : "Continue"}</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-slide-in-right">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-pink-100 text-brand-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-surface-900">{ar() ? "صورة البطاقة" : "Upload Documents"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "قم برفع صورة البطاقة المدنية من الجهتين" : "Upload the front and back of your Civil ID"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-dashed border-brand-pink-200 bg-brand-pink-50/30 rounded-2xl p-6 text-center cursor-pointer hover:bg-brand-pink-50 transition-colors">
                <span className="text-2xl mb-2 block">📷</span>
                <span className="text-xs font-semibold text-brand-pink-600">{ar() ? "الجهة الأمامية" : "Front Side"}</span>
              </div>
              <div className="border-2 border-dashed border-brand-pink-200 bg-brand-pink-50/30 rounded-2xl p-6 text-center cursor-pointer hover:bg-brand-pink-50 transition-colors">
                <span className="text-2xl mb-2 block">📷</span>
                <span className="text-xs font-semibold text-brand-pink-600">{ar() ? "الجهة الخلفية" : "Back Side"}</span>
              </div>
            </div>
            <button className="btn-primary w-full btn-lg mt-4" onClick={() => setStep(3)}>{ar() ? "متابعة" : "Continue"}</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-slide-in-right">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-pink-100 text-brand-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-surface-900">{ar() ? "الإقرار والتوقيع" : "Digital Signature & Terms"}</h2>
            </div>
            
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-200 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 text-brand-pink-500 rounded border-surface-300 focus:ring-brand-pink-400" checked={form.terms1} onChange={e => setForm({...form, terms1: e.target.checked})} />
                <span className="text-sm text-surface-700">{ar() ? "أوافق على الشروط والأحكام العامة للمنصة." : "I agree to the general Terms & Conditions."}</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 text-brand-pink-500 rounded border-surface-300 focus:ring-brand-pink-400" checked={form.terms2} onChange={e => setForm({...form, terms2: e.target.checked})} />
                <span className="text-sm text-surface-700">{ar() ? "أوافق على سياسة الخصوصية واستخدام البيانات." : "I agree to the Data Privacy Policy."}</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 text-brand-pink-500 rounded border-surface-300 focus:ring-brand-pink-400" checked={form.terms3} onChange={e => setForm({...form, terms3: e.target.checked})} />
                <span className="text-sm text-surface-700">{ar() ? "أقر بصحة جميع البيانات المرفقة." : "I acknowledge all provided information is correct."}</span>
              </label>
            </div>

            <button className="btn-primary w-full btn-lg" onClick={submitKyc} disabled={submitting}>
              {submitting ? (ar() ? "جاري الإرسال..." : "Submitting...") : (ar() ? "اعتماد وإرسال" : "Sign & Submit")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// Main Customer App Component
// ==========================================

type EFormPending = { formId: string; title: string };

function MyFormsSection() {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const { data: subsData, loading: lSubs, refetch } = useApi<{ items: any[] }>("/eforms/me/submissions");
  const { data: avail, loading: lAvail } = useApi<{ items: any[] }>("/eforms/me/available");
  const subs = subsData?.items ?? [];
  const available = avail?.items ?? [];

  const downloadPdf = async (id: string) => {
    const token = (getAuthHeader() as any)?.Authorization?.replace("Bearer ", "");
    try {
      const r = await fetch(`${API_BASE_URL}/eforms/submissions/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error("Failed");
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = `form-${id}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-surface-900">{ar() ? "نماذجي الموقعة" : "My Signed Forms"}</h2>

      {available.length > 0 && (
        <div className="card-elevated p-4">
          <div className="text-sm font-bold text-surface-900 mb-3">{ar() ? "نماذج بانتظار التعبئة" : "Forms awaiting signature"}</div>
          <div className="space-y-2">
            {available.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 rounded-xl p-3">
                <div>
                  <div className="font-bold text-surface-900 text-sm">{f.title}</div>
                  {f.description && <div className="text-xs text-surface-500">{f.description}</div>}
                </div>
                <button className="btn-primary btn-sm" onClick={() => navigate(`/forms/fill/${f.id}?return=/dashboard`)}>
                  {ar() ? "تعبئة" : "Fill"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <div className="p-4 border-b border-surface-100 text-sm font-bold text-surface-900">
          {ar() ? "السجل" : "History"}
        </div>
        {lSubs && <div className="p-6 text-sm text-surface-400">{ar() ? "جاري التحميل…" : "Loading…"}</div>}
        {!lSubs && subs.length === 0 && (
          <div className="p-8 text-center text-surface-400 text-sm">{ar() ? "لا توجد نماذج موقعة بعد" : "No signed forms yet"}</div>
        )}
        {!lSubs && subs.length > 0 && (
          <div className="divide-y divide-surface-100">
            {subs.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-surface-900 text-sm">{s.formTitle}</div>
                  <div className="text-xs text-surface-400">{s.createdAt ? new Date(s.createdAt).toLocaleString() : ""} • v{s.formVersion}</div>
                </div>
                <button className="btn-secondary btn-sm text-xs" onClick={() => downloadPdf(s.id)}>{ar() ? "تنزيل PDF" : "Download PDF"}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const queryParams = new URLSearchParams(window.location.search);
  const urlInviteCode = queryParams.get("inviteCode");
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { auth, logout, getAuthHeader } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [purchasesSubTab, setPurchasesSubTab] = useState<"packages" | "chat" | "reservations">("packages");
  const [walletSubTab, setWalletSubTab] = useState<"cashback" | "history" | "card">("cashback");
  const [profileSubTab, setProfileSubTab] = useState<"settings" | "forms" | "notifications" | "share">("settings");
  const [showKyc, setShowKyc] = useState(false);
  const [chatConvId, setChatConvId] = useState<string | undefined>(undefined);
  const [offerFilter, setOfferFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<any>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: walletData, loading: wLoading } = useWallet({ lazy: activeTab !== "overview" && activeTab !== "wallet" && activeTab !== "my-purchases" });
  const { data: offersData, refetch: refetchMyOffers } = useMyOffers({ lazy: activeTab !== "overview" && activeTab !== "my-purchases" && activeTab !== "store" });
  const { data: reservationsData, refetch: refetchReservations } = useApi<{ items: any[] }>(activeTab === "my-purchases" ? "/checkout/me/reservations" : null, { deps: [activeTab] });
  const { data: cardData, loading: cardLoading, error: cardError } = useApi<{ card: { displayName: string; memberSince: string | null; kycVerified: boolean; activeOffers: Array<{ offerId: string; offerName: string | null; activatedAt: string | null; expiresAt: string | null; sessionsUsed: number }>; activeSessionCount: number; recentSessions: Array<{ scheduledAt: string; status: string; completedAt: string | null }>; cashbackUnlockedKwd: string; cashbackLockedKwd: string; publicToken: string | undefined } }>(activeTab === "wallet" || activeTab === "overview" ? "/public/me/card" : null, { deps: [activeTab] });
  const { data: sessionsData, refetch: refetchMySessions } = useApi<{ items: any[] }>(activeTab === "my-purchases" || activeTab === "overview" ? "/scheduling/me/sessions" : null, { deps: [activeTab] });
  const { data: myComplaintsData, refetch: refetchMyComplaints } = useApi<{ items: any[] }>(activeTab === "profile" ? "/complaints/me" : null, { deps: [activeTab] });
  const { data: notifData } = useNotifications({ lazy: activeTab !== "profile" });
  const { data: clinicsPublic } = useApi<{ items: Array<{ id: string; nameEn: string; nameAr: string }> }>("/clinics");
  const { data: categoriesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories");
  const { data: availableFormsData, refetch: refetchAvailableForms } = useApi<{ items: Array<{ id: string; title: string }> }>(
    activeTab === "profile" || activeTab === "my-purchases" ? "/eforms/me/available" : null,
    { deps: [activeTab] }
  );
  const { data: myRequestsData, refetch: refetchMyRequests } = useApi<{
    items: Array<{
      id: string; status: string; offerId: string; clinicId: string;
      preferredAt?: string; sessionPaymentId?: string; sessionPriceKwd?: string;
      proposedAt?: string; confirmedAt?: string; rejectionReason?: string;
      conversationId?: string; scheduledSessionId?: string; createdAt: string;
    }>
  }>(activeTab === "my-purchases" ? "/scheduling/me/requests" : null, { deps: [activeTab] });
  const { data: myServerPayments } = useApi<{
    items: Array<{ id: string; amountKwd: string; purpose: string; status: string; method: string; createdAt: string; }>
  }>(activeTab === "wallet" ? "/payments/me" : null, { deps: [activeTab] });
  const unsignedForms = availableFormsData?.items ?? [];
  const [unsignedBannerDismissed, setUnsignedBannerDismissed] = useState(false);
  useEffect(() => {
    if (unsignedForms.length === 0) setUnsignedBannerDismissed(false);
  }, [unsignedForms.length]);
  useEffect(() => {
    if (activeTab !== "my-purchases" && activeTab !== "profile") return;
    const onVisible = () => { if (document.visibilityState === "visible") void refetchAvailableForms(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [activeTab, refetchAvailableForms]);
  const clinicsById = new Map((clinicsPublic?.items || []).map((c) => [c.id, c]));
  const categoryFilters = [
    { slug: "all", nameEn: "All", nameAr: "الكل" },
    ...((categoriesData?.items || []).filter((c) => c.slug !== "all"))
  ];

  const { data: homeCatalogData } = useApi<{ items: ApiOfferRow[] }>(
    activeTab === "overview" || activeTab === "store" ? "/offers" : null,
    { deps: [activeTab] }
  );

  const [selectedClinic, setSelectedClinic] = useState<string>("");
  const [showChangeClinicModal, setShowChangeClinicModal] = useState<any>(null);
  const [newClinicSelection, setNewClinicSelection] = useState<string>("");

  const { data: standaloneOfferingsData } = useApi<{ items: Array<{
    id: string; clinicId: string; sessionTypeId: string;
    nameEn: string; nameAr: string; categorySlug: string;
    priceKwd: string; cashbackDeductionKwd: string;
    bookingMode: string; durationMinutes?: number;
  }> }>(activeTab === "store" || activeTab === "overview" ? "/session-types/offerings" : null, { deps: [activeTab] });
  const standaloneSessions = standaloneOfferingsData?.items || [];

  const dynamicTreatments = standaloneSessions.reduce((acc: any[], s: any) => {
    const priceKwd = parseFloat(s.priceKwd) || 0;
    const cashbackKwd = parseFloat(s.cashbackDeductionKwd) || 0;
    let existing = acc.find((x: any) => x.id === s.sessionTypeId);
    if (!existing) {
      existing = {
        id: s.sessionTypeId,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        category: s.categorySlug,
        priceKwd,
        cashbackKwd,
        discountPct: 0,
        clinicIds: [] as string[],
        /** Each clinic can charge a different price for the same session type */
        offeringsByClinic: {} as Record<string, { priceKwd: number; cashbackKwd: number }>
      };
      acc.push(existing);
    }
    if (s.clinicId) {
      if (!existing.clinicIds.includes(s.clinicId)) {
        existing.clinicIds.push(s.clinicId);
      }
      existing.offeringsByClinic[s.clinicId] = { priceKwd, cashbackKwd };
    }
    return acc;
  }, []);

  const sessions = sessionsData?.items || [];

  const [localLedger, setLocalLedger] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('bel_financial_ledger_v1') || '[]'); } catch { return []; }
  });

  const { data: myClinicChangesData, refetch: refetchClinicChanges } = useMyClinicChangeRequests();
  const myClinicChanges = myClinicChangesData?.items || [];

  useEffect(() => {
    const sync = () => {
       try { 
          const ledger = JSON.parse(localStorage.getItem('bel_financial_ledger_v1') || '[]');
          setLocalLedger(ledger);
       } catch {}
    };
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 1000);
    return () => { window.removeEventListener('storage', sync); clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!urlInviteCode) return;
    apiFetch(`/checkout/group-invite/${encodeURIComponent(urlInviteCode)}`, { headers: getAuthHeader() })
      .then((data: any) => {
        setPendingInviteCode(urlInviteCode);
        setCheckoutPkg({ ...data, id: data.offerId });
        setActiveTab("store");
      })
      .catch(() => {});
  }, [urlInviteCode]);

  const [sysAlert, setSysAlert] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState<any>(null);
  const [showBookingPromptModal, setShowBookingPromptModal] = useState<any>(null);
  const [showClinicHandlesPrompt, setShowClinicHandlesPrompt] = useState<any>(null);
  const [paymentOption, setPaymentOption] = useState("full");
  const [installments, setInstallments] = useState(2);
  const [bookFirstSession, setBookFirstSession] = useState(true);
  const [selectedFirstSession, setSelectedFirstSession] = useState<string>("");
  const [selectedFirstClinic, setSelectedFirstClinic] = useState<string>("");
  /** Preferred clinic per session type on "Book a Session" cards (drives per-clinic price) */
  const [sessionClinicByTreatmentId, setSessionClinicByTreatmentId] = useState<Record<string, string>>({});
  const [walletActionLoading, setWalletActionLoading] = useState<"apple" | "google" | null>(null);

  const [complaintForm, setComplaintForm] = useState({ category: "other", subject: "", description: "" });

  useEffect(() => {
     if (selectedPkg) {
        setBookFirstSession(true);
        setSelectedFirstSession("");
        setSelectedFirstClinic("");
        if (selectedPkg.clinicId) {
          setSelectedClinic(selectedPkg.clinicId);
        }
     }
  }, [selectedPkg]);

  const [kycStatus, setKycStatus] = useState<string>("checking");
  
  const { data: myProfile, refetch: refetchProfile } = useApi<{ user: { username?: string; email?: string; phone?: string; fullName?: string; gender?: string } }>("/users/me");

  const displayName = myProfile?.user?.fullName || myProfile?.user?.username || cardData?.card?.displayName || "—";

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: "",
    name: "",
    phone: "",
    email: ""
  });

  useEffect(() => {
    if (myProfile?.user) {
      setProfileForm({
        username: myProfile.user.username || "",
        name: myProfile.user.fullName || "",
        phone: myProfile.user.phone || "",
        email: myProfile.user.email || ""
      });
    }
  }, [myProfile]);

  useEffect(() => {
    const check = async () => {
      try {
        const data = await apiFetch("/kyc/me/wallet", { headers: getAuthHeader() }) as any;
        setKycStatus(data.wallet ? "approved" : "unverified");
        // Update local wallet data if not using the hook directly, though useWallet handles its own state
      } catch { setKycStatus("unverified"); }
    };
    if (!showKyc) check();
  }, [getAuthHeader, showKyc]);


  const wallet = walletData?.wallet;
  const offers = offersData?.items || [];
  const unreadNotifs = (notifData?.inbox || []).filter(n => !n.read).length;

  const showWalletStatus = useCallback((message: string) => {
    setSysAlert(message);
    setTimeout(() => setSysAlert(null), 6000);
  }, []);

  // ── Canvas-based card image generation (fallback when wallet services aren't configured) ──
  const generateCardImage = useCallback(async (member: {
    displayName: string;
    memberSince: string | null;
    kycVerified: boolean;
    publicToken?: string;
    verifyUrl?: string;
  }): Promise<Blob> => {
    const SCALE = 2; // retina
    const W = 375 * SCALE;
    const H = Math.round(W / 1.586);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // ── Helper: rounded rectangle path ──
    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    };

    // ── Card background gradient ──
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.45, "#831843");
    grad.addColorStop(1, "#be185d");
    roundedRect(0, 0, W, H, 28 * SCALE);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.clip(); // clip to rounded rect

    // ── Decorative glow circles ──
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.2, W * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.15, H * 0.8, W * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── "MEMBERSHIP CARD" title ──
    const pad = 32 * SCALE;
    ctx.font = `bold ${11 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textBaseline = "top";
    ctx.letterSpacing = `${3 * SCALE}px`;
    ctx.fillText("MEMBERSHIP CARD", pad, pad);
    ctx.letterSpacing = "0px";

    // ── QR Code (top-right) ──
    if (member.publicToken) {
      const qrUrl = member.verifyUrl || `${SITE_BASE_URL}/verify/${member.publicToken}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 56 * SCALE,
          margin: 1,
          errorCorrectionLevel: "H",
          color: { dark: "#111111", light: "#ffffff" },
        });
        const qrImg = new Image();
        await new Promise<void>((resolve, reject) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = reject;
          qrImg.src = qrDataUrl;
        });
        // White rounded background behind QR
        const qrSize = 56 * SCALE;
        const qrPad = 8 * SCALE;
        const qrX = W - pad - qrSize - qrPad * 2;
        const qrY = pad - 4 * SCALE;
        ctx.fillStyle = "#ffffff";
        roundedRect(qrX, qrY, qrSize + qrPad * 2, qrSize + qrPad * 2, 10 * SCALE);
        ctx.fill();
        ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, qrSize, qrSize);
      } catch { /* QR generation failed, skip */ }
    }

    // ── Member name ──
    ctx.font = `800 ${24 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "bottom";
    ctx.fillText(member.displayName, pad, H - 72 * SCALE);

    // ── Member Since ──
    if (member.memberSince) {
      ctx.font = `500 ${10 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.letterSpacing = `${1.5 * SCALE}px`;
      ctx.fillText(`MEMBER SINCE ${member.memberSince.toUpperCase()}`, pad, H - 50 * SCALE);
      ctx.letterSpacing = "0px";
    }

    // ── Verification badge ──
    ctx.font = `bold ${9 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    if (member.kycVerified) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      roundedRect(pad, H - 42 * SCALE, 140 * SCALE, 22 * SCALE, 6 * SCALE);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText("✓  Identity Verified", pad + 10 * SCALE, H - 31 * SCALE);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      roundedRect(pad, H - 42 * SCALE, 150 * SCALE, 22 * SCALE, 6 * SCALE);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textBaseline = "middle";
      ctx.fillText("○  Verification Pending", pad + 10 * SCALE, H - 31 * SCALE);
    }

    // ── BELAMONDA branding (bottom-right) ──
    ctx.font = `800 ${13 * SCALE}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.letterSpacing = `${3 * SCALE}px`;
    ctx.fillText("BELAMONDA", W - pad, H - pad);
    ctx.letterSpacing = "0px";
    ctx.textAlign = "left";

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/png"
      );
    });
  }, []);

  // ── Share or download a card image blob ──
  const shareOrDownloadCard = useCallback(async (blob: Blob) => {
    const file = new File([blob], "belamonda-membership.png", { type: "image/png" });
    // Try Web Share API first (native share sheet on iOS / Android)
    if (navigator.share && typeof navigator.canShare === "function") {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Belamonda Membership Card",
            text: ar() ? "بطاقة عضويتي في بيلاموندو" : "My Belamonda membership card",
            files: [file],
          });
          showWalletStatus(ar() ? "✅ تمت مشاركة البطاقة بنجاح." : "✅ Card shared successfully.");
          return;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user cancelled share
      }
    }
    // Fallback: download the PNG
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "belamonda-membership.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showWalletStatus(
      ar()
        ? "✅ تم حفظ صورة البطاقة. يمكنك إضافتها يدوياً إلى محفظتك."
        : "✅ Card image saved. You can add it to your wallet from your photos."
    );
  }, [showWalletStatus]);

  const handleWalletDownload = useCallback(async (provider: "apple" | "google") => {
    setWalletActionLoading(provider);
    try {
      const origin = encodeURIComponent(SITE_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/public/me/wallet/${provider}?origin=${origin}`, {
        headers: getAuthHeader(),
      });

      const contentType = response.headers.get("content-type") || "";

      // ── Apple Wallet: .pkpass binary download ──
      if (provider === "apple" && response.ok && contentType.includes("application/vnd.apple.pkpass")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "belamonda-membership.pkpass";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showWalletStatus(ar() ? "✅ تم تحميل بطاقة Apple Wallet." : "✅ Apple Wallet pass downloaded.");
        return;
      }

      // ── JSON response (success or error) ──
      const data = await response.json();

      // Google Wallet: save URL ready
      if (provider === "google" && data.saveUrl) {
        window.open(data.saveUrl, "_blank", "noopener,noreferrer");
        showWalletStatus(ar() ? "✅ تم فتح محفظة جوجل." : "✅ Google Wallet opened.");
        return;
      }

      // ── Not configured: generate card image as fallback ──
      // Use memberData from server response, or fall back to cardData from the /me/card hook
      const member = data.memberData || (cardData?.card ? {
        displayName: cardData.card.displayName,
        memberSince: cardData.card.memberSince
          ? new Date(cardData.card.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : null,
        kycVerified: cardData.card.kycVerified,
        publicToken: cardData.card.publicToken,
      } : null);

      if (member) {
        const blob = await generateCardImage(member);
        await shareOrDownloadCard(blob);
        return;
      }

      // No member data available at all
      showWalletStatus(ar() ? "❌ بيانات البطاقة غير متوفرة." : "❌ Card data not available.");
    } catch {
      // Server error — try generating card image directly from local cardData
      try {
        if (cardData?.card) {
          const member = {
            displayName: cardData.card.displayName,
            memberSince: cardData.card.memberSince
              ? new Date(cardData.card.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : null,
            kycVerified: cardData.card.kycVerified,
            publicToken: cardData.card.publicToken,
          };
          const blob = await generateCardImage(member);
          await shareOrDownloadCard(blob);
          return;
        }
      } catch { /* fallback also failed */ }
      showWalletStatus(ar() ? "❌ تعذر تجهيز بطاقة المحفظة." : "❌ Unable to generate wallet card.");
    } finally {
      setWalletActionLoading(null);
    }
  }, [getAuthHeader, showWalletStatus, generateCardImage, shareOrDownloadCard, cardData]);
  if (showKyc) {
    return <KycVerificationPage onComplete={() => setShowKyc(false)} onCancel={() => setShowKyc(false)} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0 flex flex-col lg:flex-row overflow-x-hidden">
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-white/90 backdrop-blur-md px-4 pb-3.5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] flex items-center justify-between sticky top-0 z-30 border-b border-surface-100/80 supports-[backdrop-filter]:bg-white/75">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-sm shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-surface-500 leading-tight">{ar() ? "مرحباً،" : "Hello,"}</div>
            <div className="text-sm font-bold text-surface-900 leading-snug truncate">{displayName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => i18n.changeLanguage(ar() ? "en" : "ar")} className="w-10 h-10 flex items-center justify-center text-sm font-bold text-brand-pink-600 rounded-lg hover:bg-brand-pink-50">
            {ar() ? "EN" : "ع"}
          </button>
          <button
            type="button"
            className="relative w-10 h-10 flex items-center justify-center rounded-lg text-surface-600 hover:bg-surface-50"
            aria-label={ar() ? "الإشعارات" : "Notifications"}
            onClick={() => {
              setActiveTab("profile");
              setProfileSubTab("notifications");
              setTimeout(() => {
                const el = document.getElementById("sec-notifications");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }}
          >
            <svg className="w-5 h-5 translate-y-[3px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadNotifs > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar (Optional, but kept minimal to feel like an app menu) */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-surface-200 flex-col sticky top-0 h-screen z-30 overflow-y-auto">
        <div className="p-6 pb-2 border-b border-surface-100 flex items-center gap-3">
          <BelamondaIcon size={32} />
          <span className="text-xl font-bold text-surface-900 tracking-tight">Belamonda</span>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-lg">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-surface-900">{displayName}</div>
              <div className="text-xs text-surface-500">{ar() ? "عضو" : "Member"}</div>
            </div>
          </div>
          <nav className="space-y-2">
            {[
              { key: "overview", label: ar() ? "الرئيسية" : "Home", icon: CustomerIcons.home },
              { key: "store", label: ar() ? "تصفح العضويات" : "Memberships", icon: CustomerIcons.offers },
              { key: "my-purchases", label: ar() ? "حجوزاتي" : "Bookings", icon: CustomerIcons.wallet },
              { key: "wallet", label: ar() ? "المحفظة" : "Wallet", icon: CustomerIcons.card },
              { key: "profile", label: ar() ? "حسابي" : "Profile", icon: CustomerIcons.profile },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === tab.key ? "bg-brand-pink-50 text-brand-pink-600" : "text-surface-600 hover:bg-surface-50"}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-surface-100">
          <button onClick={logout} className="flex items-center gap-3 text-red-500 font-medium px-4 py-2 hover:bg-red-50 rounded-xl w-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main App Content — min-w-0 prevents flex overflow; inner max-width keeps lines readable on ultrawide */}
      <main className="flex-1 min-w-0 w-full max-w-2xl mx-auto sm:max-w-3xl lg:max-w-none animate-fade-in relative">

        {/* ── Desktop unified hero header ── */}
        {(() => {
          const isLight = kycStatus !== "unverified" && kycStatus !== "pending";
          const titleCls = isLight ? "text-surface-900" : "text-white";
          const dateCls  = isLight ? "text-surface-500" : "text-white/60";
          const iconCls  = isLight ? "text-surface-500 group-hover:text-brand-pink-600" : "text-white/70 group-hover:text-white";
          const langCls  = isLight ? "text-surface-600 hover:text-brand-pink-600 hover:bg-white" : "text-white/70 hover:text-white hover:bg-white/10";
          const hoverBgCls = isLight ? "hover:bg-white" : "hover:bg-white/10";
          const avatarCls = isLight ? "bg-brand-pink-100 text-brand-pink-600 hover:bg-brand-pink-200" : "bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30";
        return (
        <div className="hidden lg:block relative overflow-hidden">
          {/* gradient background that spans greeting + any status banner */}
          <div className={`relative ${kycStatus === "unverified" ? "bg-brand-gradient" : kycStatus === "pending" ? "bg-gradient-to-r from-blue-500 to-blue-400" : "bg-gradient-to-br from-brand-pink-50 via-white to-brand-sage-50"} px-4 sm:px-8 lg:px-10 pt-6 pb-0 border-b border-surface-100`}>
            {/* subtle bokeh blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className={`absolute -top-12 -right-12 w-64 h-64 rounded-full blur-3xl ${isLight ? "bg-brand-pink-200/40" : "bg-white/10"}`} />
              <div className={`absolute top-4 right-40 w-32 h-32 rounded-full blur-2xl ${isLight ? "bg-brand-sage-200/40" : "bg-white/5"}`} />
            </div>

            {/* top strip: greeting + action icons */}
            <div className="relative z-10 flex items-center justify-between mb-5">
              <div>
                <div className={`${dateCls} text-xs font-bold uppercase tracking-widest mb-0.5`}>
                  {new Date().toLocaleDateString(ar() ? "ar-KW" : "en-KW", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div className={`text-2xl font-black ${titleCls} leading-tight`}>
                  {ar() ? "مرحباً" : "Welcome back"}{cardData?.card?.displayName ? `, ${cardData.card.displayName}` : ''} 👋
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => i18n.changeLanguage(ar() ? "en" : "ar")} className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${langCls}`}>
                  {ar() ? "EN" : "ع"}
                </button>
                <button onClick={() => { setActiveTab("my-purchases"); setPurchasesSubTab("chat"); }} className={`relative p-2 rounded-xl transition-colors group ${hoverBgCls}`} title={ar() ? "محادثة مباشرة" : "Live Chat"}>
                  <svg className={`w-5 h-5 transition-colors ${iconCls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
                <button onClick={() => { setActiveTab("profile"); setTimeout(() => { const el = document.getElementById("sec-notifications"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); }} className={`relative p-2 rounded-xl transition-colors group ${hoverBgCls}`} title={ar() ? "الإشعارات" : "Notifications"}>
                  <svg className={`w-5 h-5 transition-colors ${iconCls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                  {unreadNotifs > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
                </button>
                <button onClick={() => setActiveTab("profile")} className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ms-1 ${avatarCls}`}>
                  {(cardData?.card?.displayName || auth?.userId || '?').charAt(0).toUpperCase()}
                </button>
              </div>
            </div>

            {/* status message row inside the gradient zone */}
            {kycStatus === "unverified" && (
              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 mb-0 border border-white/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{ar() ? "استكمال التوثيق مطلوب" : "Action Required: Complete Verification"}</div>
                    <div className="text-white/75 text-xs mt-0.5">{ar() ? "أكملي التوثيق لتفعيل الدفع وشراء الباقات والكاش باك." : "Complete verification to enable payments, packages, and cashback."}</div>
                  </div>
                </div>
                <button className="shrink-0 w-full sm:w-auto bg-white text-brand-pink-600 font-bold px-5 py-2.5 rounded-xl text-sm shadow-sm hover:scale-[1.02] transition-transform whitespace-nowrap text-center" onClick={() => setActiveTab("profile")}>
                  {ar() ? "تحديث الآن" : "Update Profile"}
                </button>
              </div>
            )}
            {kycStatus === "pending" && (
              <div className="relative z-10 flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 mb-0 border border-white/20">
                <svg className="w-5 h-5 text-white animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                <div>
                  <div className="text-white font-bold text-sm">{ar() ? "التحقق قيد المراجعة" : "Verification Under Review"}</div>
                  <div className="text-white/75 text-xs mt-0.5">{ar() ? "يرجى الانتظار لحين اعتماد بياناتك." : "Please wait while management approves your submission."}</div>
                </div>
              </div>
            )}

            {/* curved bottom edge that blends into the page bg */}
            <div className="h-8 bg-surface-50 rounded-t-[2rem] mt-6 -mb-px" />
          </div>
        </div>
        ); })()}

        {/* Content based on tab */}
        <div className="px-3 py-3 sm:p-4 lg:px-8 lg:pb-8 bg-surface-50 min-h-[calc(100dvh-12rem)] lg:min-h-[calc(100vh-200px)]">
          
        {activeTab === "store" && (() => {
          const allOffers = homeCatalogData?.items || [];
          // Only show categories that have at least one membership
          const offerCategorySlugs = new Set(allOffers.map((o: any) => o.category).filter(Boolean));
          const activeFilters = categoryFilters.filter(cf => cf.slug === "all" || offerCategorySlugs.has(cf.slug));
          const filtered = allOffers.filter((o: any) => offerFilter === "all" || o.category === offerFilter);
          // Sort: custom admin order first, fallback to highest price (premium plans on top)
          const sorted = [...filtered].sort((a: any, b: any) => {
            const orderA = a.sortOrder ?? 0;
            const orderB = b.sortOrder ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return parseFloat(b.subscriptionPriceKwd || "0") - parseFloat(a.subscriptionPriceKwd || "0");
          });
          // Featured = the first plan in the sorted list
          const featuredId = sorted.length > 1 ? sorted[0]?.id : null;
          return (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-pink-50 border border-brand-pink-100 text-brand-pink-600 text-xs font-bold uppercase tracking-wider mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-pink-500 animate-pulse" />
                  {ar() ? "خطط العضوية" : "Choose Your Plan"}
                </div>
                <h2 className="text-3xl lg:text-4xl font-black text-surface-900 mb-2 tracking-tight">{ar() ? "اختاري الخطة المثالية لكِ" : "Find Your Perfect Plan"}</h2>
                <p className="text-surface-500 text-sm lg:text-base">{ar() ? "باقات شاملة بأسعار حصرية وكاش باك تلقائي على كل جلسة." : "Comprehensive packages with exclusive pricing and automatic cashback on every session."}</p>
              </div>
              {/* Horizontally scrollable filters on mobile, wrapping on desktop */}
              <div className="relative -mx-3 px-3 sm:mx-0 sm:px-0">
                <div
                  className="flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-2 sm:pb-0 sm:flex-wrap sm:justify-center sm:overflow-visible touch-pan-x overscroll-x-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {activeFilters.map(cf => {
                    const count = cf.slug === "all" ? allOffers.length : allOffers.filter((o: any) => o.category === cf.slug).length;
                    return (
                      <button
                        key={cf.slug}
                        onClick={() => setOfferFilter(cf.slug)}
                        className={`snap-start shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${offerFilter === cf.slug ? "bg-brand-pink-500 text-white shadow-md" : "bg-white text-surface-600 border border-surface-200 hover:border-brand-pink-300 hover:text-brand-pink-600"}`}
                      >
                        {ar() ? cf.nameAr : cf.nameEn}
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${offerFilter === cf.slug ? "bg-white/25 text-white" : "bg-surface-100 text-surface-500"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 pt-2">
                {sorted.map((o: any) => {
                  const isFeatured = o.id === featuredId && sorted.length > 1;
                  const sessions = o.sessionCount || o.maxSessions;
                  const cashbackPct = o.cashbackPercent;
                  const branches = o.branchCount;
                  const savings = o.originalClinicPriceKwd && o.subscriptionPriceKwd
                    ? (parseFloat(o.originalClinicPriceKwd) - parseFloat(o.subscriptionPriceKwd)).toFixed(3)
                    : null;
                  // Resolve category name from API data
                  const catDef = (categoriesData?.items || []).find(c => c.slug === o.category);
                  const categoryLabel = catDef ? (ar() ? catDef.nameAr : catDef.nameEn) : o.category;
                  return (
                    <div key={o.id} className={`plan-card ${isFeatured ? "is-featured" : ""}`}>
                      {isFeatured && <span className="plan-badge">{ar() ? "الأكثر شعبية" : "Most Popular"}</span>}
                      <div className="text-[10px] font-bold text-brand-pink-500 uppercase tracking-wider mb-2">{categoryLabel}</div>
                      <h3 className="text-lg font-black text-surface-900 leading-tight mb-1">{ar() ? (o.nameAr || o.name) : o.name}</h3>
                      {o.subtitle && <p className="text-xs text-surface-500 line-clamp-2 mb-4">{o.subtitle}</p>}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-black text-surface-900 tracking-tight">{o.subscriptionPriceKwd}</span>
                        <span className="text-sm font-bold text-surface-500">KWD</span>
                      </div>
                      {o.originalClinicPriceKwd && (
                        <div className="flex items-center gap-2 mb-5">
                          <span className="text-sm text-surface-400 line-through">{o.originalClinicPriceKwd} KWD</span>
                          {savings && <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">{ar() ? `وفّري ${savings}` : `Save ${savings}`}</span>}
                        </div>
                      )}
                      {!o.originalClinicPriceKwd && <div className="mb-5" />}
                      <div className="space-y-2.5 mb-6 flex-1">
                        {sessions && (
                          <div className="plan-feature">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span><b>{sessions}</b> {ar() ? "جلسة مدرجة" : "sessions included"}</span>
                          </div>
                        )}
                        {cashbackPct && (
                          <div className="plan-feature">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span><b>{cashbackPct}%</b> {ar() ? "كاش باك تلقائي" : "automatic cashback"}</span>
                          </div>
                        )}
                        {branches && (
                          <div className="plan-feature">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span>{ar() ? `متوفر في ${branches} فرع` : `Available at ${branches} branches`}</span>
                          </div>
                        )}
                        <div className="plan-feature">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{ar() ? "حجز مرن بدون رسوم" : "Flexible booking, no fees"}</span>
                        </div>
                        <div className="plan-feature">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{ar() ? "دعم عملاء مخصص" : "Priority customer support"}</span>
                        </div>
                      </div>
                      <button
                        className={isFeatured ? "btn-primary w-full py-3 text-sm font-bold shadow-glow" : "w-full py-3 rounded-2xl text-sm font-bold border-2 border-surface-200 text-surface-700 bg-white hover:border-brand-pink-400 hover:text-brand-pink-600 transition-colors"}
                        onClick={() => setCheckoutPkg(o)}
                      >
                        {ar() ? "اختاري هذه الخطة" : "Choose this Plan"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {sorted.length === 0 && (
                <div className="text-center py-16 text-surface-400">
                  <div className="text-5xl mb-3">🌸</div>
                  <p className="font-medium">{ar() ? "لا توجد عروض في هذه الفئة" : "No memberships in this category"}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Horizontal tabs for Wallet and Profile */}
        {(activeTab === "wallet" || activeTab === "profile") && (() => {
          const navMap: Record<string, Array<{id: string; label: string; icon: string}>> = {
            "wallet": [
              { id: "cashback", label: ar() ? "محفظة الكاش باك" : "Cashback Wallet", icon: "💎" },
              { id: "history",  label: ar() ? "سجل المدفوعات"   : "Payment History", icon: "🧾" },
              { id: "card",     label: ar() ? "بطاقتي الرقمية"  : "My Digital Card", icon: "🪪" },
            ],
            "profile": [
              { id: "settings",      label: ar() ? "الإعدادات"     : "Settings",      icon: "⚙️" },
              { id: "forms",         label: ar() ? "نماذجي"        : "My Forms",      icon: "📝" },
              { id: "notifications", label: ar() ? "الإشعارات"     : "Notifications", icon: "🔔" },
              { id: "share",         label: ar() ? "رابط الإحالة"  : "Referral Link", icon: "🔗" },
            ],
          };
          const items = navMap[activeTab] || [];
          const activeSubTab = activeTab === "wallet" ? walletSubTab : profileSubTab;
          const setSubTab = activeTab === "wallet" ? setWalletSubTab : setProfileSubTab;
          return (
            <div className="mb-4 sm:mb-6 sticky top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20 lg:static lg:z-auto pt-3 sm:pt-4 py-1.5 px-1 sm:px-0 bg-surface-50/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none">
              <div className="mobile-switcher justify-center">
                {items.map(it => (
                  <button
                    key={it.id}
                    onClick={() => setSubTab(it.id as any)}
                    className={`mobile-switcher-btn ${activeSubTab === it.id ? "active" : ""}`}
                  >
                    <span aria-hidden="true">{it.icon}</span>
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {activeTab === "overview" && (
            <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              {/* Wallet Hero Card */}
              {(() => {
                const walletUnlocked = parseFloat(wallet?.unlockedBalance || "0");
                const walletLocked = parseFloat(wallet?.lockedBalance || "0");
                const walletTxns = walletData?.txns ?? [];
                const used = walletTxns.filter(t => t.type === "deduction").reduce((s, t) => s + parseFloat(t.amountKwd || "0"), 0);
                const total = walletUnlocked + walletLocked;
                const pctUnlocked = total > 0 ? (walletUnlocked / total) * 100 : 0;
                const pctUsed = total > 0 ? (used / total) * 100 : 0;
                const pctLocked = Math.max(0, 100 - pctUnlocked);
                
                return (
              <div className="wallet-card shadow-glow-lg" style={{ cursor: "pointer" }} onClick={() => setActiveTab("wallet")}>
                {/* Header */}
                <div className="flex justify-between items-start gap-3 mb-5">
                  <div className="min-w-0">
                    <div className="text-white/70 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">{ar() ? "محفظة الكاش باك" : "Cashback Wallet"}</div>
                    <div className="text-3xl sm:text-4xl font-black mt-1 text-white tabular-nums tracking-tight">{walletUnlocked.toFixed(3)} <span className="text-lg sm:text-xl opacity-70 font-bold">KWD</span></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-white backdrop-blur-md shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    {total > 0 ? (ar() ? "نشطة" : "Active") : (ar() ? "غير نشط" : "Inactive")}
                  </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="mb-4">
                  <div className="h-3 w-full rounded-full overflow-hidden flex bg-black/15">
                    {pctUnlocked > 0 && <div className="h-full bg-white transition-all duration-500" style={{ width: `${pctUnlocked}%` }} />}
                    {pctLocked > 0 && <div className="h-full bg-white/30 transition-all duration-500" style={{ width: `${pctLocked}%` }} />}
                  </div>
                </div>

                {/* Three stat columns */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-white/20 border border-white/30 rounded-xl py-2.5 px-2 text-center backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span className="text-white/90 text-[10px] font-bold">{ar() ? "متاح للاستخدام" : "Available"}</span>
                    </div>
                    <div className="text-white font-black text-base sm:text-lg tabular-nums">{walletUnlocked.toFixed(3)}</div>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مقفل" : "Locked"}</span>
                    </div>
                    <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{walletLocked.toFixed(3)}</div>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مستخدم" : "Used"}</span>
                    </div>
                    <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{used.toFixed(3)}</div>
                  </div>
                </div>

                {/* Locked hint */}
                {walletLocked > 0 && (
                  <div className="mt-3 text-white/60 text-[10px] sm:text-[11px] text-center font-medium">
                    {ar() 
                      ? "💡 ادفع أقساطك لفتح الرصيد المقفل"
                      : "💡 Pay your installments to unlock locked balance"}
                  </div>
                )}
              </div>
                );
              })()}

              {/* Active Memberships */}
              <div>
                <div className="editorial-header justify-between">
                  <div className="flex items-center gap-3">
                    <span className="accent" />
                    <div>
                      <h3>{ar() ? "عروضي النشطة" : "Active Memberships"}</h3>
                      <div className="meta">{ar() ? "باقاتك المفعّلة وحالة استخدامها" : "Your active packages and usage status"}</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("store")} className="text-xs sm:text-sm font-semibold text-brand-pink-500 hover:text-brand-pink-600 flex items-center gap-1 w-full justify-end sm:w-auto sm:ms-auto shrink-0">
                    {ar() ? "تصفح باقاتنا" : "Browse Memberships"} <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                {(() => {
                  const activeOffers = offers.filter(o => !(o.maxSessions && o.sessionsUsed >= o.maxSessions) && !o.isStandalone);
                  return activeOffers.length === 0 ? (
                    <div className="bg-white border border-surface-200 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 text-center text-surface-500 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-brand-gradient-soft text-brand-pink-600 flex items-center justify-center mb-3 sm:mb-4 shadow-sm">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                      </div>
                      <p className="mb-1 text-surface-900 font-bold text-sm sm:text-base">{ar() ? "لا توجد عضويات نشطة بعد" : "No active memberships yet"}</p>
                      <p className="mb-4 sm:mb-5 text-surface-500 text-xs sm:text-sm max-w-sm leading-relaxed">{ar() ? "استكشف باقاتنا المختارة بعناية وابدأ رحلتك مع بيلاموندو" : "Explore our curated packages and start your Belamonda journey"}</p>
                      <button onClick={() => setActiveTab("store")} className="btn-primary px-6 py-2.5 flex items-center gap-2">
                         {ar() ? "تصفح باقاتنا" : "Browse Memberships"}
                         <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                      {activeOffers.map(o => {
                        const isCashback = o.isCashbackOnly || o.membershipType === "cashback";
                        const isPending = o.status === 'pending payment' || o.status === 'pending_payment';
                        const isInstallment = o.method === "Installments";
                        const paidInst = o.paidInstallments || 0;
                        const sessionsUsed = o.sessionsUsed || 0;
                        let bookingLocked = isPending;
                        let lockedReason = ar() ? "بانتظار تأكيد الدفع" : "Awaiting Payment";

                        if (!isPending && isInstallment) {
                          if (paidInst === 0) {
                            bookingLocked = true;
                            lockedReason = ar() ? "يجب دفع القسط الأول" : "First installment required";
                          } else if (paidInst === 1 && sessionsUsed >= 1) {
                            bookingLocked = true;
                            lockedReason = ar() ? "يجب دفع القسط الثاني" : "Second installment required";
                          }
                        }

                        const cardCls = `membership-card p-4 sm:p-5 lg:p-6 ${isPending ? 'is-pending' : isCashback ? 'is-cashback' : ''}`;
                        const offerName = o.offerName || homeCatalogData?.items?.find((x: any) => x.id === o.offerId)?.name || o.offerId || "Special Package";
                        const usedPct = o.maxSessions ? Math.min((sessionsUsed / o.maxSessions) * 100, 100) : 0;
                        return (
                        <div key={o.id} className={cardCls}>
                          <span className="ribbon" />
                          <span className="blob" />
                          <div className="relative">
                            <div className="flex justify-between items-start gap-3 mb-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  {isPending ? (
                                    <span className="status-pill-pending"><span className="dot" />{ar() ? "بانتظار الدفع" : "Pending Payment"}</span>
                                  ) : (
                                    <span className="status-pill-active"><span className="dot" />{ar() ? "نشط" : "Active"}</span>
                                  )}
                                  {isCashback && (
                                    <span className="badge-sage text-[10px]">{ar() ? "كاش باك" : "Cashback"}</span>
                                  )}
                                  {o.method === "Installments" && (
                                    <span className="badge-blue text-[10px]">{o.paidInstallments}/{o.totalInstallments} {ar() ? "أقساط" : "installments"}</span>
                                  )}
                                </div>
                                <h4 className="font-bold text-surface-900 text-lg leading-tight tracking-tight">{offerName}</h4>
                              </div>
                              {isCashback ? (
                                <div className="bg-surface-50 px-3.5 py-2.5 rounded-2xl text-center shrink-0 border border-surface-200/70 min-w-[88px]">
                                  <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">{ar() ? "متاح للاستخدام" : "Available"}</div>
                                  <div className="font-black text-surface-900 text-xl leading-none mt-1">
                                    {parseFloat(cardData?.card?.cashbackUnlockedKwd || "0").toFixed(1)}
                                    <span className="text-surface-400 text-sm font-bold ml-1">KWD</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-surface-50 px-3.5 py-2.5 rounded-2xl text-center shrink-0 border border-surface-200/70 min-w-[88px]">
                                  <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">{ar() ? "جلسات" : "Sessions"}</div>
                                  <div className="font-black text-surface-900 text-xl leading-none mt-1">
                                    {o.maxSessions ? `${o.sessionsUsed || 0}` : (o.sessionsUsed || 0)}
                                    {o.maxSessions && <span className="text-surface-400 text-base font-bold">/{o.maxSessions}</span>}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Sessions progress bar (Cashback is handled in the pink card below) */}
                            {!isCashback && o.maxSessions && (
                              <div className="mb-4">
                                <div className="flex justify-between text-[11px] font-semibold text-surface-500 mb-1.5">
                                  <span>{ar() ? "الاستخدام" : "Usage"}</span>
                                  <span className="text-brand-pink-600">{usedPct.toFixed(0)}%</span>
                                </div>
                                <div className="progress-bar">
                                  <div className="progress-bar-fill" style={{ width: `${usedPct}%` }} />
                                </div>
                              </div>
                            )}

                            {o.clinicLocked && o.clinicId && (() => {
                               const clinic = (clinicsPublic?.items || []).find(c => c.id === o.clinicId);
                               const clinicName = ar() ? (clinic as any)?.nameAr || clinic?.nameEn || o.clinicId : clinic?.nameEn || (clinic as any)?.nameAr || o.clinicId;
                               const sessionPrice = (o.branchSessionPrices || []).find((b: any) => b.clinicId === o.clinicId)?.sessionPriceKwd;
                               const approvedChanges = myClinicChanges.filter(r => r.userOfferId === o.id && r.status === "approved").length;
                               const pendingRequest = myClinicChanges.find(r => r.userOfferId === o.id && r.status === "pending");
                               const nextFee = approvedChanges === 0 ? 10 : approvedChanges === 1 ? 20 : 30;
                               return (
                                 <div className="mb-4 space-y-2">
                                   <div className="rounded-xl bg-gradient-to-br from-surface-50 to-white border border-surface-200 p-3">
                                     <div className="flex items-start justify-between gap-3">
                                       <div className="flex items-start gap-2.5 min-w-0">
                                         <div className="w-8 h-8 rounded-lg bg-brand-pink-50 text-brand-pink-600 flex items-center justify-center shrink-0">
                                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                         </div>
                                         <div className="min-w-0">
                                           <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{ar() ? "العيادة المحددة" : "Assigned Clinic"}</div>
                                           <div className="text-sm font-bold text-surface-900 truncate">{clinicName}</div>
                                           {sessionPrice && <div className="text-[11px] text-surface-500 mt-0.5">{sessionPrice} {ar() ? "د.ك / جلسة" : "KWD / session"}</div>}
                                         </div>
                                       </div>
                                       {!pendingRequest ? (
                                         <button onClick={() => setShowChangeClinicModal({ ...o, currentFee: nextFee })} className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors">
                                           {ar() ? `تغيير · ${nextFee} د.ك` : `Change · ${nextFee} KD`}
                                         </button>
                                       ) : (
                                         <span className="status-pill-pending text-[10px] shrink-0"><span className="dot" />{ar() ? "قيد المراجعة" : "Pending"}</span>
                                       )}
                                     </div>
                                   </div>
                                   {pendingRequest && (
                                     <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                                       <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                       <span>
                                         {ar()
                                           ? `طلب تغيير العيادة إلى "${pendingRequest.toClinicNameAr || pendingRequest.toClinicNameEn}" قيد مراجعة فريق خدمة العملاء.`
                                           : `Clinic change request to "${pendingRequest.toClinicNameEn || pendingRequest.toClinicNameAr}" is under CS review.`}
                                       </span>
                                     </div>
                                   )}
                                 </div>
                               );
                            })()}

                            {isCashback ? (() => {
                              const parts = computeOfferCashbackParts(o);
                              const isDeposit = o.purchaseMode === 'deposit' || o.method === 'Deposit';
                              const verbEn = isDeposit ? 'Pay remaining balance' : 'Pay installment';
                              const verbAr = isDeposit ? 'ادفع المبلغ المتبقي' : 'ادفع القسط';
                              
                              const hasRemainingPayments = o.purchaseMode === 'deposit' || 
                                (o.purchaseMode === 'installments' && (o.installmentsPaid || 0) < (o.installmentCount || 1));
                              
                              return (
                              <div className="pt-2 flex flex-col gap-2">
                                {parts.locked > 0 && hasRemainingPayments && (
                                  <button
                                    className="w-full mt-1 bg-brand-pink-600 hover:bg-brand-pink-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setActiveTab("my-purchases"); 
                                      setPurchasesSubTab("packages"); 
                                      setTimeout(() => {
                                        const el = document.getElementById("sec-packages");
                                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                      }, 100);
                                    }}
                                  >
                                    🔓 {ar() ? `${verbAr} لفتح ${parts.locked.toFixed(3)} د.ك` : `${verbEn} to unlock ${parts.locked.toFixed(3)} KWD`}
                                  </button>
                                )}
                                {parseFloat(o.cashbackPerSessionKwd || "0") > 0 && (
                                  <div className="mt-1 text-emerald-600 bg-emerald-50 text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    {ar() ? `+${o.cashbackPerSessionKwd} د.ك إضافية مع كل زيارة` : `+${o.cashbackPerSessionKwd} KWD extra per visit`}
                                  </div>
                                )}
                              </div>
                              );
                            })() : (
                              <button
                                className={`w-full font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 ${bookingLocked ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-not-allowed' : 'bg-surface-900 text-white hover:bg-surface-800 shadow-md hover:shadow-lg hover:-translate-y-0.5'}`}
                                onClick={() => setShowBookingModal({ ...o, userOfferId: o.id })}
                                disabled={bookingLocked}
                              >
                                {bookingLocked ? (
                                  <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    {lockedReason}
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    {ar() ? "حجز موعد" : "Book Appointment"}
                                  </>
                                )}
                              </button>
                            )}
                            {(o as any).groupInviteCode && (() => {
                              const link = `${SITE_BASE_URL}/dashboard?inviteCode=${(o as any).groupInviteCode}`;
                              const isCopied = copiedCode === (o as any).groupInviteCode;
                              return (
                                <div className="mt-3 rounded-2xl border border-brand-pink-200 bg-brand-pink-50/50 p-3">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <svg className="w-3.5 h-3.5 text-brand-pink-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span className="text-[11px] font-bold text-brand-pink-700 uppercase tracking-wide">{ar() ? "رابط الدعوة الجماعي" : "Group Invite Link"}</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <input readOnly value={link} className="flex-1 text-[11px] font-mono bg-white border border-surface-200 rounded-lg px-2.5 py-1.5 text-surface-700 min-w-0 select-all" dir="ltr" onFocus={e => e.target.select()} />
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(link).catch(() => {}); setCopiedCode((o as any).groupInviteCode); setTimeout(() => setCopiedCode(null), 2000); }}
                                      className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${isCopied ? 'bg-emerald-500 text-white' : 'bg-brand-pink-500 hover:bg-brand-pink-600 text-white'}`}
                                    >
                                      {isCopied ? (ar() ? "تم!" : "Copied!") : (ar() ? "نسخ" : "Copy")}
                                    </button>
                                  </div>
                                  {(o as any).groupSizeRequired && (
                                    <div className="mt-1.5 text-[11px] text-brand-pink-600 font-medium">
                                      {ar()
                                        ? `ادعُ ${(o as any).groupSizeRequired - 1} أصدقاء لتفعيل المكافأة الجماعية`
                                        : `Invite ${(o as any).groupSizeRequired - 1} friends to unlock your group reward`}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>



              {/* ── Book a Session ── */}
              <div className="mt-10">
                 <div className="flex flex-col min-[380px]:flex-row items-start gap-3 sm:gap-4 mb-6">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-pink-50 flex items-center justify-center text-brand-pink-500 shrink-0">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-surface-900">{ar() ? "حجز جلسة / خدمة جديدة" : "Book a Session"}</h3>
                       <p className="text-sm text-surface-500 mt-1">{ar() ? "تصفح جميع الخدمات المتاحة واحجز موعدك بسهولة" : "Browse all available services and book your appointment easily"}</p>
                    </div>
                 </div>

                 {/* Session Categories Filter — horizontal scroll on small screens, wrap from md */}
                 <div className="relative -mx-1 px-1 sm:mx-0 sm:px-0 mb-4">
                    <div
                      className="flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0 touch-pan-x overscroll-x-contain"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                    <button
                      type="button"
                      onClick={() => setSessionFilter("all")}
                      className={`snap-start shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm whitespace-nowrap sm:whitespace-normal font-medium transition-all ${sessionFilter === "all" ? "bg-surface-900 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                    >
                      {ar() ? "الكل" : "All"}
                    </button>
                    {categoryFilters.filter(c => c.slug !== "all").map(cat => {
                      const icon = getCategoryIcon(cat.slug);
                      return (
                        <button
                          type="button"
                          key={cat.slug}
                          onClick={() => setSessionFilter(cat.slug)}
                          className={`snap-start shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm whitespace-nowrap sm:whitespace-normal font-medium transition-all ${sessionFilter === cat.slug ? "bg-brand-pink-500 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                        >
                          <span className="shrink-0">{icon}</span>
                          <span className="max-w-[10rem] sm:max-w-none truncate sm:overflow-visible sm:text-balance">{ar() ? cat.nameAr : cat.nameEn}</span>
                        </button>
                      );
                    })}
                    </div>
                 </div>

                 {/* Sessions Grid — 1 col phone, 2 tablet/desktop, 3 wide */}
                 <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                    {dynamicTreatments.filter((t: any) => sessionFilter === "all" || t.category === sessionFilter).map((t: any) => {
                       const activeOffers = offers.filter(o => o.status === 'active');
                       // Any active membership that covers this session category counts.
                       // Use offerCategory (joined from offer doc) when available; fall back to o.category.
                       const applicableCashbackOffer = activeOffers.find(o => {
                          const cat = (o as any).offerCategory || o.category || "";
                          if (cat === "all") return true;
                          if (cat) return cat.split(',').map((s: string) => s.trim()).includes(t.category);
                          return false;
                       });
                       const hasMembership = !!applicableCashbackOffer;
                       const availableClinics = t.clinicIds.map((id: string) => clinicsById.get(id) || (clinicsPublic?.items || []).find(c => c.id === id) || { id, nameEn: id, nameAr: id });
                       const offeringsBy = (t.offeringsByClinic || {}) as Record<string, { priceKwd: number; cashbackKwd: number }>;
                       const defaultClinicId = availableClinics[0]?.id ?? "";
                       const storedClinic = sessionClinicByTreatmentId[t.id];
                       const selectedClinicForCard =
                         storedClinic && availableClinics.some((cl: any) => cl.id === storedClinic)
                           ? storedClinic
                           : defaultClinicId;
                       const clinicOffering = selectedClinicForCard ? offeringsBy[selectedClinicForCard] : undefined;
                       const basePrice = clinicOffering?.priceKwd ?? t.priceKwd;
                       const baseCashbackKwd = clinicOffering?.cashbackKwd ?? t.cashbackKwd;
                       const actualDiscountPct = hasMembership ? t.discountPct : 0;
                       // Per-session cashback: prefer the session-specific override, then the offer's general rate.
                       const offerCashbackPerSession = parseFloat((applicableCashbackOffer as any)?.cashbackPerSessionKwd || "0");
                       const actualCashbackKwd = hasMembership ? (baseCashbackKwd || offerCashbackPerSession) : 0;

                       const discountAmt = actualDiscountPct > 0 ? +(basePrice * actualDiscountPct / 100).toFixed(3) : 0;
                       const priceAfterDiscount = +(basePrice - discountAmt).toFixed(3);
                       // Effective price shown to member = pay priceAfterDiscount, earn cashback back
                       const effectivePrice = hasMembership && actualCashbackKwd > 0
                         ? +(priceAfterDiscount - actualCashbackKwd).toFixed(3)
                         : priceAfterDiscount;
                       const finalPrice = priceAfterDiscount;
                       
                       const savingsKwd = hasMembership && actualCashbackKwd > 0 ? actualCashbackKwd : 0;
                       const savingsPct = basePrice > 0 && savingsKwd > 0 ? Math.round((savingsKwd / basePrice) * 100) : 0;
                       return (
                       <div key={t.id} className={`relative rounded-3xl overflow-hidden flex flex-col transition-all duration-300 group border ${hasMembership ? 'bg-white border-brand-pink-200 shadow-md hover:shadow-xl hover:border-brand-pink-400 hover:-translate-y-1' : 'bg-white border-surface-200 shadow-sm hover:shadow-lg hover:border-surface-300 hover:-translate-y-0.5'}`}>

                          {/* Member benefit ribbon */}
                          {hasMembership && (
                            <div className="bg-brand-gradient px-4 py-2 flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-white/90" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>
                              <span className="text-[11px] font-black text-white uppercase tracking-wider">{ar() ? "سعر الأعضاء الحصري" : "Members-only price"}</span>
                              {savingsPct > 0 && (
                                <span className="ms-auto bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{ar() ? `وفّري ${savingsPct}%` : `Save ${savingsPct}%`}</span>
                              )}
                            </div>
                          )}

                          <div className="p-4 sm:p-6 flex flex-col flex-1 min-w-0">
                            {/* Corner accent blob */}
                            <div className={`absolute top-0 end-0 w-28 h-28 ${hasMembership ? 'bg-brand-pink-100/50' : 'bg-surface-50'} rounded-bl-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-500 origin-top-right -z-0`} />

                            <div className="relative z-10 flex flex-col flex-1">
                              {/* Category badge */}
                              <div className="flex items-center gap-2.5 mb-3">
                                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-lg ${hasMembership ? 'bg-brand-pink-100' : 'bg-surface-100'}`}>
                                  {getCategoryIcon(t.category)}
                                </div>
                                <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">
                                  {ar() ? treatmentCategories.find(c => c.id === t.category)?.nameAr : treatmentCategories.find(c => c.id === t.category)?.nameEn}
                                </span>
                              </div>

                              {/* Title */}
                              <h3 className="text-base sm:text-lg font-black text-surface-900 leading-snug mb-3 sm:mb-4 tracking-tight break-words">
                                {ar() ? t.nameAr : t.nameEn}
                              </h3>

                              {/* Clinic selector */}
                              <div className="mb-5">
                                {availableClinics.length > 0 ? (
                                  <div className="relative">
                                    <select
                                      className={`w-full border rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer pe-10 ${hasMembership ? 'bg-brand-pink-50/50 border-brand-pink-200 text-surface-700 focus:ring-brand-pink-400' : 'bg-surface-50 border-surface-200 text-surface-700 focus:ring-surface-900'}`}
                                      value={selectedClinicForCard}
                                      onChange={(e) =>
                                        setSessionClinicByTreatmentId((prev) => ({ ...prev, [t.id]: e.target.value }))
                                      }
                                    >
                                      {availableClinics.map((cl: any) => (
                                        <option key={cl.id} value={cl.id}>
                                          {ar() ? cl.nameAr : cl.nameEn}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="absolute end-4 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full bg-surface-50 border border-dashed border-surface-300 rounded-2xl px-3 py-3 text-sm text-center text-surface-400 italic">
                                    {ar() ? "لا توجد عيادات حالياً" : "No clinics available"}
                                  </div>
                                )}
                              </div>

                              {/* Cashback pricing breakdown */}
                              <div className="mt-auto">
                                {hasMembership && actualCashbackKwd > 0 ? (
                                  <div className="rounded-2xl mb-4 border border-surface-200 bg-white px-4 py-3 space-y-2">
                                    {/* Header */}
                                    <div className="flex items-center gap-2 pb-2 border-b border-surface-100">
                                      <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
                                      <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">{ar() ? "ملخص التوفير" : "Savings breakdown"}</span>
                                    </div>
                                    {/* Rows */}
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-surface-500 font-medium">{ar() ? "السعر الأصلي" : "Original price"}</span>
                                      <span className="text-sm font-medium text-surface-400 line-through">{basePrice.toFixed(3)} KWD</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-xs text-surface-600 font-medium">{ar() ? "خصم كاش باك العضوية" : "Membership cashback"}</span>
                                      </div>
                                      <span className="text-sm font-black text-emerald-600">−{actualCashbackKwd.toFixed(3)} KWD</span>
                                    </div>
                                    <div className="border-t border-surface-100 pt-2 flex justify-between items-center">
                                      <span className="text-xs font-bold text-surface-700 uppercase tracking-wide">{ar() ? "المبلغ المستحق" : "Amount due"}</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-black text-surface-900 leading-none">{effectivePrice >= 0 ? effectivePrice.toFixed(3) : "0.000"}</span>
                                        <span className="text-xs font-bold text-surface-500">KWD</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : !hasMembership ? (
                                  <div className="mb-4 flex items-center gap-2 text-surface-400">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                                    <span className="text-xs font-medium">{ar() ? "السعر القياسي" : "Standard price"}</span>
                                  </div>
                                ) : null}

                                {/* Price + CTA row — stack on very narrow viewports */}
                                <div className="flex flex-col gap-3 min-[400px]:flex-row min-[400px]:items-end min-[400px]:justify-between min-[400px]:gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-baseline gap-1.5 flex-wrap">
                                      <span className={`text-2xl sm:text-3xl font-black leading-none tracking-tight ${hasMembership && actualCashbackKwd > 0 ? 'text-brand-pink-600' : 'text-surface-900'}`}>
                                        {(hasMembership && actualCashbackKwd > 0 ? Math.max(0, effectivePrice) : finalPrice).toFixed(3)}
                                      </span>
                                      <span className="text-[11px] font-black text-surface-400 uppercase">KWD</span>
                                    </div>
                                    {hasMembership && actualCashbackKwd > 0 && (
                                      <div className="text-[10px] text-surface-400 mt-0.5">{ar() ? `بدلاً من ${basePrice.toFixed(3)}` : `vs ${basePrice.toFixed(3)} standard`}</div>
                                    )}
                                  </div>

                                  <button
                                    className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center justify-center gap-2 shrink-0 w-full min-[400px]:w-auto ${availableClinics.length > 0 ? hasMembership ? 'bg-brand-gradient text-white shadow-glow hover:opacity-90 hover:-translate-y-0.5' : 'bg-surface-900 text-white shadow-md hover:bg-surface-800 hover:shadow-lg hover:-translate-y-0.5' : 'bg-surface-100 text-surface-400 cursor-not-allowed'}`}
                                    disabled={availableClinics.length === 0}
                                    onClick={() => {
                                      if (applicableCashbackOffer) {
                                        const hasUnpaidInstallments = applicableCashbackOffer.method === "Installments" && (applicableCashbackOffer.totalInstallments || 1) > (applicableCashbackOffer.paidInstallments || 0);
                                        const requireInstallmentPayment = localStorage.getItem('bel_require_installment_booking_v1') === 'true';
                                        if (hasUnpaidInstallments && requireInstallmentPayment) {
                                          setSysAlert(ar() ? "يجب دفع القسط المستحق أولاً قبل حجز الجلسة باستخدام رصيد الكاش باك." : "You must pay your due installment before booking a session using cashback.");
                                          setTimeout(() => setSysAlert(null), 5000);
                                          return;
                                        }
                                      }
                                      const bookingPayload = {
                                        userOfferId: applicableCashbackOffer ? applicableCashbackOffer.id : null,
                                        id: applicableCashbackOffer ? applicableCashbackOffer.id : `temp_${t.id}`,
                                        offerId: ar() ? t.nameAr : t.nameEn,
                                        offerName: ar() ? t.nameAr : t.nameEn,
                                        treatmentName: ar() ? t.nameAr : t.nameEn,
                                        treatmentId: t.id,
                                        treatmentCategory: t.category,
                                        status: "active",
                                        method: applicableCashbackOffer ? "Membership" : "Standalone",
                                        priceKwd: basePrice,
                                        discountPct: actualDiscountPct,
                                        cashbackKwd: actualCashbackKwd,
                                        finalPrice,
                                        applicableCashbackOfferId: applicableCashbackOffer ? applicableCashbackOffer.id : null,
                                        clinicId: selectedClinicForCard || undefined,
                                        standaloneClinicIds: t.clinicIds?.length ? [...t.clinicIds] : undefined
                                      };
                                      setShowBookingModal(bookingPayload);
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    {ar() ? "احجز جلستك" : "Book Session"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                       </div>
                    );})}
                 </div>
              </div>
            </div>
          )}

          {activeTab === "my-purchases" && (() => {
            const purchaseTabs = [
              { id: "packages",     label: ar() ? "باقاتي وجلساتي"    : "My Packages",   icon: "📦" },
              { id: "chat",         label: ar() ? "محادثات الحجوزات" : "Booking Chat",  icon: "💬" },
              { id: "reservations", label: ar() ? "حجوزات العربون"   : "Reservations",  icon: "📌" },
            ] as const;
            return (
              <div className="mb-4 sm:mb-6 sticky top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-20 lg:static lg:z-auto pt-3 sm:pt-4 py-1 -mx-0.5 sm:mx-0 bg-surface-50/95 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none">
                <div className="mobile-switcher justify-center">
                  {purchaseTabs.map(pt => (
                    <button
                      key={pt.id}
                      onClick={() => setPurchasesSubTab(pt.id as any)}
                      className={`mobile-switcher-btn ${purchasesSubTab === pt.id ? "active" : ""}`}
                    >
                      <span aria-hidden="true">{pt.icon}</span>
                      <span>{pt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {activeTab === "my-purchases" && purchasesSubTab === "packages" && (
            <section id="sec-packages" className="space-y-8 animate-fade-in scroll-mt-24">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-surface-900">{ar() ? "عضوياتي وجلساتي" : "My Memberships & Sessions"}</h2>
                <button onClick={() => setActiveTab("store")} className="text-sm font-semibold text-brand-pink-600 hover:text-brand-pink-700 flex items-center gap-1">
                  {ar() ? "تصفح العضويات" : "Browse memberships"}
                  <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Unsigned forms banner */}
              {unsignedForms.length > 0 && !unsignedBannerDismissed && (
                <div className="sticky top-0 z-20 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm animate-slide-up">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-800">
                      {ar()
                        ? `لديك ${unsignedForms.length} ${unsignedForms.length === 1 ? "نموذج يحتاج" : "نماذج تحتاج"} إلى توقيعك`
                        : `You have ${unsignedForms.length} unsigned form${unsignedForms.length > 1 ? "s" : ""} requiring your signature`}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {ar() ? "يرجى توقيع النماذج المطلوبة قبل موعدك القادم." : "Please sign the required forms before your next session."}
                    </p>
                    <Link
                      to={`/forms/fill/${unsignedForms[0].id}?return=/dashboard`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                    >
                      {ar() ? "وقّع الآن" : "Sign now"}
                      <svg className="h-3.5 w-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                  <button
                    onClick={() => setUnsignedBannerDismissed(true)}
                    aria-label={ar() ? "إغلاق" : "Dismiss"}
                    className="shrink-0 rounded-full p-1 text-amber-500 hover:bg-amber-100 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              {/* Real server-backed offers w/ installment + reservation status */}
              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "اشتراكاتي النشطة" : "Active Memberships"}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {(offersData?.items || []).filter((uo) => !uo.isStandalone).length === 0 ? (
                    <div className="p-8 text-center text-surface-400 text-sm">{ar() ? "لا توجد اشتراكات بعد" : "No active memberships yet"}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {(offersData?.items || []).filter((uo) => !uo.isStandalone).map((uo) => {
                        const statusBadge = (() => {
                          const paid = uo.installmentsPaid ?? 0;
                          const total = uo.installmentCount ?? 0;
                          if (uo.status === "active") {
                            if (uo.purchaseMode === "installments" && total > 0) {
                              if (paid >= total) return { en: "Fully Paid", ar: "مدفوع بالكامل", cls: "bg-emerald-50 text-emerald-700" };
                              return { en: `On Installments ${paid}/${total}`, ar: `أقساط ${paid}/${total}`, cls: "bg-indigo-50 text-indigo-700" };
                            }
                            if (uo.purchaseMode === "enet") return { en: "ENET Approved", ar: "اعتماد ENET", cls: "bg-emerald-50 text-emerald-700" };
                            return { en: "Fully Paid", ar: "مدفوع بالكامل", cls: "bg-emerald-50 text-emerald-700" };
                          }
                          switch (uo.status) {
                            case "pending_payment": return { en: "Pending payment", ar: "بانتظار الدفع", cls: "bg-amber-50 text-amber-700" };
                            case "reserved": return { en: "Reserved (deposit)", ar: "محجوز (دفعة)", cls: "bg-blue-50 text-blue-700" };
                            case "enet_pending": return { en: "ENET Pending", ar: "مراجعة ENET", cls: "bg-purple-50 text-purple-700" };
                            case "enet_rejected": return { en: "ENET Rejected", ar: "رفض ENET", cls: "bg-red-50 text-red-700" };
                            case "expired": return { en: "Expired", ar: "منتهي", cls: "bg-surface-100 text-surface-600" };
                            default: return { en: uo.status, ar: uo.status, cls: "bg-surface-100 text-surface-600" };
                          }
                        })();
                        const isInstallments = uo.purchaseMode === "installments";
                        const nextInst = uo.installmentSchedule?.find((s: { paid?: boolean }) => !s.paid);
                        return (
                          <div key={uo.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-surface-900 text-sm truncate">{(uo as { offerName?: string }).offerName || homeCatalogData?.items?.find((x: any) => x.id === uo.offerId)?.name || uo.offerId}</div>
                                <div className="text-[11px] text-surface-500 mt-0.5">
                                  {uo.activatedAt && <>{ar() ? "مفعّل:" : "Activated:"} {new Date(uo.activatedAt).toLocaleDateString()} · </>}
                                  {ar() ? "الجلسات:" : "Sessions:"} {uo.sessionsUsed ?? 0}
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${statusBadge.cls}`}>{ar() ? statusBadge.ar : statusBadge.en}</span>
                            </div>

                            {isInstallments && uo.installmentSchedule && (
                              <div className="bg-surface-50 rounded-xl p-3">
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="font-bold text-surface-700">{ar() ? "تقدم الأقساط" : "Installment progress"}</span>
                                  <span className="text-surface-500">{uo.installmentsPaid ?? 0}/{uo.installmentCount ?? 0}</span>
                                </div>
                                <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-brand-pink-500 transition-all" style={{ width: `${((uo.installmentsPaid ?? 0) / (uo.installmentCount || 1)) * 100}%` }} />
                                </div>
                                {nextInst && (
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-surface-600">
                                      {ar() ? "القسط القادم" : "Next"}: <span className="font-bold text-surface-900">{nextInst.amountKwd} KWD</span>
                                      <span className="text-surface-400"> · {new Date(nextInst.dueDate).toLocaleDateString()}</span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await apiFetch("/checkout/installments/pay-next", {
                                            method: "POST",
                                            headers: getAuthHeader(),
                                            body: JSON.stringify({ userOfferId: uo.id })
                                          });
                                          await refetchMyOffers();
                                          setSysAlert(ar() ? "تم إرسال طلب الدفع لخدمة العملاء" : "Payment request submitted. Awaiting confirmation.");
                                          setTimeout(() => setSysAlert(null), 4000);
                                        } catch (e: unknown) {
                                          const msg = e instanceof Error ? e.message : "Payment failed";
                                          setSysAlert(msg);
                                          setTimeout(() => setSysAlert(null), 5000);
                                        }
                                      }}
                                      className="text-xs font-bold bg-brand-pink-500 hover:bg-brand-pink-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap"
                                    >
                                      {ar() ? "ادفع الآن" : "Pay now"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {uo.status === "reserved" && uo.reservationExpiresAt && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs">
                                <div className="font-bold text-blue-900">
                                  {ar() ? "محجوز حتى" : "Reserved until"} {new Date(uo.reservationExpiresAt).toLocaleString()}
                                </div>
                                <div className="text-blue-700 mt-0.5">
                                  {ar() ? "أكملي الرصيد لتفعيل العرض." : "Complete the balance to activate this offer."}
                                </div>
                                <ReservationConvertControls
                                  userOfferId={uo.id}
                                  preferredPlan={uo.reservationPreferredPlan}
                                  ar={ar()}
                                  getAuthHeader={getAuthHeader}
                                  onDone={async (msg) => {
                                    await refetchMyOffers();
                                    setSysAlert(msg);
                                    setTimeout(() => setSysAlert(null), 5000);
                                  }}
                                />
                              </div>
                            )}

                            {uo.status === "enet_pending" && (
                              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
                                {ar() ? "في انتظار موافقة ENET. ستصلك إشعار عند الانتهاء." : "Waiting for ENET approval. You'll be notified when it completes."}
                              </div>
                            )}

                            {uo.status === "enet_rejected" && (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                                {ar() ? "رفضت ENET الطلب. جرّبي خطة دفع أخرى." : "ENET declined. Try a different payment plan."}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "الباقات المشتراة" : "Purchased Packages"}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {offers.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {offers.map(o => (
                        <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-pink-50 text-brand-pink-500 shrink-0">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                              <div className="font-bold text-surface-900 text-sm">{o.offerName || o.offerId || "Package"}</div>
                              <div className="text-xs text-surface-500 mt-0.5">{ar() ? "طريقة الدفع:" : "Method:"} {o.method}</div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between">
                            <div className="font-black text-brand-pink-500">{o.amount || "0 KWD"}</div>
                            <div className="text-[10px] text-surface-400 mt-1">{new Date(o.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Awaiting session payment requests */}
              {(() => {
                const pendingPayments = (myRequestsData?.items ?? []).filter((r) => r.status === "awaiting_session_payment");
                if (pendingPayments.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "طلبات بانتظار دفع رسوم الجلسة" : "Session Fees Awaiting Payment"}</h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden divide-y divide-amber-200">
                      {pendingPayments.map((r) => {
                        const clinic = clinicsById.get(r.clinicId);
                        const clinicName = clinic ? (ar() ? clinic.nameAr : clinic.nameEn) : r.clinicId;
                        return (
                          <SessionPaymentRow
                            key={r.id}
                            request={r}
                            clinicName={clinicName}
                            ar={ar()}
                            getAuthHeader={getAuthHeader}
                            onDone={async () => {
                              await refetchMyRequests();
                              setSysAlert(ar() ? "تم الدفع — طلبك قيد المراجعة" : "Payment complete — your request is now under review");
                              setTimeout(() => setSysAlert(null), 5000);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Active booking requests (non awaiting_payment) */}
              {(() => {
                const activeRequests = (myRequestsData?.items ?? []).filter(
                  (r) => r.status !== "awaiting_session_payment"
                );
                if (activeRequests.length === 0) return null;
                const statusMeta: Record<string, { label: string; labelAr: string; color: string }> = {
                  under_review:  { label: "Under Review",   labelAr: "قيد المراجعة",    color: "bg-amber-100 text-amber-800" },
                  slot_proposed: { label: "Time Proposed",  labelAr: "وقت مقترح",        color: "bg-blue-100 text-blue-800" },
                  slot_accepted: { label: "Slot Accepted",  labelAr: "الوقت مقبول",      color: "bg-purple-100 text-purple-800" },
                  confirmed:     { label: "Confirmed",      labelAr: "مؤكد",              color: "bg-emerald-100 text-emerald-800" },
                  rejected:      { label: "Declined",       labelAr: "مرفوض",             color: "bg-red-100 text-red-800" },
                  cancelled:     { label: "Cancelled",      labelAr: "ملغى",              color: "bg-surface-100 text-surface-500" },
                };
                return (
                  <div>
                    <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "طلبات الحجز" : "Booking Requests"}</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden divide-y divide-surface-100">
                      {activeRequests.map((r) => {
                        const clinic = clinicsById.get(r.clinicId);
                        const clinicName = clinic ? (ar() ? clinic.nameAr : clinic.nameEn) : r.clinicId;
                        const meta = statusMeta[r.status] ?? { label: r.status, labelAr: r.status, color: "bg-surface-100 text-surface-700" };
                        return (
                          <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${r.status === "confirmed" ? "bg-emerald-50 text-emerald-600" : r.status === "rejected" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                                {r.status === "confirmed"
                                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  : r.status === "rejected"
                                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                }
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-surface-900 text-sm">{ar() ? "طلب حجز" : "Booking Request"}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{ar() ? meta.labelAr : meta.label}</span>
                                </div>
                                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة:" : "Clinic:"} <span className="font-semibold text-surface-700">{clinicName}</span></div>
                                {r.preferredAt && <div className="text-xs text-surface-400 mt-0.5">{ar() ? "الوقت المفضل:" : "Preferred:"} {new Date(r.preferredAt).toLocaleString()}</div>}
                                {r.proposedAt && r.status === "slot_proposed" && <div className="text-xs text-blue-600 mt-0.5 font-medium">{ar() ? "الوقت المقترح:" : "Proposed time:"} {new Date(r.proposedAt).toLocaleString()}</div>}
                                {r.rejectionReason && <div className="text-xs text-red-500 mt-0.5">{ar() ? "السبب:" : "Reason:"} {r.rejectionReason}</div>}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0 flex-wrap">
                              {r.conversationId && (
                                <button
                                  type="button"
                                  className="text-xs font-bold bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  onClick={() => { setChatConvId(r.conversationId!); setActiveTab("my-purchases"); setPurchasesSubTab("chat"); }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                  {ar() ? "المحادثة" : "View chat"}
                                </button>
                              )}
                              {r.status === "slot_proposed" && (
                                <button
                                  type="button"
                                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={async () => {
                                    try {
                                      await apiFetch(`/scheduling/me/requests/${r.id}/accept`, { method: "POST", headers: getAuthHeader() });
                                      await refetchMyRequests();
                                      setSysAlert(ar() ? "تم قبول الوقت المقترح" : "Slot accepted");
                                      setTimeout(() => setSysAlert(null), 4000);
                                    } catch (e: any) { alert(e.message); }
                                  }}
                                >{ar() ? "قبول الوقت" : "Accept slot"}</button>
                              )}
                              {["under_review", "slot_proposed"].includes(r.status) && (
                                <button
                                  type="button"
                                  className="text-xs font-bold bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={async () => {
                                    if (!confirm(ar() ? "هل تريد إلغاء طلب الحجز؟" : "Cancel this booking request?")) return;
                                    try {
                                      await apiFetch(`/scheduling/me/requests/${r.id}/cancel`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({}) });
                                      await refetchMyRequests();
                                    } catch (e: any) { alert(e.message); }
                                  }}
                                >{ar() ? "إلغاء" : "Cancel"}</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "الجلسات المحجوزة" : "Booked Sessions"}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {sessions.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {sessions.map((b: any) => {
                        const clinic = clinicsById.get(b.clinicId);
                        const clinicName = clinic ? (ar() ? clinic.nameAr : clinic.nameEn) : b.clinicId;
                        return (
                          <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                              <div>
                                <div className="font-bold text-surface-900 text-sm">{ar() ? "جلسة" : "Session"}</div>
                                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة:" : "Clinic:"} <span className="font-semibold text-surface-700">{clinicName}</span></div>
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end justify-between">
                              <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{b.status}</div>
                              <div className="text-[10px] text-surface-400 mt-1">{new Date(b.scheduledAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === "my-purchases" && purchasesSubTab === "chat" && (
            <section id="sec-chat" className="space-y-4 animate-fade-in scroll-mt-24">
              <div>
                <h2 className="text-2xl font-bold text-surface-900">{ar() ? "محادثات الحجوزات" : "Booking Conversations"}</h2>
                <p className="text-sm text-surface-500 mt-1">
                  {ar() ? "تواصل مع العيادة وخدمة العملاء لتأكيد المواعيد." : "Coordinate with your clinic and customer relations to confirm appointments."}
                </p>
              </div>
              <ChatWidget conversationId={chatConvId} />
            </section>
          )}

          {activeTab === "wallet" && walletSubTab === "cashback" && (
            <section id="sec-cashback" className="space-y-4 sm:space-y-6 animate-fade-in scroll-mt-24">
              <h2 className="text-lg sm:text-xl font-bold text-surface-900">{ar() ? "محفظة الكاش باك" : "Cashback Wallet"}</h2>
              {(() => {
                const walletTxns = walletData?.txns ?? [];
                const unlocked = parseFloat(wallet?.unlockedBalance || "0");
                const locked = parseFloat(wallet?.lockedBalance || "0");
                const used = walletTxns.filter(t => t.type === "deduction").reduce((s, t) => s + parseFloat(t.amountKwd || "0"), 0);
                const total = unlocked + locked;
                const txnLabels: Record<string, { en: string; ar: string; color: string; sign: string }> = {
                  signup_bonus:          { en: "Signup bonus",         ar: "مكافأة التسجيل",    color: "text-emerald-600", sign: "+" },
                  unlock:                { en: "Session unlock",        ar: "رصيد مكتسب",        color: "text-emerald-600", sign: "+" },
                  deduction:             { en: "Cashback used",         ar: "كاش باك مستخدم",    color: "text-red-500",     sign: "-" },
                  adjustment:            { en: "Manual adjustment",     ar: "تعديل يدوي",        color: "text-blue-600",    sign: "±" },
                  reversal:              { en: "Reversal",              ar: "استرداد",           color: "text-amber-600",   sign: "+" },
                  forfeited_due_to_ceiling: { en: "Forfeited (ceiling)", ar: "مصادر (حد أقصى)", color: "text-surface-400",  sign: "-" },
                };
                return (
                  <>
                    <div className="wallet-card shadow-glow-lg">
                      <div className="flex justify-between items-start gap-3 mb-5">
                        <div className="min-w-0">
                          <div className="text-white/70 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">{ar() ? "محفظة الكاش باك" : "Cashback Wallet"}</div>
                          <div className="text-3xl sm:text-4xl font-black mt-1 text-white tabular-nums tracking-tight">{unlocked.toFixed(3)} <span className="text-lg sm:text-xl opacity-70 font-bold">KWD</span></div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-white backdrop-blur-md shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          {total > 0 ? (ar() ? "نشطة" : "Active") : (ar() ? "غير نشط" : "Inactive")}
                        </div>
                      </div>

                      {/* Segmented Progress Bar */}
                      {(() => {
                        const pctUnlocked = total > 0 ? (unlocked / total) * 100 : 0;
                        const pctLocked = Math.max(0, 100 - pctUnlocked);
                        return (
                          <div className="mb-4">
                            <div className="h-3 w-full rounded-full overflow-hidden flex bg-black/15">
                              {pctUnlocked > 0 && <div className="h-full bg-white transition-all duration-500" style={{ width: `${pctUnlocked}%` }} />}
                              {pctLocked > 0 && <div className="h-full bg-white/30 transition-all duration-500" style={{ width: `${pctLocked}%` }} />}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Three stat columns */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-white/20 border border-white/30 rounded-xl py-2.5 px-2 text-center backdrop-blur-sm shadow-sm">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span className="text-white/90 text-[10px] font-bold">{ar() ? "متاح للاستخدام" : "Available"}</span>
                          </div>
                          <div className="text-white font-black text-base sm:text-lg tabular-nums">{unlocked.toFixed(3)}</div>
                        </div>
                        <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مقفل" : "Locked"}</span>
                          </div>
                          <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{locked.toFixed(3)}</div>
                        </div>
                        <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مستخدم" : "Used"}</span>
                          </div>
                          <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{used.toFixed(3)}</div>
                        </div>
                      </div>

                      {/* Locked hint */}
                      {locked > 0 && (
                        <div className="mt-3 text-white/60 text-[10px] sm:text-[11px] text-center font-medium">
                          {ar() 
                            ? "💡 ادفع أقساطك لفتح الرصيد المقفل"
                            : "💡 Pay your installments to unlock locked balance"}
                        </div>
                      )}
                    </div>

                    {/* Transaction History */}
                    <div>
                      <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "سجل المعاملات" : "Transaction History"}</h3>
                      <div className="bg-white rounded-2xl border border-surface-200 divide-y divide-surface-100">
                        {walletTxns.length === 0 ? (
                          <div className="p-6 text-center text-surface-400 text-sm">{ar() ? "لا توجد معاملات بعد" : "No transactions yet"}</div>
                        ) : (() => {
                          // Compute running unlocked balance per txn (newest first, so reverse for running calc)
                          let runningBal = unlocked;
                          const txnsWithBal = walletTxns.map(txn => {
                            const amt = parseFloat(txn.amountKwd || "0");
                            const balAfter = runningBal;
                            if (txn.type === "deduction" || txn.type === "forfeited_due_to_ceiling") runningBal += amt;
                            else if (txn.type === "signup_bonus" || txn.type === "unlock" || txn.type === "reversal" || txn.type === "adjustment") runningBal -= amt;
                            return { txn, balAfter };
                          });
                          return txnsWithBal.map(({ txn, balAfter }) => {
                            const meta = txnLabels[txn.type] ?? { en: txn.type, ar: txn.type, color: "text-surface-700", sign: "+" };
                            const rawAmt = parseFloat(txn.amountKwd || "0");
                            // For signed txn types (adjustment), derive sign and color from the amount's actual polarity
                            const isSignedType = txn.type === "adjustment";
                            const displaySign = isSignedType ? (rawAmt >= 0 ? "+" : "-") : meta.sign;
                            const displayColor = isSignedType ? (rawAmt >= 0 ? "text-emerald-600" : "text-red-500") : meta.color;
                            const displayAmt = Math.abs(rawAmt).toFixed(3);
                            return (
                              <div key={txn.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${txn.type === "deduction" ? "bg-red-50" : txn.type === "signup_bonus" || txn.type === "unlock" ? "bg-emerald-50" : "bg-blue-50"}`}>
                                    {txn.type === "signup_bonus" ? "🎁" : txn.type === "deduction" ? "💳" : txn.type === "unlock" ? "✅" : txn.type === "reversal" ? "↩️" : "⚙️"}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-surface-900 text-sm">{ar() ? meta.ar : meta.en}</div>
                                    {txn.reason && <div className="text-xs text-surface-400 mt-0.5">{txn.reason}</div>}
                                    <div className="text-xs text-surface-400 mt-0.5">{new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString()}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`font-bold text-sm ${displayColor}`}>{displaySign}{displayAmt} KWD</div>
                                  <div className="text-[10px] text-surface-400 mt-0.5">{ar() ? "رصيد" : "Bal"}: {balAfter.toFixed(3)}</div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Active Offer Cashback (local) */}
                    {offers.filter(o => o.status === 'active' && parseFloat(o.cashbackBalanceKwd || '0') > 0).length > 0 && (
                      <div>
                        <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "كاش باك العروض النشطة" : "Active Offer Cashback"}</h3>
                        <div className="bg-white rounded-2xl border border-surface-200 divide-y divide-surface-100">
                          {offers.filter(o => o.status === 'active' && parseFloat(o.cashbackBalanceKwd || '0') > 0).map(o => (
                            <div key={o.id} className="p-4 flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-surface-900 text-sm">{o.offerName || o.offerId || "Package"}</div>
                                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "كاش باك مكتسب" : "Earned cashback"}</div>
                              </div>
                              <div className="font-black text-brand-pink-500">{parseFloat(o.cashbackBalanceKwd || '0').toFixed(3)} KWD</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          )}

          {activeTab === "wallet" && walletSubTab === "history" && (
            <section id="sec-history" className="space-y-6 animate-fade-in scroll-mt-24">
              <h2 className="text-xl font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payment History"}</h2>

              {/* Server-side session payments */}
              {(myServerPayments?.items ?? []).filter((p) => p.purpose === "session_payment").length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "مدفوعات الجلسات" : "Session Payments"}</h3>
                  <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden divide-y divide-surface-100">
                    {(myServerPayments?.items ?? [])
                      .filter((p) => p.purpose === "session_payment")
                      .map((p) => (
                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-500">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                              <div className="font-semibold text-surface-900 text-sm">{ar() ? "رسوم جلسة" : "Session fee"}</div>
                              <div className="text-xs text-surface-400 mt-0.5">
                                {new Date(p.createdAt).toLocaleDateString()} · <span className={`font-medium ${p.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{p.status}</span>
                              </div>
                            </div>
                          </div>
                          <div className="font-bold text-surface-900">{p.amountKwd} KWD</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "مدفوعات العضوية" : "Membership Payments"}</h3>
              <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                {localLedger.length === 0 ? (
                  <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                ) : (
                  <div className="divide-y divide-surface-100">
                    {[...localLedger].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(txn => (
                      <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div>
                            <div className="font-semibold text-surface-900 text-sm">{txn.description || txn.type.replace(/_/g, ' ').toUpperCase()}</div>
                            <div className="text-xs text-surface-400 mt-0.5">{new Date(txn.createdAt).toLocaleDateString()} {new Date(txn.createdAt).toLocaleTimeString()}</div>
                          </div>
                        </div>
                        <div className="font-bold text-surface-900">{txn.amount} KWD</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "settings" && (
            <section id="sec-settings" className="space-y-5 animate-fade-in scroll-mt-24">

              {/* Profile Hero Card */}
              <div className="relative rounded-3xl overflow-hidden bg-brand-gradient p-6 text-white shadow-glow">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 80% 20%, white 0%, transparent 60%)"}} />
                <div className="relative flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shrink-0 shadow-lg">
                    <span className="text-2xl font-black text-white select-none">
                      {(profileForm.name || profileForm.username || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">{ar() ? "حسابي" : "My Account"}</div>
                    <div className="text-xl font-black leading-tight truncate">{profileForm.name || profileForm.username}</div>
                    <div className="text-sm text-white/70 mt-0.5 font-mono truncate" dir="ltr">@{profileForm.username}</div>
                  </div>
                  <div className="ms-auto shrink-0">
                    {kycStatus === 'approved' ? (
                      <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30">
                        <svg className="w-3.5 h-3.5 text-emerald-300" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span className="text-xs font-bold text-white">{ar() ? "موثق" : "Verified"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-amber-400/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-300/40">
                        <svg className="w-3.5 h-3.5 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <span className="text-xs font-bold text-amber-100">{ar() ? "غير موثق" : "Unverified"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Details Card */}
              <div className="bg-white rounded-3xl border border-surface-200 overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-6 py-4 border-b border-surface-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-pink-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <span className="font-bold text-surface-900">{ar() ? "البيانات الشخصية" : "Personal Details"}</span>
                  </div>
                  {!isEditingProfile ? (
                    <button onClick={() => setIsEditingProfile(true)} className="text-brand-pink-600 text-sm font-bold hover:text-brand-pink-700 bg-brand-pink-50 hover:bg-brand-pink-100 px-4 py-1.5 rounded-xl transition-colors">
                      {ar() ? "تعديل" : "Edit Profile"}
                    </button>
                  ) : (
                    <button onClick={async () => {
                      try {
                        await apiFetch("/users/me", {
                          method: "PATCH",
                          headers: getAuthHeader(),
                          body: JSON.stringify({
                            username: profileForm.username,
                            fullName: profileForm.name,
                            phone: profileForm.phone,
                            email: profileForm.email
                          })
                        });
                        setIsEditingProfile(false);
                        refetchProfile();
                      } catch (e: any) {
                        alert(e.message || "Failed to update profile");
                      }
                    }} className="text-emerald-600 text-sm font-bold hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-xl transition-colors flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {ar() ? "حفظ التغييرات" : "Save Changes"}
                    </button>
                  )}
                </div>
                <div className="p-6 grid gap-0 divide-y divide-surface-50">
                  {/* Username row */}
                  <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "اسم المستخدم" : "Username"}</div>
                        {isEditingProfile ? (
                          <input type="text" className="input-field py-1 text-sm" value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} dir="ltr" />
                        ) : (
                          <div className="font-bold text-brand-pink-600 font-mono text-sm">@{profileForm.username}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Full Name row */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "الاسم الكامل" : "Full Name"}</div>
                        {isEditingProfile ? (
                          <input type="text" className="input-field py-1 text-sm" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                        ) : (
                          <div className="font-semibold text-surface-900 text-sm">{profileForm.name}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Phone row */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "رقم الهاتف" : "Phone Number"}</div>
                        {isEditingProfile ? (
                          <input type="text" className="input-field py-1 text-sm" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} dir="ltr" />
                        ) : (
                          <div className="font-semibold text-surface-900 text-sm" dir="ltr">{profileForm.phone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Email row */}
                  <div className="flex items-center justify-between py-4 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</div>
                        {isEditingProfile ? (
                          <input type="email" className="input-field py-1 text-sm" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} dir="ltr" />
                        ) : (
                          <div className="font-semibold text-surface-900 text-sm">{profileForm.email}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KYC Verification Card */}
              <div className={`rounded-3xl border overflow-hidden ${kycStatus === 'approved' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${kycStatus === 'approved' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {kycStatus === 'approved' ? (
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      ) : (
                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-1">{ar() ? "التحقق الرقمي (KYC)" : "Digital KYC Verification"}</div>
                      <div className={`font-black text-lg ${kycStatus === 'approved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {kycStatus === 'approved' ? (ar() ? "✓ هويتك موثقة" : "✓ Identity Verified") : (ar() ? "هويتك غير موثقة" : "Identity Unverified")}
                      </div>
                      {kycStatus === 'unverified' && (
                        <p className="text-xs text-amber-700/80 mt-1.5 max-w-xs leading-relaxed">{ar() ? "أكملي التوثيق لتفعيل الدفع، شراء الباقات، وإدارة الكاش باك." : "Complete verification to enable payments, packages, and cashback."}</p>
                      )}
                    </div>
                  </div>
                  {kycStatus === 'unverified' && (
                    <button onClick={() => setShowKyc(true)} className="btn-primary shrink-0 shadow-md px-6">
                      {ar() ? "ابدأ التوثيق الآن" : "Start Verification"}
                    </button>
                  )}
                </div>
              </div>

              {/* Log Out */}
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-surface-500 hover:text-red-500 font-bold py-4 rounded-3xl border border-surface-200 hover:border-red-200 transition-all group">
                <svg className="w-4 h-4 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                {ar() ? "تسجيل الخروج" : "Log Out"}
              </button>
            </section>
          )}

          {activeTab === "my-purchases" && purchasesSubTab === "reservations" && (
            <section id="sec-reservations" className="space-y-6 animate-fade-in scroll-mt-24">
              <div>
                <h2 className="text-xl font-bold text-surface-900">{ar() ? "حجوزاتي بالعربون" : "My Deposit Reservations"}</h2>
                <p className="text-sm text-surface-500 mt-1">
                  {ar() ? "عروضك المحجوزة بعربون — أكملي الدفع قبل انتهاء مدة الحجز." : "Memberships held with a deposit — complete the balance before they expire."}
                </p>
              </div>

              {(reservationsData?.items ?? []).length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 p-10 text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="font-bold text-surface-700">{ar() ? "لا توجد حجوزات بالعربون بعد" : "No deposit reservations yet"}</p>
                  <p className="text-sm text-surface-400 mt-1">{ar() ? "يمكنك حجز عرض بدفع عربون من صفحة العروض." : "Reserve an offer with a deposit from the offers page."}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(reservationsData?.items ?? []).map((r: ReservationItem) => {
                    const isActive = r.status === "reserved";
                    const isConverted = r.status === "active";
                    const isExpired = r.status === "expired" || r.status === "cancelled";
                    const daysLeft = r.reservationExpiresAt
                      ? Math.ceil((new Date(r.reservationExpiresAt).getTime() - Date.now()) / 86400000)
                      : null;
                    const urgent = daysLeft !== null && daysLeft <= 3 && isActive;
                    return (
                      <div key={r.id} className={`bg-white rounded-2xl border overflow-hidden ${urgent ? "border-red-300" : isConverted ? "border-emerald-200" : isExpired ? "border-surface-200" : "border-blue-200"}`}>
                        <div className={`px-5 py-3 flex items-center justify-between ${urgent ? "bg-red-50" : isConverted ? "bg-emerald-50" : isExpired ? "bg-surface-50" : "bg-blue-50"}`}>
                          <div className="font-bold text-surface-900 text-sm">{r.isStandalone && r.standaloneName ? r.standaloneName : (r.offerName || homeCatalogData?.items?.find((x: any) => x.id === r.offerId)?.name || r.offerId)}</div>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isActive ? "bg-blue-100 text-blue-700" : isConverted ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}>
                            {isActive ? (ar() ? "محجوز" : "Reserved") : isConverted ? (ar() ? "مُحوَّل" : "Converted") : (ar() ? "منتهي" : "Expired")}
                          </span>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-surface-400 font-medium">{ar() ? "العربون المدفوع" : "Deposit paid"}</div>
                              <div className="font-black text-brand-pink-600 text-sm mt-0.5">{r.depositAmountKwd ?? "—"} KWD</div>
                            </div>
                            {r.reservationPreferredPlan && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "الخطة المفضّلة" : "Preferred plan"}</div>
                                <div className="font-bold text-surface-700 mt-0.5">
                                  {r.reservationPreferredPlan === "full" ? (ar() ? "دفع كامل" : "Full") :
                                   r.reservationPreferredPlan === "installments_2" ? (ar() ? "قسطين" : "2 installments") :
                                   r.reservationPreferredPlan === "installments_3" ? (ar() ? "3 أقساط" : "3 installments") :
                                   ar() ? "4 أقساط ENET" : "4× ENET"}
                                </div>
                              </div>
                            )}
                            {isActive && r.reservationExpiresAt && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "ينتهي في" : "Expires"}</div>
                                <div className={`font-bold mt-0.5 ${urgent ? "text-red-600" : "text-surface-700"}`}>
                                  {new Date(r.reservationExpiresAt).toLocaleDateString()}
                                  {daysLeft !== null && daysLeft >= 0 && (
                                    <span className="ml-1 text-[11px]">({daysLeft}d)</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {isConverted && r.activatedAt && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "تفعيل في" : "Activated"}</div>
                                <div className="font-bold text-emerald-600 mt-0.5">{new Date(r.activatedAt).toLocaleDateString()}</div>
                              </div>
                            )}
                            {r.reservationCompletionExpectedAt && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "موعد الإكمال المتوقع" : "Expected completion"}</div>
                                <div className="font-bold text-surface-700 mt-0.5">{new Date(r.reservationCompletionExpectedAt).toLocaleDateString()}</div>
                              </div>
                            )}
                          </div>

                          {urgent && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs font-bold text-red-700">
                              {ar() ? `⚠️ ينتهي حجزك خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} — أكملي الدفع الآن.` : `⚠️ Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — complete your balance now.`}
                            </div>
                          )}

                          {isActive && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                              <div className="text-xs font-bold text-blue-900 mb-2">{ar() ? "أكملي دفع الرصيد" : "Complete your balance"}</div>
                              <ReservationConvertControls
                                userOfferId={r.id}
                                preferredPlan={r.reservationPreferredPlan}
                                ar={ar()}
                                getAuthHeader={getAuthHeader}
                                onDone={async (msg) => {
                                  await refetchReservations();
                                  await refetchMyOffers();
                                  setSysAlert(msg);
                                  setTimeout(() => setSysAlert(null), 5000);
                                }}
                              />
                            </div>
                          )}

                          {isConverted && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-medium text-emerald-700">
                              {ar() ? "✅ تم إكمال الدفع وتفعيل العرض. يمكنك الآن حجز جلساتك." : "✅ Payment completed and offer activated. You can now book your sessions."}
                            </div>
                          )}

                          {isExpired && (
                            <div className="text-xs text-surface-500">
                              {ar() ? "انتهت صلاحية هذا الحجز. تصفحي العروض لحجز جديد." : "This reservation has expired. Browse offers to make a new reservation."}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeTab === "wallet" && walletSubTab === "card" && (
            <section id="sec-card" className="space-y-6 animate-fade-in scroll-mt-24">
              <div>
                <h2 className="text-xl font-bold text-surface-900">{ar() ? "بطاقتي الرقمية" : "My Digital Card"}</h2>
                <p className="text-sm text-surface-500 mt-1">{ar() ? "امسح رمز QR في العيادة للتحقق من هويتك وعضويتك." : "Scan this QR at the clinic to verify your identity and membership."}</p>
              </div>

              {cardLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-4 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin" />
                </div>
              ) : (cardError || !cardData) ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-surface-900 text-sm">{ar() ? "تعذّر تحميل بطاقتك" : "Unable to load your card"}</p>
                    <p className="text-xs text-surface-500 mt-1">{ar() ? "يرجى تسجيل الخروج وإعادة الدخول إذا استمرت المشكلة." : "Please log out and log back in if this persists."}</p>
                  </div>
                  <button onClick={() => window.location.reload()} className="btn-primary btn-sm text-xs">{ar() ? "إعادة المحاولة" : "Try Again"}</button>
                </div>
              ) : (
                                <div className="max-w-md mx-auto lg:mx-0">
                  {/* Visa-style Membership Card */}
                  <div className="relative rounded-2xl shadow-2xl overflow-hidden aspect-[1.586/1] bg-gradient-to-br from-surface-900 via-brand-pink-900 to-brand-pink-700 text-white p-6 flex flex-col justify-between mb-8 group">
                    {/* Glossy overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start z-10">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-pink-200/80">
                        {ar() ? "بطاقة العضوية" : "Membership Card"}
                      </div>
                      {/* QR Code on the card (top right) */}
                      {cardData.card.publicToken && (
                        <div className="bg-white p-1.5 rounded-xl shadow-lg transform group-hover:scale-105 transition-transform">
                          <QRCodeCanvas
                            value={`${SITE_BASE_URL}/verify/${cardData.card.publicToken}`}
                            size={64}
                            className="block w-16 h-16 rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="z-10 space-y-3">
                      <div className="text-2xl font-black tracking-widest drop-shadow-md">
                        {cardData.card.displayName}
                      </div>
                      
                      <div className="flex items-end justify-between">
                        <div>
                          {cardData.card.memberSince && (
                            <div className="text-[10px] uppercase tracking-wider text-brand-pink-200/80 mb-1">
                              {ar() ? "عضو منذ" : "Member Since"} {new Date(cardData.card.memberSince).toLocaleDateString(ar() ? "ar-KW" : "en-KW", { month: "short", year: "numeric" })}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {cardData.card.kycVerified ? (
                              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm border border-white/10">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                {ar() ? "هوية موثقة" : "Identity Verified"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-black/30 text-white/80 text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm border border-white/5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {ar() ? "التحقق معلق" : "Verification Pending"}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="opacity-60 flex items-center gap-2">
                           <svg className="w-8 h-8" viewBox="0 0 80 80" fill="none"><path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="white" opacity="0.9"/><path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="white" opacity="0.6"/><path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="white" opacity="0.6"/></svg>
                           <span className="font-bold tracking-widest uppercase text-white/90 text-sm">Belamonda</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {sysAlert && (
                <div className="max-w-md mx-auto lg:mx-0 bg-surface-900 text-white text-sm font-medium px-4 py-3 rounded-2xl animate-fade-in">
                  {sysAlert}
                </div>
              )}
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "forms" && (
            <section id="sec-forms" className="animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "نماذجي الموقعة" : "My Signed Forms"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "وثائق ونماذج الموافقة الخاصة بك" : "Your consent documents and agreements"}</p>
                </div>
              </div>
              <MyFormsSection />
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "notifications" && (
            <section id="sec-notifications" className="space-y-4 animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-2xl bg-brand-pink-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "الإشعارات" : "Notifications"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "تحديثات وتنبيهات الحساب" : "Account updates and alerts"}</p>
                </div>
              </div>
              <div className="bg-white rounded-3xl border border-surface-200 overflow-hidden shadow-sm">
                {(notifData?.inbox || []).length === 0 ? (
                  <div className="py-14 px-6 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    </div>
                    <p className="font-bold text-surface-700 mb-1">{ar() ? "لا توجد إشعارات حالياً" : "All caught up!"}</p>
                    <p className="text-sm text-surface-400">{ar() ? "ستصلك إشعاراتك هنا عند وجودها" : "Notifications will appear here when there's something new"}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-100">
                    {(notifData?.inbox || []).map((n: any) => (
                      <div key={n.id} className={`p-4 flex items-start gap-4 hover:bg-surface-50 transition-colors ${!n.read ? "bg-brand-pink-50/30" : ""}`}>
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-surface-200" : "bg-brand-pink-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-surface-900 text-sm">{n.title || n.type}</div>
                          {n.body && <div className="text-xs text-surface-500 mt-0.5 leading-relaxed">{n.body}</div>}
                          <div className="text-[10px] text-surface-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</div>
                          {n.type === "form_signature_required" && n.actionUrl && (
                            <button
                              className="mt-2 text-xs font-bold text-white bg-brand-pink-500 hover:bg-brand-pink-600 px-3 py-1.5 rounded-xl transition-colors"
                              onClick={() => navigate(n.actionUrl)}
                            >
                              {ar() ? "توقيع النموذج" : "Sign now"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "share" && (
            <section id="sec-share" className="animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "رابط الإحالة" : "Referral & Share Link"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "شاركي بيلاموندو واكسبي مكافآت" : "Share Belamonda and earn rewards"}</p>
                </div>
              </div>
              <ShareLinkPage />
            </section>
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-surface-200 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] px-2 flex justify-around items-center z-40 shadow-lg supports-[backdrop-filter]:bg-white/85">
        {[
          { key: "overview", label: ar() ? "رئيسية" : "Home", icon: CustomerIcons.home },
          { key: "store", label: ar() ? "العضويات" : "Memberships", icon: CustomerIcons.offers },
          { key: "my-purchases", label: ar() ? "حجوزاتي" : "Bookings", icon: CustomerIcons.wallet },
          { key: "wallet", label: ar() ? "محفظة" : "Wallet", icon: CustomerIcons.card },
          { key: "profile", label: ar() ? "حسابي" : "Profile", icon: CustomerIcons.profile },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 min-w-0 transition-colors ${activeTab === tab.key ? "text-brand-pink-500" : "text-surface-400"}`}
          >
            {tab.icon}
            <span className="text-[9px] sm:text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Package Checkout Modal */}
      {selectedPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-slide-up relative">
            <button className="absolute top-6 right-6 text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedPkg(null)}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-black text-surface-900 mb-6">{ar() ? "تأكيد العضوية" : "Confirm Membership"}</h3>
            
            <div className="bg-white p-5 rounded-2xl border border-surface-200 mb-8 shadow-sm">
               <div className="font-bold text-surface-900 text-[15px]">{selectedPkg.title}</div>
               <div className="text-brand-pink-500 font-black text-xl mt-1.5">{selectedPkg.price}</div>
            </div>

            {selectedPkg.category === "laser" && (
               <div className="mb-6">
                  <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "اختر العيادة (مخصصة لهذا العرض)" : "Select Clinic (Restricted to this offer)"}</label>
                  <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedClinic} onChange={e => setSelectedClinic(e.target.value)}>
                     <option value="" disabled>{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                     {(clinicsPublic?.items || []).map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
                  </select>
                  <p className="text-[10px] text-brand-pink-500 mt-2 font-medium">{ar() ? "ملاحظة: تغيير العيادة لاحقاً يتطلب دفع رسوم إدارية بقيمة 10 د.ك" : "Note: Changing the clinic later requires a 10 KD administrative fee."}</p>
                  
                  <label className="flex items-center gap-3 mt-4 p-3 bg-brand-pink-50 rounded-xl cursor-pointer">
                     <input type="checkbox" checked={bookFirstSession} onChange={e => setBookFirstSession(e.target.checked)} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300 rounded" />
                     <span className="font-bold text-surface-900 text-sm">{ar() ? "حجز الجلسة الأولى فوراً" : "Book first session immediately"}</span>
                  </label>
               </div>
            )}

            {selectedPkg.category !== "laser" && (
               <div className="mb-6 space-y-4">
                  <div>
                     <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "اختر الخدمة لحجز الموعد الأول (اختياري)" : "Select First Session (Optional)"}</label>
                     <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedFirstSession} onChange={e => setSelectedFirstSession(e.target.value)}>
                        <option value="">{ar() ? "-- حجز لاحقاً --" : "-- Book Later --"}</option>
                        {allTreatments.filter(t => t.category !== "laser" && t.category !== "dental").map(t => (
                           <option key={t.id} value={t.id}>{ar() ? t.nameAr : t.nameEn}</option>
                        ))}
                     </select>
                  </div>
                  {selectedFirstSession && (
                     <div className="animate-fade-in">
                        <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "العيادة المفضلة" : "Preferred Clinic"}</label>
                        <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedFirstClinic} onChange={e => setSelectedFirstClinic(e.target.value)}>
                           <option value="" disabled>{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                           {(clinicsPublic?.items || []).filter(c => allTreatments.find(t => t.id === selectedFirstSession)?.clinicIds.includes(c.id) || allTreatments.find(t => t.id === selectedFirstSession)?.clinicIds.length === 0).map(c => (
                              <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
                           ))}
                        </select>
                     </div>
                  )}
               </div>
            )}

            <div className="space-y-3 mb-8 hidden">
               <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "خيارات الدفع" : "Payment Options"}</label>
               
               {selectedPkg.allowFullPayment && (
                  <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${paymentOption === "full" ? "border-brand-pink-200 bg-brand-pink-50/30" : "border-surface-200 hover:bg-surface-50"}`}>
                     <input type="radio" name="payOpt" checked={paymentOption === "full"} onChange={() => setPaymentOption("full")} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300" />
                     <span className="font-bold text-surface-900 text-sm">{ar() ? "دفع كامل" : "Full Payment"}</span>
                  </label>
               )}

               {selectedPkg.allowInstallments && (
                  <label className={`flex items-center justify-between p-4 border rounded-2xl cursor-pointer transition-colors ${paymentOption === "installments" ? "border-brand-pink-200 bg-brand-pink-50/30" : "border-surface-200 hover:bg-surface-50"}`}>
                     <div className="flex items-center gap-4">
                        <input type="radio" name="payOpt" checked={paymentOption === "installments"} onChange={() => setPaymentOption("installments")} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300" />
                        <span className="font-bold text-surface-900 text-sm">{ar() ? "دفع بالأقساط" : "Pay in Installments"}</span>
                     </div>
                     {paymentOption === "installments" && (
                        <select className="bg-white border border-brand-pink-300 text-surface-700 text-sm rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-pink-400/50 min-w-[110px]" value={installments} onChange={e => setInstallments(Number(e.target.value))}>
                           {[...Array((selectedPkg.maxInstallments || 2) - 1)].map((_, i) => (
                              <option key={i} value={i + 2}>{i + 2} {ar() ? "دفعات" : "Payments"}</option>
                           ))}
                        </select>
                     )}
                  </label>
               )}

               {selectedPkg.allowDeposit && (
                  <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${paymentOption === "deposit" ? "border-brand-pink-200 bg-brand-pink-50/30" : "border-surface-200 hover:bg-surface-50"}`}>
                     <input type="radio" name="payOpt" checked={paymentOption === "deposit"} onChange={() => setPaymentOption("deposit")} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300" />
                     <span className="font-bold text-surface-900 text-sm">{ar() ? `دفع عربون مقدم (${selectedPkg.depositAmount} KWD)` : `Pay Deposit Upfront (${selectedPkg.depositAmount} KWD)`}</span>
                  </label>
               )}
            </div>

            <button
              className="bg-brand-pink-400 hover:bg-brand-pink-500 text-white font-bold w-full rounded-2xl py-3.5 transition-colors shadow-sm"
              onClick={() => {
                setCheckoutPkg(selectedPkg);
                setSelectedPkg(null);
              }}
            >
               {ar() ? "متابعة للدفع" : "Continue to Payment"}
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
            <button className="absolute top-4 right-4 text-surface-400 hover:text-surface-900" onClick={() => setShowBookingModal(null)}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "حجز جلستك" : "Book Your Session"}</h3>
            <p className="text-sm text-surface-500 mb-6">{ar() ? "راجع تفاصيل الحجز واختر العيادة المفضلة لتأكيد الموعد." : "Review your booking details and select your preferred clinic to confirm."}</p>
            
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 mb-5 space-y-3">
               <div className="text-xs text-surface-500 mb-1">{ar() ? "الخدمة / الباقة المختارة" : "Selected Service / Package"}</div>
               <div className="font-bold text-surface-900">{showBookingModal.treatmentName || showBookingModal.offerName || showBookingModal.offerId || "Booking"}</div>
               {(() => {
                 const gross = parseFloat(showBookingModal.priceKwd || "0") || (parseFloat(showBookingModal.finalPrice || "0") + parseFloat(showBookingModal.cashbackKwd || "0"));
                 const cb = parseFloat(showBookingModal.cashbackKwd || "0");
                 const pay = Math.max(0, gross - cb);
                 return gross > 0 ? (
                   <div className="rounded-xl border border-surface-200 bg-white p-3 space-y-1.5 text-xs">
                     <div className="flex justify-between"><span className="text-surface-500">{ar() ? "سعر الجلسة" : "Session price"}</span><span className="font-bold">{gross.toFixed(3)} KWD</span></div>
                     {cb > 0 && <div className="flex justify-between"><span className="text-surface-500">{ar() ? "كاش باك" : "Cashback"}</span><span className="font-bold text-amber-700">− {cb.toFixed(3)} KWD</span></div>}
                     <div className="flex justify-between border-t border-surface-100 pt-1.5"><span className="font-semibold text-emerald-800">{ar() ? "تدفعين في العيادة" : "You pay at clinic"}</span><span className="font-black text-emerald-800">{pay.toFixed(3)} KWD</span></div>
                   </div>
                 ) : null;
               })()}
               {showBookingModal.method === "Standalone" && (
                 <div className="text-xs text-brand-pink-500 font-bold mt-1">{ar() ? "جلسة مفردة — الدفع في العيادة" : "Single Session — Pay at Clinic"}</div>
               )}
            </div>

            <div className="space-y-4 mb-6">
               <div>
                  <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "العيادة المفضلة" : "Preferred Clinic"}</label>
                  {(() => {
                     const baseOffer = homeCatalogData?.items?.find((o: any) => o.id === showBookingModal.offerId) || showBookingModal;
                     const renderClinicOptions = () => {
                        const allowed = showBookingModal.standaloneClinicIds;
                        const pool =
                           Array.isArray(allowed) && allowed.length > 0
                              ? (clinicsPublic?.items || []).filter((c: any) => allowed.includes(c.id))
                              : (clinicsPublic?.items || []);
                        const clinicOptionsPool = pool.length > 0 ? pool : (clinicsPublic?.items || []);
                        return clinicOptionsPool.map((c: any) => {
                           const override = baseOffer?.clinicOverrides?.find((b: any) => b.clinicId === c.id);
                           const feeText = override && parseFloat(override.sessionPriceKwd) > 0 
                              ? (ar() ? ` (+${override.sessionPriceKwd} د.ك للجلسة)` : ` (+${override.sessionPriceKwd} KWD/session)`) 
                              : "";
                           return <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}{feeText}</option>;
                        });
                     };
                     return showBookingModal.category === "laser" && showBookingModal.clinicId ? (
                        <select className="select-field w-full bg-surface-50 opacity-80" disabled value={showBookingModal.clinicId}>
                           {renderClinicOptions()}
                        </select>
                     ) : (
                        <select
                           className="select-field w-full bg-surface-50"
                           id="bookingClinicSelect"
                           value={showBookingModal.clinicId || ""}
                           onChange={(e) => {
                             const newClinicId = e.target.value;
                             const t = dynamicTreatments?.find((dt: any) => dt.id === showBookingModal.treatmentId);
                             if (t) {
                               const offeringsBy = (t.offeringsByClinic || {}) as Record<string, { priceKwd: number; cashbackKwd: number }>;
                               const clinicOffering = offeringsBy[newClinicId];
                               const newBasePrice = clinicOffering?.priceKwd ?? t.priceKwd;
                               const actualDiscountPct = showBookingModal.discountPct || 0;
                               const discountAmt = actualDiscountPct > 0 ? +(newBasePrice * actualDiscountPct / 100).toFixed(3) : 0;
                               const newFinalPrice = +(newBasePrice - discountAmt).toFixed(3);
                               
                               setShowBookingModal({
                                 ...showBookingModal,
                                 clinicId: newClinicId,
                                 priceKwd: newBasePrice,
                                 finalPrice: newFinalPrice
                               });
                             } else {
                               setShowBookingModal({
                                 ...showBookingModal,
                                 clinicId: newClinicId
                               });
                             }
                           }}
                        >
                           {renderClinicOptions()}
                        </select>
                     );
                  })()}
                  {showBookingModal.category === "laser" && showBookingModal.clinicId && (
                     <p className="text-[10px] text-brand-pink-500 mt-1">{ar() ? "ملاحظة: هذا العرض مخصص لعيادة واحدة. لتغيير العيادة يجب دفع الرسوم." : "Note: This offer is restricted to the selected clinic. To change, you must pay the fee."}</p>
                  )}
               </div>

               {/* Cashback Usage Option */}
               {(() => {
                  const relatedOffer = showBookingModal.applicableCashbackOfferId ? offers.find(o => o.id === showBookingModal.applicableCashbackOfferId) : null;
                  if (relatedOffer && parseFloat(relatedOffer.cashbackBalanceKwd || '0') > 0) {
                     const available = parseFloat(relatedOffer.cashbackBalanceKwd || '0');
                     const cost = showBookingModal.finalPrice;
                     const applied = Math.min(available, cost);
                     const remaining = cost - applied;
                     return (
                        <div className="bg-brand-pink-50 border border-brand-pink-200 rounded-2xl p-4 mt-4">
                           <div className="font-bold text-brand-pink-800 text-sm mb-1">{ar() ? "استخدام رصيد الباقة" : "Package Cashback Applied"}</div>
                           {available >= cost ? (
                              <p className="text-xs text-brand-pink-600 leading-relaxed font-medium">
                                 {ar() ? `رصيدك في العرض يغطي بالكامل قيمة هذه الجلسة (${cost} د.ك). لن يتم خصم أي مبالغ إضافية.` : `Your offer's cashback fully covers this session (${cost} KWD). You don't need to pay anything extra.`}
                              </p>
                           ) : (
                              <p className="text-xs text-brand-pink-600 leading-relaxed font-medium">
                                 {ar() ? `رصيدك في العرض يغطي جزءاً من الجلسة (${applied} د.ك). سيتوجب عليك دفع المبلغ المتبقي (${remaining} د.ك) في العيادة.` : `Your offer's cashback partially covers this session (${applied} KWD). You must pay the remaining ${remaining} KWD at the clinic.`}
                              </p>
                           )}
                        </div>
                     );
                  }
                  
                  const isMembershipBooking = !!showBookingModal.userOfferId;
                  if (isMembershipBooking) return null;
                  return wallet && parseFloat(wallet.unlockedBalance || "0") > 0 ? (
                     <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 mt-4">
                        <input type="checkbox" className="mt-1 w-4 h-4 text-emerald-500 rounded border-emerald-300 focus:ring-emerald-400" id="useCashbackModal" />
                        <div>
                           <label htmlFor="useCashbackModal" className="font-bold text-emerald-800 text-sm cursor-pointer">{ar() ? "استخدام الكاش باك المتاح من المحفظة العامة" : "Use Available General Cashback"}</label>
                           <p className="text-xs text-emerald-600 mt-0.5">{ar() ? `لديك ${parseFloat(wallet.unlockedBalance).toFixed(3)} د.ك متاحة كخصم` : `You have ${parseFloat(wallet.unlockedBalance).toFixed(3)} KWD available for discount`}</p>
                        </div>
                     </div>
                  ) : null;
               })()}
            </div>

            <button className="btn-primary w-full shadow-md" onClick={async () => {
               const offer = showBookingModal;
               try {
                 // BUG FIX: Use the real MongoDB UserOffer _id (offer.userOfferId) for
                 // membership-based bookings. Only fall back to offer.id for true
                 // standalone bookings (temp_ prefix). Sending a temp_ id to the server
                 // resulted in USER_OFFER_NOT_FOUND (404).
                 const isStandaloneBooking = !offer.userOfferId && (offer.id?.startsWith("temp_") || offer.method === "Standalone");
                 const resolvedUserOfferId = offer.userOfferId || offer.id;

                 const selectedClinicId = (document.getElementById('bookingClinicSelect') as HTMLSelectElement)?.value 
                   || offer.clinicId 
                   || clinicsPublic?.items?.[0]?.id;

                 const normalizedTreatmentId = (() => {
                   if (offer.treatmentId) return String(offer.treatmentId);
                   if (typeof offer.id === "string" && offer.id.startsWith("temp_")) return offer.id.replace("temp_", "");
                   if (typeof offer.id === "string") return offer.id;
                   return "";
                 })();
                 const matchedStandalone = standaloneSessions.find(
                   (s: any) =>
                     (String(s.sessionTypeId || s.id) === normalizedTreatmentId) &&
                     String(s.clinicId) === String(selectedClinicId)
                 );
                 const resolvedSchedulingMode =
                   matchedStandalone?.bookingMode ||
                   (offer as any).bookingMode ||
                   "clinic_handles";
                 const standalonePriceKwd =
                   matchedStandalone?.priceKwd != null && matchedStandalone.priceKwd !== ""
                     ? String(matchedStandalone.priceKwd)
                     : Number.isFinite(Number(offer.priceKwd))
                       ? Number(offer.priceKwd).toFixed(3)
                       : String(offer.priceKwd ?? "0.000");

                 await apiFetch("/scheduling/me/request", {
                   method: "POST",
                   headers: getAuthHeader(),
                   body: JSON.stringify({ 
                      userOfferId: resolvedUserOfferId,
                      clinicId: selectedClinicId,
                      isStandalone: isStandaloneBooking,
                      schedulingMode: isStandaloneBooking ? resolvedSchedulingMode : undefined,
                      standaloneName: isStandaloneBooking ? (offer.offerName || offer.offerId || offer.treatmentName) : undefined,
                      standalonePrice: isStandaloneBooking ? standalonePriceKwd : undefined,
                      notes: offer.treatmentName || offer.offerName || undefined,
                      sessionGrossKwd: offer.priceKwd != null ? Number(offer.priceKwd).toFixed(3) : undefined,
                      cashbackAppliedKwd: offer.cashbackKwd != null && Number(offer.cashbackKwd) > 0 ? Number(offer.cashbackKwd).toFixed(3) : undefined
                   })
                 });
                 await refetchMySessions();
                 await refetchMyRequests();
                 setShowBookingModal(null);
                 setSysAlert(ar() ? "✅ تم إرسال طلب الحجز! سيتم التواصل معك لتأكيد الوقت. المبلغ في العيادة يبقى قيد الانتظار حتى وصولك." : "✅ Booking request sent! We'll confirm the time. Payment at the clinic stays pending until you arrive.");
                 setTimeout(() => setSysAlert(null), 6000);
               } catch (e: any) {
                 const msg = e instanceof Error ? e.message : "Error";
                 const friendly: Record<string, string> = {
                   INSTALLMENT_NOT_PAID_FOR_NEXT_SESSION: ar() ? "يجب دفع القسط التالي قبل حجز جلسة جديدة." : "Please pay your next installment before booking another session.",
                 };
                 const data = (e as any)?.data as { forms?: EFormPending[] } | undefined;
                 if (msg === "EFORMS_REQUIRED" && data?.forms?.[0]) {
                   const first = data.forms[0];
                   const resolvedUserOfferId = offer.userOfferId || offer.id;
                   setShowBookingModal(null);
                   navigate(`/forms/fill/${first.formId}?userOfferId=${resolvedUserOfferId}&return=/dashboard`);
                 } else {
                   setSysAlert(friendly[msg] ?? msg);
                 }
                 setTimeout(() => setSysAlert(null), 6000);
               }
            }}>
               {ar() ? "تأكيد الحجز" : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}

      {/* Change Clinic Modal */}
      {showChangeClinicModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative">
             <button className="absolute top-4 right-4 text-surface-400 hover:text-surface-900" onClick={() => setShowChangeClinicModal(null)}>✕</button>
             <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "تغيير العيادة" : "Change Clinic"}</h3>
             <p className="text-sm text-surface-500 mb-6">{ar() ? `تغيير العيادة لهذا العرض يتطلب دفع رسوم إدارية ${showChangeClinicModal.currentFee} د.ك.` : `Changing the clinic for this offer requires a ${showChangeClinicModal.currentFee} KD administrative fee.`}</p>
             
             <div className="mb-6">
                <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "اختر العيادة الجديدة" : "Select New Clinic"}</label>
                <select className="select-field w-full bg-surface-50" value={newClinicSelection} onChange={e => setNewClinicSelection(e.target.value)}>
                   {(clinicsPublic?.items || []).map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
                </select>
             </div>

             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowChangeClinicModal(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
                <button className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold shadow-md hover:bg-brand-pink-600 transition-colors disabled:opacity-50" onClick={async () => {
                   if (!newClinicSelection || newClinicSelection === showChangeClinicModal.clinicId) {
                     setSysAlert(ar() ? "الرجاء اختيار عيادة مختلفة" : "Please select a different clinic.");
                     return;
                   }
                   try {
                     await apiFetch(`/commerce/me/user-offers/${showChangeClinicModal.id}/clinic-change-request`, {
                       method: "POST",
                       headers: getAuthHeader(),
                       body: JSON.stringify({ toClinicId: newClinicSelection }),
                     });
                     invalidateCache("/commerce/me/clinic-change-requests");
                     refetchClinicChanges();
                     setShowChangeClinicModal(null);
                     setSysAlert(ar() ? `تم إرسال طلب تغيير العيادة بنجاح. الرسوم: ${showChangeClinicModal.currentFee} د.ك — سيتم مراجعة طلبك من فريق خدمة العملاء.` : `Clinic change request submitted. Fee: ${showChangeClinicModal.currentFee} KD — your request will be reviewed by our CS team.`);
                     setTimeout(() => setSysAlert(null), 7000);
                   } catch (e: any) {
                     const msg = e?.message || "Error";
                     if (msg.includes("ALREADY_PENDING")) {
                       setSysAlert(ar() ? "لديك طلب تغيير عيادة قيد المراجعة بالفعل." : "You already have a pending clinic change request.");
                     } else {
                       setSysAlert(ar() ? `حدث خطأ: ${msg}` : `Error: ${msg}`);
                     }
                     setTimeout(() => setSysAlert(null), 5000);
                   }
                }}>
                   {ar() ? `طلب التغيير (${showChangeClinicModal.currentFee} د.ك)` : `Request Change (${showChangeClinicModal.currentFee} KD)`}
                </button>
             </div>
           </div>
         </div>
      )}

            {/* Clinic Handles Confirmation Prompt */}
      {showClinicHandlesPrompt && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative text-center">
             <div className="w-16 h-16 bg-surface-100 text-surface-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </div>
             <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "تأكيد طلب الموعد" : "Confirm Appointment Request"}</h3>
             <p className="text-sm text-surface-500 mb-6">{ar() ? "هل أنت متأكد من رغبتك في طلب هذا الموعد؟ ستقوم العيادة بالتواصل معك لتحديد الوقت المناسب." : "Are you sure you want to request this appointment? The clinic will contact you to schedule a suitable time."}</p>
             
             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowClinicHandlesPrompt(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
                <button className="flex-1 px-4 py-2 bg-surface-900 text-white rounded-xl font-bold shadow-md hover:bg-surface-800 transition-colors" onClick={() => {
                   setShowClinicHandlesPrompt(null);
                   setSysAlert(ar() ? "✅ تم تسجيل طلبك! ستتواصل معك العيادة قريباً لتحديد موعد جلستك." : "✅ Request received! The clinic will contact you shortly to schedule your session.");
                   setTimeout(() => setSysAlert(null), 7000);
                }}>
                   {ar() ? "تأكيد الطلب" : "Confirm Request"}
                </button>
             </div>
           </div>
         </div>
      )}

      {/* Booking Prompt Modal */}
      {showBookingPromptModal && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative text-center">
             <div className="w-16 h-16 bg-brand-pink-100 text-brand-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </div>
             <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "حجز موعد جديد" : "Book an Appointment"}</h3>
             <p className="text-sm text-surface-500 mb-6">{ar() ? "هل ترغب في حجز موعد لهذه الخدمة الآن؟" : "Would you like to book an appointment for this service now?"}</p>
             
             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowBookingPromptModal(null)}>{ar() ? "لاحقاً" : "Later"}</button>
                <button className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold shadow-md hover:bg-brand-pink-600 transition-colors" onClick={() => {
                   const offerToBook = showBookingPromptModal;
                   setShowBookingPromptModal(null);
                   setShowBookingModal(offerToBook);
                }}>
                   {ar() ? "نعم، احجز الآن" : "Yes, Book Now"}
                </button>
             </div>
           </div>
         </div>
      )}

      {/* New Checkout Modal */}
      {checkoutPkg && (
        <CheckoutModal
          ar={ar()}
          offer={{
            id: checkoutPkg.id || checkoutPkg._id,
            name: checkoutPkg.name || checkoutPkg.title || "Offer",
            category: checkoutPkg.category,
            clinicId: checkoutPkg.clinicId,
            clinicIds: checkoutPkg.clinicIds,
            clinicLocked: checkoutPkg.clinicLocked,
            requireBranchSelection: checkoutPkg.requireBranchSelection,
            membershipType: checkoutPkg.membershipType,
            clinicTransferFeeKwd: checkoutPkg.clinicTransferFeeKwd,
            subscriptionPriceKwd: checkoutPkg.subscriptionPriceKwd || String(checkoutPkg.price || "0.000"),
            validityDays: checkoutPkg.validityDays || 240,
            allowFullPayment: checkoutPkg.allowFullPayment !== false,
            allowInstallments: !!checkoutPkg.allowInstallments,
            maxInstallments: checkoutPkg.maxInstallments || 1,
            allowDeposit: !!checkoutPkg.allowDeposit,
            depositAmountKwd: checkoutPkg.depositAmountKwd || checkoutPkg.depositAmount || "0.000",
            cashbackEligible: checkoutPkg.cashbackEligible !== false,
            maxCashbackPerPurchaseKwd: checkoutPkg.maxCashbackPerPurchaseKwd ?? null
          }}
          inviteCode={pendingInviteCode}
          onClose={() => { setCheckoutPkg(null); setPendingInviteCode(null); }}
          onComplete={async () => {
            setCheckoutPkg(null);
            setPendingInviteCode(null);
            await refetchMyOffers();
            setActiveTab("my-offers");
            setSysAlert(ar() ? "تم بنجاح! راجع 'عروضي'." : "Done! Check 'My Offers'.");
            setTimeout(() => setSysAlert(null), 5000);
          }}
        />
      )}

      {/* System Alerts */}
      {sysAlert && (
         <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-emerald-50 border-2 border-emerald-500 text-emerald-800 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-down max-w-lg w-[calc(100%-2rem)]">
            <div className="bg-emerald-500 text-white p-1 rounded-full shrink-0">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <span className="font-bold text-sm leading-relaxed">{sysAlert}</span>
         </div>
      )}
    </div>
  );
}
