import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../app/AuthContext";
import { useWallet, useMyOffers, useNotifications, useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { BelamondaIcon } from "../../components/BelamondaLogo";
import { treatmentCategories, allTreatments, clinics } from "../../lib/treatments";

const ar = () => i18n.language === "ar";

const CustomerIcons = {
  home: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  offers: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
  wallet: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  profile: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
};

// ==========================================
// Purchase Modal Component
// ==========================================
function PurchaseModal({ pkg, onClose }: { pkg: any; onClose: () => void }) {
  const [paymentOption, setPaymentOption] = useState(() => {
    if (pkg.allowFullPayment) return "full";
    if (pkg.allowInstallments) return "installments";
    if (pkg.allowDeposit) return "deposit";
    return "full";
  });

  const priceNum = parseInt(pkg.price);
  const isInstallment = pkg.allowInstallments && pkg.maxInstallments;
  const installmentAmount = isInstallment ? priceNum / pkg.maxInstallments : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-md animate-fade-in">
       <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
         <div className="p-6 border-b border-surface-100 flex justify-between items-center bg-surface-50">
            <div>
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "تأكيد الاشتراك" : "Confirm Subscription"}</h3>
              <div className="text-sm font-medium text-brand-pink-500 mt-1">{pkg.title}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors">✕</button>
         </div>
         <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            
            <div>
               <h4 className="font-bold text-surface-900 mb-4">{ar() ? "اختر طريقة الدفع" : "Select Payment Method"}</h4>
               <div className="space-y-3">
                 
                 {/* FULL PAYMENT */}
                 {pkg.allowFullPayment && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'full' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="full" checked={paymentOption === 'full'} onChange={() => setPaymentOption('full')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "دفع كامل" : "Full Payment"}</div>
                        <div className="text-sm text-surface-500">{ar() ? "ادفع المبلغ كاملاً الآن" : "Pay the full amount now"}</div>
                      </div>
                      <div className="font-black text-brand-pink-600">{pkg.price}</div>
                   </label>
                 )}

                 {/* INSTALLMENTS */}
                 {pkg.allowInstallments && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'installments' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="installments" checked={paymentOption === 'installments'} onChange={() => setPaymentOption('installments')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "الدفع بالأقساط المرنة" : "Flexible Installments"}</div>
                        <div className="text-xs text-surface-500 mt-1">{ar() ? `ادفع على ${pkg.maxInstallments} جلسات والجلسات اللاحقة مجانية بالكامل (غير محدودة)` : `Pay 25% for the first ${pkg.maxInstallments} sessions, rest are infinite & free`}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{installmentAmount} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "/ للجلسة الواحدة" : "/ per session"}</div>
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
                         <div className="font-black text-brand-pink-600">{pkg.depositAmount} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "عربون" : "Deposit"}</div>
                      </div>
                   </label>
                 )}
               </div>
            </div>

         </div>
         <div className="p-6 border-t border-surface-100 bg-surface-50 flex gap-3">
            <button className="btn-primary flex-1 py-3.5 text-base font-bold shadow-brand-pink-500/30 shadow-lg hover:scale-[1.02] transition-transform" onClick={() => { alert(ar() ? "تم الاشتراك بنجاح!" : "Subscribed successfully!"); onClose(); }}>{ar() ? "تأكيد ودفع" : "Confirm & Pay"}</button>
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
  const [form, setForm] = useState({
    civilId: "",
    terms1: false,
    terms2: false,
    terms3: false,
  });

  const submitKyc = async () => {
    if (!form.terms1 || !form.terms2 || !form.terms3) return alert(ar() ? "يرجى الموافقة على جميع الشروط" : "Please agree to all terms");
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
      alert(e.message);
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

            <div className="bg-surface-100 rounded-2xl h-32 border border-surface-300 flex items-center justify-center relative mt-4">
              <span className="text-surface-400 text-sm font-medium">{ar() ? "وقع هنا (محاكاة)" : "Draw Signature (Demo)"}</span>
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

export default function CustomerDashboard() {
  const { t } = useTranslation();
  const { auth, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [showKyc, setShowKyc] = useState(false);
  const [offerFilter, setOfferFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [selectedPkg, setSelectedPkg] = useState<any>(null);

  const { data: walletData, loading: wLoading } = useWallet();
  const { data: offersData } = useMyOffers();
  const { data: notifData } = useNotifications();

  const [selectedClinic, setSelectedClinic] = useState<string>("clinic_qibla");
  const [showChangeClinicModal, setShowChangeClinicModal] = useState<any>(null);
  const [newClinicSelection, setNewClinicSelection] = useState<string>("clinic_qibla");

  const [localOffers, setLocalOffers] = useState<any[]>(() => {
    try { 
       const data = JSON.parse(localStorage.getItem('demo_offers_v4') || '[]');
       return data.map((o: any) => {
          let patched = { ...o };
          if (patched.offerId === "Nuomi Classic" && !patched.maxSessions) patched.maxSessions = 6;
          if (patched.offerId === "Jamali Beauty Program" && patched.cashbackBalance === undefined) { patched.cashbackBalance = 1500; patched.isCashbackOnly = true; }
          if (patched.offerId === "Mini Jamali" && patched.cashbackBalance === undefined) { patched.cashbackBalance = 500; patched.isCashbackOnly = true; }
          if (patched.offerId === "Sabaya Membership" && patched.cashbackBalance === undefined) patched.cashbackBalance = 300;
          return patched;
       });
    } catch { return []; }
  });

  const [localBookings, setLocalBookings] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('demo_pending_bookings_v4') || '[]'); } catch { return []; }
  });

  const [localLedger, setLocalLedger] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('bel_financial_ledger_v1') || '[]'); } catch { return []; }
  });

  const [localClinicChanges, setLocalClinicChanges] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('bel_clinic_change_requests_v1') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const sync = () => {
       try { 
          const data = JSON.parse(localStorage.getItem('demo_offers_v4') || '[]');
          setLocalOffers(data.map((o: any) => {
             let patched = { ...o };
             if (patched.offerId === "Nuomi Classic" && !patched.maxSessions) patched.maxSessions = 6;
             if (patched.offerId === "Jamali Beauty Program" && patched.cashbackBalance === undefined) { patched.cashbackBalance = 1500; patched.isCashbackOnly = true; }
             if (patched.offerId === "Mini Jamali" && patched.cashbackBalance === undefined) { patched.cashbackBalance = 500; patched.isCashbackOnly = true; }
             if (patched.offerId === "Sabaya Membership" && patched.cashbackBalance === undefined) patched.cashbackBalance = 300;
             return patched;
          }));
          const bookings = JSON.parse(localStorage.getItem('demo_pending_bookings_v4') || '[]');
          setLocalBookings(bookings);
          const ledger = JSON.parse(localStorage.getItem('bel_financial_ledger_v1') || '[]');
          setLocalLedger(ledger);
          const changes = JSON.parse(localStorage.getItem('bel_clinic_change_requests_v1') || '[]');
          setLocalClinicChanges(changes);
       } catch {}
    };
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 1000); // Polling for same-window syncing
    return () => { window.removeEventListener('storage', sync); clearInterval(interval); };
  }, []);

  const saveOffers = (newOffers: any[]) => {
    setLocalOffers(newOffers);
    localStorage.setItem('demo_offers_v4', JSON.stringify(newOffers));
  };
  const [sysAlert, setSysAlert] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState<any>(null);
  const [showBookingPromptModal, setShowBookingPromptModal] = useState<any>(null);
  const [paymentOption, setPaymentOption] = useState("full");
  const [installments, setInstallments] = useState(2);
  const [bookFirstSession, setBookFirstSession] = useState(true);
  const [selectedFirstSession, setSelectedFirstSession] = useState<string>("");
  const [selectedFirstClinic, setSelectedFirstClinic] = useState<string>("");

  useEffect(() => {
     if (selectedPkg) {
        setBookFirstSession(true);
        setSelectedFirstSession("");
        setSelectedFirstClinic("");
     }
  }, [selectedPkg]);

  const [kycStatus, setKycStatus] = useState<string>("checking");
  const { getAuthHeader } = useAuth();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    username: auth?.userId || "",
    name: auth?.userId === "cust1" ? "Aisha Al-Mulla" : auth?.userId || "",
    phone: "+965 99123456",
    email: "aisha@example.com"
  });

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

  if (showKyc) {
    return <KycVerificationPage onComplete={() => setShowKyc(false)} onCancel={() => setShowKyc(false)} />;
  }

  const wallet = walletData?.wallet;
  const offers = [...(offersData?.items || []), ...localOffers];
  const unreadNotifs = (notifData?.inbox || []).filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-surface-50 pb-20 lg:pb-0 flex flex-col lg:flex-row">
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-white px-5 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-sm">
            {auth?.userId?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-surface-500">{ar() ? "مرحباً،" : "Hello,"}</div>
            <div className="text-sm font-bold text-surface-900 leading-tight">{auth?.userId}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => i18n.changeLanguage(ar() ? "en" : "ar")} className="text-sm font-medium text-brand-pink-500">
            {ar() ? "EN" : "ع"}
          </button>
          <div className="relative p-1">
            <svg className="w-6 h-6 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadNotifs > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />}
          </div>
        </div>
      </header>

      {/* Desktop Sidebar (Optional, but kept minimal to feel like an app menu) */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-surface-200 flex-col sticky top-0 h-screen z-30">
        <div className="p-6 pb-2 border-b border-surface-100 flex items-center gap-3">
          <BelamondaIcon size={32} />
          <span className="text-xl font-bold text-surface-900 tracking-tight">Belamonda</span>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-lg">
              {auth?.userId?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-surface-900">{auth?.userId}</div>
              <div className="text-xs text-surface-500">{ar() ? "عضو" : "Member"}</div>
            </div>
          </div>
          <nav className="space-y-2">
            {[
              { key: "home", label: t("home"), icon: CustomerIcons.home },
              { key: "offers", label: t("offers"), icon: CustomerIcons.offers },
              { key: "history", label: ar() ? "السجل" : "History", icon: CustomerIcons.wallet },
              { key: "profile", label: t("profile"), icon: CustomerIcons.profile },
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

      {/* Main App Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto lg:max-w-none lg:p-8 animate-fade-in relative">
        
        {/* Verification Banner */}
        {kycStatus === "unverified" && (
          <div className="m-4 lg:m-0 lg:mb-8 bg-brand-gradient rounded-2xl p-5 shadow-glow relative overflow-hidden text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-slide-up">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm hidden md:block">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-bold">{ar() ? "استكمال الملف الشخصي والتوثيق" : "Action Required: Profile & Verification"}</h2>
                <p className="text-sm text-white/90 mt-1 max-w-md">{ar() ? "للبدء في شراء العروض وتفعيل الكاش باك، يرجى تحديث بياناتك وإتمام التحقق الرقمي." : "To start purchasing offers and using cashback, please update your details and complete digital verification."}</p>
              </div>
            </div>
            <button className="relative z-10 bg-white text-brand-pink-600 font-bold px-6 py-2.5 rounded-xl shadow-sm hover:scale-105 transition-transform whitespace-nowrap" onClick={() => setActiveTab("profile")}>
              {ar() ? "تحديث الآن" : "Update Profile"}
            </button>
          </div>
        )}

        {kycStatus === "pending" && (
          <div className="m-4 lg:m-0 lg:mb-8 bg-blue-50 border border-blue-200 rounded-2xl p-5 text-blue-800">
            <div className="font-bold flex items-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {ar() ? "التحقق قيد المراجعة" : "Verification Under Review"}
            </div>
            <div className="text-sm text-blue-600 mt-1">{ar() ? "يرجى الانتظار لحين اعتماد بياناتك من الإدارة." : "Please wait while management approves your KYC submission."}</div>
          </div>
        )}

        {/* Content based on tab */}
        <div className="p-4 lg:p-0">
          {activeTab === "home" && (
            <div className="space-y-8">
              {/* Wallet Hero Card */}
              {(() => {
                const totalCashback = localOffers.filter(o => o.status === 'active' && o.cashbackBalance > 0).reduce((sum, o) => sum + (o.cashbackBalance || 0), 0);
                const walletBalance = parseFloat(wallet?.unlockedBalance || "0") + totalCashback;
                return (
              <div className="wallet-card shadow-glow-lg">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-white/80 text-sm">{ar() ? "الرصيد المتاح (كاش باك)" : "Available Cashback"}</div>
                    <div className="text-4xl font-bold mt-1 text-white">{walletBalance.toFixed(3)} <span className="text-xl opacity-80">KWD</span></div>
                  </div>
                  <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-md">
                    {wallet || totalCashback > 0 ? (ar() ? "محفظة نشطة" : "Active Wallet") : (ar() ? "غير نشط" : "Inactive")}
                  </div>
                </div>
                {(wallet || totalCashback > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-white/80 mb-2">
                      <span>{ar() ? "من الباقات:" : "From Offers:"} {totalCashback.toFixed(3)}</span>
                      <span>{ar() ? "من المحفظة:" : "From Wallet:"} {parseFloat(wallet?.unlockedBalance || "0").toFixed(3)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(walletBalance > 0 ? 100 : 0, 100)}%` }} />
                    </div>
                  </>
                )}
              </div>
                );
              })()}

              {/* Active Subscriptions/Offers */}
              <div>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-lg font-bold text-surface-900">{ar() ? "عروضي النشطة" : "Active Subscriptions"}</h3>
                  <button onClick={() => setActiveTab("offers")} className="text-sm font-medium text-brand-pink-500 hover:text-brand-pink-600 flex items-center gap-1">
                    {ar() ? "تصفح باقاتنا" : "Browse Memberships"} <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                {(() => {
                  const activeOffers = offers.filter(o => !(o.maxSessions && o.sessionsUsed >= o.maxSessions));
                  return activeOffers.length === 0 ? (
                    <div className="bg-white border border-surface-200 border-dashed rounded-2xl p-8 text-center text-surface-500 flex flex-col items-center justify-center">
                      <span className="text-4xl block mb-3">✨</span>
                      <p className="mb-4 text-surface-600 font-medium">{ar() ? "ليس لديك أي عروض نشطة حالياً" : "You don't have any active offers yet"}</p>
                      <button onClick={() => setActiveTab("offers")} className="btn-primary px-6 py-2 shadow-sm hover:scale-105 transition-transform">
                         {ar() ? "تصفح باقاتنا والعضويات" : "Browse Memberships & Offers"}
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {activeOffers.map(o => (
                        <div key={o.id} className={`card-elevated p-5 border-l-4 ${o.status === 'pending payment' ? 'border-l-amber-400' : 'border-l-brand-pink-400'}`}>
                          <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-surface-900 text-lg">{o.offerId || "Special Package"}</h4>
                            <p className="text-xs text-surface-400 mt-1">Status: <span className={`font-bold uppercase ${o.status === 'pending payment' ? 'text-amber-500' : 'text-emerald-600'}`}>{o.status}</span></p>
                            {o.method === "Installments" && (
                               <p className="text-[10px] text-brand-pink-500 font-bold mt-1 uppercase">Paid: {o.paidInstallments} / {o.totalInstallments}</p>
                            )}
                          </div>
                          <div className="bg-surface-50 px-3 py-2 rounded-xl text-center shrink-0">
                            <div className="text-[10px] text-surface-500 uppercase font-bold tracking-wider">{ar() ? "جلسات" : "Sessions"}</div>
                            <div className="font-black text-surface-900 text-lg leading-none mt-1">
                              {o.maxSessions ? `${o.sessionsUsed || 0} / ${o.maxSessions}` : (o.sessionsUsed || 0)}
                            </div>
                            {o.maxSessions && (
                              <div className="w-full bg-surface-200 rounded-full h-1 mt-1.5">
                                <div className="bg-brand-pink-400 h-1 rounded-full transition-all" style={{ width: `${Math.min(((o.sessionsUsed || 0) / o.maxSessions) * 100, 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                        {o.category === "laser" && o.clinicId && (
                           <div className="mt-3 text-xs bg-surface-50 border border-surface-200 rounded-lg p-2 flex items-center justify-between">
                              <span className="text-surface-600 font-medium">{ar() ? "العيادة المحددة:" : "Assigned Clinic:"} <span className="font-bold text-brand-pink-600">{clinics.find(c => c.id === o.clinicId)?.nameEn || o.clinicId}</span></span>
                              <button onClick={() => {
                                 const changesCount = localClinicChanges.filter(req => req.subscriptionId === o.id).length;
                                 const fee = (changesCount + 1) * 10;
                                 setShowChangeClinicModal({ ...o, currentFee: fee });
                              }} className="text-[10px] font-bold text-surface-500 hover:text-brand-pink-500 underline">{ar() ? `تغيير العيادة (${(localClinicChanges.filter(req => req.subscriptionId === o.id).length + 1) * 10} د.ك)` : `Change Clinic (${(localClinicChanges.filter(req => req.subscriptionId === o.id).length + 1) * 10} KD)`}</button>
                           </div>
                        )}
                        {o.isCashbackOnly ? (
                          <div className="mt-4 w-full text-center py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                            <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              {ar() ? "كاش باك فقط — لا يتطلب حجز موعد" : "Cashback Only — No Appointment Needed"}
                            </div>
                            {o.cashbackBalance > 0 && (
                              <div className="text-xs text-emerald-600 mt-1 font-medium">{ar() ? `رصيد الكاش باك: ${o.cashbackBalance} د.ك` : `Cashback Balance: ${o.cashbackBalance} KWD`}</div>
                            )}
                          </div>
                        ) : (
                        <button 
                          className={`mt-4 w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${o.status === 'pending payment' ? 'bg-surface-100 text-surface-400 cursor-not-allowed' : 'bg-surface-900 text-white hover:bg-surface-800 shadow-md hover:shadow-lg hover:-translate-y-0.5'}`} 
                          onClick={() => setShowBookingModal(o)}
                          disabled={o.status === 'pending payment'}
                        >
                          {o.status === 'pending payment' && (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          )}
                          {ar() ? "حجز موعد" : "Book Appointment"}
                        </button>
                        )}
                      </div>
                    ))}
                  </div>
                )})()}
              </div>

              {/* ── Book a Session ── */}
              <div className="mt-10">
                 <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-brand-pink-50 flex items-center justify-center text-brand-pink-500 shrink-0">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-surface-900">{ar() ? "حجز جلسة / خدمة جديدة" : "Book a Session"}</h3>
                       <p className="text-sm text-surface-500 mt-1">{ar() ? "تصفح جميع الخدمات المتاحة واحجز موعدك بسهولة" : "Browse all available services and book your appointment easily"}</p>
                    </div>
                 </div>

                 {/* Session Categories Filter */}
                 <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-4">
                    <button
                      onClick={() => setSessionFilter("all")}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap font-medium transition-all ${sessionFilter === "all" ? "bg-surface-900 text-white shadow-md scale-105" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                    >
                      ✨ {ar() ? "الكل" : "All"}
                    </button>
                    {treatmentCategories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSessionFilter(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap font-medium transition-all ${sessionFilter === cat.id ? "bg-brand-pink-500 text-white shadow-md scale-105" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                      >
                        <span>{cat.icon}</span>
                        <span>{ar() ? cat.nameAr : cat.nameEn}</span>
                      </button>
                    ))}
                 </div>

                 {/* Sessions Grid */}
                 <div className="grid gap-5 md:grid-cols-2">
                    {allTreatments.filter(t => sessionFilter === "all" || t.category === sessionFilter).map((t) => {
                       const activeOffers = localOffers.filter(o => o.status === 'active');
                       const applicableCashbackOffer = activeOffers.find(o => {
                          if (!o.cashbackBalance || o.cashbackBalance <= 0) return false;
                          if (o.category === "all") return true;
                          if (o.category) return o.category.split(',').includes(t.category);
                          return false;
                       });
                       const hasMembership = !!applicableCashbackOffer;
                       const actualDiscountPct = hasMembership ? t.discountPct : 0;
                       const actualCashbackKwd = hasMembership ? t.cashbackKwd : 0;

                       const discountAmt = actualDiscountPct > 0 ? +(t.priceKwd * actualDiscountPct / 100).toFixed(3) : 0;
                       const finalPrice = +(t.priceKwd - discountAmt).toFixed(3);
                       const availableClinics = clinics.filter(c => t.clinicIds.includes(c.id));
                       
                       return (
                       <div key={t.id} className={`${hasMembership ? 'bg-brand-pink-50/30 border-brand-pink-300 shadow-brand-pink-500/10' : 'bg-white border-surface-200/80'} rounded-[24px] p-6 relative overflow-hidden shadow-sm hover:shadow-xl hover:border-brand-pink-200/50 hover:-translate-y-1 transition-all duration-300 group flex flex-col`}>
                          {/* Admin-style corner blob hover effect */}
                          <div className={`absolute top-0 right-0 w-32 h-32 ${hasMembership ? 'bg-brand-pink-200/40' : 'bg-brand-pink-50/60'} rounded-bl-[100px] -z-0 group-hover:scale-110 transition-transform duration-500 origin-top-right`} />
                          
                          <div className="relative z-10 flex flex-col flex-1">
                             {/* Row 1: Icon and Category */}
                          <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 bg-brand-pink-50 rounded-[12px] flex items-center justify-center text-xl text-brand-pink-500">
                                  {treatmentCategories.find(c => c.id === t.category)?.icon}
                              </div>
                              <div className="text-[11px] font-bold text-surface-400 uppercase tracking-widest">
                                  {ar() ? treatmentCategories.find(c => c.id === t.category)?.nameAr : treatmentCategories.find(c => c.id === t.category)?.nameEn}
                              </div>
                          </div>

                          {/* Row 2: Title */}
                          <h3 className="text-xl font-extrabold text-surface-900 leading-snug mb-5 tracking-tight">
                              {ar() ? t.nameAr : t.nameEn}
                          </h3>

                          {/* Row 3: Dropdown */}
                          <div className="mb-6">
                              {availableClinics.length > 0 ? (
                                  <div className="relative">
                                      <select className="w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 text-sm text-surface-700 font-medium focus:outline-none focus:ring-2 focus:ring-surface-900 focus:border-surface-900 transition-all appearance-none cursor-pointer pr-10">
                                          {availableClinics.map(cl => <option key={cl.id} value={cl.id}>{ar() ? cl.nameAr : cl.nameEn}</option>)}
                                      </select>
                                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="w-full bg-surface-50 border border-dashed border-surface-300 rounded-xl px-3 py-3 text-sm text-center text-surface-400 italic">
                                      {ar() ? "لا توجد عيادات حالياً" : "No clinics available"}
                                  </div>
                              )}
                          </div>

                          {/* Separator Line */}
                          <hr className="border-surface-100 mb-5" />

                          {/* Row 4: Pricing & Actions */}
                          <div className="mt-auto">
                             <div className="flex justify-between items-center mb-4 min-h-[24px]">
                                {hasMembership && actualDiscountPct > 0 ? (
                                   <>
                                       <span className="text-surface-400 line-through font-bold text-sm">{t.priceKwd} KWD</span>
                                       {actualCashbackKwd > 0 && <span className="text-emerald-500 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-md">+{actualCashbackKwd} KWD Cashback</span>}
                                   </>
                                ) : (
                                   <span className="text-surface-400 font-medium text-xs">{ar() ? "السعر القياسي" : "Standard Price"}</span>
                                )}
                             </div>

                             <div className="flex items-center justify-between">
                                 <div className="flex items-baseline gap-1.5">
                                     <span className="text-[26px] font-black text-surface-900 leading-none">{finalPrice}</span>
                                     <span className="text-[12px] font-bold text-surface-500 uppercase">KWD</span>
                                 </div>
                                 
                                 <button 
                                     className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${availableClinics.length > 0 ? 'bg-surface-900 text-white hover:bg-surface-800 shadow-md hover:shadow-lg hover:-translate-y-0.5' : 'bg-surface-100 text-surface-400 cursor-not-allowed'}`}
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
                                         
                                         const offer = {
                                           id: `temp_${t.id}`,
                                           offerId: ar() ? t.nameAr : t.nameEn,
                                           status: "active",
                                           method: "Standalone",
                                           priceKwd: t.priceKwd,
                                           discountPct: actualDiscountPct,
                                           cashbackKwd: actualCashbackKwd,
                                           finalPrice,
                                           applicableCashbackOfferId: applicableCashbackOffer ? applicableCashbackOffer.id : null
                                         };
                                         setShowBookingModal(offer);
                                     }}
                                 >
                                     {ar() ? "احجز جلستك" : "Book Your Session"}
                                 </button>
                             </div>
                          </div>
                          </div>
                       </div>
                    );})}
                 </div>
              </div>
            </div>
          )}

          {activeTab === "offers" && (
            <div className="animate-fade-in">
              <div className="sticky top-[68px] lg:top-0 z-20 bg-surface-50 pt-2 pb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
                <h2 className="text-xl font-bold text-surface-900 mb-4">{ar() ? "باقات بيلاموندا" : "Belamonda Packages"}</h2>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {[
                    { id: "all", icon: "✨", label: ar() ? "الكل" : "All" },
                    { id: "beauty", icon: "💄", label: ar() ? "تجميل وعناية" : "Beauty & Skincare" },
                    { id: "laser", icon: "⚡", label: ar() ? "ليزر" : "Laser & Hair Removal" },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setOfferFilter(f.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap font-medium transition-all ${offerFilter === f.id ? "bg-surface-900 text-white shadow-md scale-105" : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                    >
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 mt-2 md:grid-cols-2">
                {[
                  { id: "p1", category: "beauty", title: "Jamali Beauty Program", price: "1500 KWD", maxSessions: null, tags: ["1 Year", "Full Network", "1500 KWD Cashback"], image: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800", allowFullPayment: true, allowInstallments: true, maxInstallments: 4, allowDeposit: false, isCashbackOnly: true, signupCashback: 1500 },
                  { id: "p2", category: "beauty", title: "Mini Jamali", price: "500 KWD", maxSessions: null, tags: ["6 Months", "Full Network", "500 KWD Cashback"], image: "https://images.unsplash.com/photo-1616394584738-fc6e612e71c9?auto=format&fit=crop&q=80&w=800", allowFullPayment: true, allowInstallments: false, allowDeposit: false, isCashbackOnly: true, signupCashback: 500 },
                  { id: "p3", category: "beauty", title: "Sabaya Membership", price: "79 KWD", maxSessions: null, tags: ["1 Year", "Up to 3 Friends", "300 KWD Cashback"], image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800", allowFullPayment: false, allowInstallments: false, allowDeposit: true, depositAmount: 20, signupCashback: 300 },
                  { id: "p4", category: "laser", title: "Nuomi Classic", price: "120 KWD", maxSessions: 6, tags: ["8 Months", "6 Free Sessions", "Prepaid"], image: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=800", allowFullPayment: true, allowInstallments: true, maxInstallments: 3, allowDeposit: false },
                  { id: "p5", category: "laser", title: "Nuomi Plus", price: "20 KWD", maxSessions: null, tags: ["20 KWD Cashback per session"], image: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800", allowFullPayment: true, allowInstallments: false, allowDeposit: true, depositAmount: 5 },
                  { id: "p6", category: "laser", title: "Single Session", price: "19 KWD", maxSessions: 1, tags: ["Optional 30 KWD Cashback"], allowFullPayment: true, allowInstallments: false, allowDeposit: false },
                ].filter(pkg => offerFilter === "all" || pkg.category === offerFilter).map((pkg) => (
                  <div key={pkg.id} className="card-elevated p-0 flex flex-col h-full relative overflow-hidden group animate-slide-up bg-white">
                    {pkg.image ? (
                      <div className="h-48 w-full relative overflow-hidden bg-surface-100">
                        <img src={pkg.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={pkg.title} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-4 px-6 w-full">
                           <div className="text-sm font-medium text-brand-pink-400 mb-1 uppercase tracking-wide flex items-center gap-1.5 drop-shadow-md">
                             {pkg.category === "beauty" ? "💄" : "⚡"} {pkg.category === "beauty" ? (ar() ? "تجميل" : "Beauty") : (ar() ? "ليزر" : "Laser")}
                           </div>
                           <h3 className="text-xl font-bold text-white drop-shadow-md leading-tight">{pkg.title}</h3>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 pb-0">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-pink-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform" />
                        <div className="text-sm font-medium text-brand-pink-500 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                          {pkg.category === "beauty" ? "💄" : "⚡"} {pkg.category === "beauty" ? (ar() ? "تجميل" : "Beauty") : (ar() ? "ليزر" : "Laser")}
                        </div>
                        <h3 className="text-lg font-bold text-surface-900 mb-1">{pkg.title}</h3>
                      </div>
                    )}
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="text-2xl font-black text-brand-pink-500 mb-4">{pkg.price}</div>
                      <div className="flex flex-wrap gap-2 mb-6">
                        {pkg.tags.map(t => <span key={t} className="bg-surface-100 text-surface-600 text-[10px] uppercase font-bold px-2 py-1 rounded-md">{t}</span>)}
                      </div>
                      <button className="mt-auto btn-primary w-full shadow-md hover:scale-[1.02] transition-transform" onClick={() => setSelectedPkg(pkg)}>{ar() ? "اشتراك" : "Subscribe"}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-8 animate-fade-in">
              {/* Offers History */}
              <div>
                <h2 className="text-xl font-bold text-surface-900 mb-4">{ar() ? "سجل الباقات المشتراة" : "Offers History"}</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {localOffers.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {localOffers.map(o => (
                        <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-pink-50 text-brand-pink-500 shrink-0">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                              <div className="font-bold text-surface-900 text-sm">{o.offerId || "Package"}</div>
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

              {/* Sessions History */}
              <div>
                <h2 className="text-xl font-bold text-surface-900 mb-4">{ar() ? "سجل الجلسات المحجوزة" : "Sessions History"}</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {localBookings.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {localBookings.map(b => (
                        <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 shrink-0">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                              <div className="font-bold text-surface-900 text-sm">{b.treatment || "Session"}</div>
                              <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة:" : "Clinic:"} <span className="font-semibold text-surface-700">{b.clinic}</span></div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between">
                            <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{ar() ? "بانتظار التأكيد" : "Pending Confirmation"}</div>
                            <div className="text-[10px] text-surface-400 mt-1">{new Date(b.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payments/Wallet History */}
              <div>
                <h2 className="text-xl font-bold text-surface-900 mb-4">{ar() ? "سجل المدفوعات" : "Payment History"}</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {localLedger.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {localLedger.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(txn => (
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
                          <div className="font-bold text-surface-900">
                            {txn.amount} KWD
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold text-surface-900 mb-6">{ar() ? "حسابي" : "My Account"}</h2>
              
              {/* Editable Profile Details */}
              <div className="bg-white rounded-2xl p-5 border border-surface-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-surface-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    {ar() ? "البيانات الشخصية" : "Personal Details"}
                  </h3>
                  {!isEditingProfile ? (
                    <button onClick={() => setIsEditingProfile(true)} className="text-brand-pink-500 text-sm font-medium hover:text-brand-pink-600 bg-brand-pink-50 px-3 py-1.5 rounded-lg transition-colors">{ar() ? "تعديل" : "Edit Profile"}</button>
                  ) : (
                    <button onClick={() => setIsEditingProfile(false)} className="text-emerald-600 text-sm font-medium hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {ar() ? "حفظ" : "Save Changes"}
                    </button>
                  )}
                </div>
                
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "اسم المستخدم (للدخول)" : "Username (For Login)"}</label>
                    {isEditingProfile ? (
                      <input type="text" className="input-field" value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} dir="ltr" />
                    ) : (
                      <div className="font-semibold text-brand-pink-600 text-base font-mono bg-brand-pink-50 inline-block px-3 py-1 rounded-lg">@{profileForm.username}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
                    {isEditingProfile ? (
                      <input type="text" className="input-field" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                    ) : (
                      <div className="font-semibold text-surface-900 text-base">{profileForm.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
                    {isEditingProfile ? (
                      <input type="text" className="input-field" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} dir="ltr" />
                    ) : (
                      <div className="font-semibold text-surface-900 text-base" dir="ltr">{profileForm.phone}</div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
                    {isEditingProfile ? (
                      <input type="email" className="input-field" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} dir="ltr" />
                    ) : (
                      <div className="font-semibold text-surface-900 text-base">{profileForm.email}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* KYC Verification Card */}
              <div className={`rounded-2xl p-6 border flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${kycStatus === 'unverified' ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-surface-200'}`}>
                <div>
                  <div className="text-xs font-medium text-surface-500 mb-1">{ar() ? "حالة التحقق الرقمي (KYC)" : "Digital KYC Verification"}</div>
                  <div className="font-bold text-surface-900 text-lg flex items-center gap-2">
                    {kycStatus === 'approved' ? (
                      <><span className="text-emerald-500">✓</span> {ar() ? "موثق" : "Verified"}</>
                    ) : (
                      <><span className="text-amber-500 animate-pulse">!</span> {ar() ? "غير موثق" : "Unverified"}</>
                    )}
                  </div>
                  {kycStatus === 'unverified' && (
                    <p className="text-xs text-amber-700 mt-2 max-w-sm">{ar() ? "مطلوب لتفعيل عمليات الدفع وشراء الباقات وإدارة الكاش باك." : "Required to enable payments, package purchases, and cashback features."}</p>
                  )}
                </div>
                {kycStatus === 'unverified' && (
                  <button onClick={() => setShowKyc(true)} className="btn-primary shrink-0 shadow-sm">{ar() ? "البدء بالتوثيق" : "Start Verification"}</button>
                )}
              </div>

              <button onClick={logout} className="w-full bg-surface-100 hover:bg-red-50 text-surface-600 hover:text-red-500 font-bold py-3.5 rounded-2xl mt-4 transition-colors">
                {ar() ? "تسجيل الخروج" : "Log Out"}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 w-full bg-white border-t border-surface-200 px-6 py-3 flex justify-between items-center z-40 pb-safe">
        {[
          { key: "home", label: t("home"), icon: CustomerIcons.home },
          { key: "offers", label: t("offers"), icon: CustomerIcons.offers },
          { key: "history", label: ar() ? "السجل" : "History", icon: CustomerIcons.wallet },
          { key: "profile", label: t("profile"), icon: CustomerIcons.profile },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === tab.key ? "text-brand-pink-500" : "text-surface-400"}`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
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
            <h3 className="text-xl font-black text-surface-900 mb-6">{ar() ? "تأكيد الاشتراك" : "Confirm Subscription"}</h3>
            
            <div className="bg-white p-5 rounded-2xl border border-surface-200 mb-8 shadow-sm">
               <div className="font-bold text-surface-900 text-[15px]">{selectedPkg.title}</div>
               <div className="text-brand-pink-500 font-black text-xl mt-1.5">{selectedPkg.price}</div>
            </div>

            {selectedPkg.category === "laser" && (
               <div className="mb-6">
                  <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "اختر العيادة (مخصصة لهذا العرض)" : "Select Clinic (Restricted to this offer)"}</label>
                  <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedClinic} onChange={e => setSelectedClinic(e.target.value)}>
                     {clinics.map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
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
                           {clinics.filter(c => allTreatments.find(t => t.id === selectedFirstSession)?.clinicIds.includes(c.id) || allTreatments.find(t => t.id === selectedFirstSession)?.clinicIds.length === 0).map(c => (
                              <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
                           ))}
                        </select>
                     </div>
                  )}
               </div>
            )}

            <div className="space-y-3 mb-8">
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

            <button className="bg-brand-pink-400 hover:bg-brand-pink-500 text-white font-bold w-full rounded-2xl py-3.5 transition-colors shadow-sm" onClick={() => {
               const existing = localOffers.find(o => o.offerId === selectedPkg.title && !(o.maxSessions && o.sessionsUsed >= o.maxSessions));
               if (existing) {
                  setSysAlert(ar() ? "لديك باقة فعالة أو معلقة من هذا النوع مسبقاً!" : "You already have an active or pending package of this type!");
                  setTimeout(() => setSysAlert(null), 4000);
                  return;
               }

               const newOffer = { 
                  id: "off_" + Date.now(), 
                  userId: auth?.userId || "cust1",
                  offerId: selectedPkg.title, 
                  amount: selectedPkg.price,
                  status: "pending payment", 
                  method: paymentOption === "installments" ? "Installments" : "Full Payment",
                  totalInstallments: paymentOption === "installments" ? installments : 1,
                  paidInstallments: 0,
                  sessionsUsed: 0,
                  maxSessions: selectedPkg.maxSessions || null,
                  category: selectedPkg.category,
                  clinicId: selectedPkg.category === "laser" ? selectedClinic : null,
                  cashbackBalance: selectedPkg.signupCashback || 0,
                  isCashbackOnly: selectedPkg.isCashbackOnly || false,
                  createdAt: new Date().toISOString()
               };
               const updatedOffers = [...localOffers, newOffer];
               saveOffers(updatedOffers);

               try {
                 const pending = JSON.parse(localStorage.getItem('demo_pending_payments_v4') || '[]');
                 pending.push(newOffer);
                 localStorage.setItem('demo_pending_payments_v4', JSON.stringify(pending));
               } catch (e) {}

               let booked = false;
               if (selectedPkg.category === "laser" && bookFirstSession) {
                  try {
                     const bookings = JSON.parse(localStorage.getItem('demo_pending_bookings_v4') || '[]');
                     bookings.push({
                        id: `book_${Date.now()}`,
                        userId: auth?.userId || "cust1",
                        offerId: selectedPkg.title,
                        treatment: "Laser Session",
                        clinic: clinics.find(c => c.id === selectedClinic)?.nameEn || selectedClinic,
                        createdAt: new Date().toISOString()
                     });
                     localStorage.setItem('demo_pending_bookings_v4', JSON.stringify(bookings));
                     booked = true;
                  } catch (e) {}
               } else if (selectedPkg.category !== "laser" && selectedFirstSession && selectedFirstClinic) {
                  try {
                     const treatment = allTreatments.find(t => t.id === selectedFirstSession);
                     const bookings = JSON.parse(localStorage.getItem('demo_pending_bookings_v4') || '[]');
                     bookings.push({
                        id: `book_${Date.now()}`,
                        userId: auth?.userId || "cust1",
                        offerId: selectedPkg.title,
                        treatment: treatment ? treatment.nameEn : "Beauty Session",
                        clinic: clinics.find(c => c.id === selectedFirstClinic)?.nameEn || selectedFirstClinic,
                        createdAt: new Date().toISOString()
                     });
                     localStorage.setItem('demo_pending_bookings_v4', JSON.stringify(bookings));
                     booked = true;
                  } catch (e) {}
               }

               setSelectedPkg(null);
               setSysAlert(ar() ? `تم بنجاح! ${booked ? 'سيتواصل معك قسم خدمة العملاء قريباً لإتمام عملية الدفع وتأكيد الموعد.' : 'سيتواصل معك قسم خدمة العملاء قريباً لإتمام عملية الدفع.'}` : `Success! ${booked ? 'Customer Service will contact you soon for payment & appointment.' : 'Customer Service will contact you soon for payment.'}`);
               setTimeout(() => setSysAlert(null), 6000);
               setActiveTab("home");
            }}>
               {ar() ? "تأكيد والحصول على العرض" : "Confirm & Get Offer"}
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
            <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "حجز موعد" : "Book Appointment"}</h3>
            <p className="text-sm text-surface-500 mb-6">{ar() ? "الرجاء مراجعة تفاصيل الحجز، وسيتواصل معك الفريق لتأكيد الموعد." : "Please review the booking details, and our team will contact you to confirm the time."}</p>
            
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 mb-5">
               <div className="text-xs text-surface-500 mb-1">{ar() ? "الخدمة / الباقة المختارة" : "Selected Service / Package"}</div>
               <div className="font-bold text-surface-900">{showBookingModal.offerId || "Booking"}</div>
               {showBookingModal.method === "Standalone" && (
                 <div className="text-xs text-brand-pink-500 font-bold mt-1">{ar() ? "جلسة مفردة الدفع لاحقاً" : "Single Session (Pay Later)"}</div>
               )}
            </div>

            <div className="space-y-4 mb-6">
               <div>
                  <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "العيادة المفضلة" : "Preferred Clinic"}</label>
                  {showBookingModal.category === "laser" && showBookingModal.clinicId ? (
                     <select className="select-field w-full bg-surface-50 opacity-80" disabled value={showBookingModal.clinicId}>
                        {clinics.map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
                     </select>
                  ) : (
                     <select className="select-field w-full bg-surface-50" id="bookingClinicSelect">
                        {clinics.map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
                     </select>
                  )}
                  {showBookingModal.category === "laser" && showBookingModal.clinicId && (
                     <p className="text-[10px] text-brand-pink-500 mt-1">{ar() ? "ملاحظة: هذا العرض مخصص لعيادة واحدة. لتغيير العيادة يجب دفع الرسوم." : "Note: This offer is restricted to the selected clinic. To change, you must pay the fee."}</p>
                  )}
               </div>

               {/* Cashback Usage Option */}
               {(() => {
                  const relatedOffer = showBookingModal.applicableCashbackOfferId ? localOffers.find(o => o.id === showBookingModal.applicableCashbackOfferId) : null;
                  if (relatedOffer && relatedOffer.cashbackBalance > 0) {
                     const available = relatedOffer.cashbackBalance;
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

            <button className="btn-primary w-full shadow-md" onClick={() => {
               const offer = showBookingModal;
               let clinicName = "";
               if (offer.category === "laser" && offer.clinicId) {
                  clinicName = clinics.find(c => c.id === offer.clinicId)?.nameEn || offer.clinicId;
               } else {
                  const clinicSelect = document.getElementById('bookingClinicSelect') as HTMLSelectElement;
                  clinicName = clinicSelect ? clinics.find(c => c.id === clinicSelect.value)?.nameEn || "Preferred Clinic" : "Preferred Clinic";
               }

               if (offer.method !== "Standalone") {
                  const isInstallments = offer.method === "Installments";
                  let nextStatus = "active";
                  if (isInstallments && offer.paidInstallments < offer.totalInstallments) {
                     nextStatus = "pending payment";
                  }
                  const updatedOffer = { ...offer, sessionsUsed: (offer.sessionsUsed || 0) + 1, status: nextStatus };
                  const updatedOffers = localOffers.map(o => o.id === offer.id ? updatedOffer : o);
                  saveOffers(updatedOffers);
                  if (nextStatus === "pending payment") {
                      try {
                        const pending = JSON.parse(localStorage.getItem('demo_pending_payments_v4') || '[]');
                        pending.push(updatedOffer);
                        localStorage.setItem('demo_pending_payments_v4', JSON.stringify(pending));
                      } catch (e) {}
                  }
               } else if (offer.applicableCashbackOfferId) {
                  // Deduct cashback from the associated offer for standalone booking
                  const relatedOffer = localOffers.find(o => o.id === offer.applicableCashbackOfferId);
                  if (relatedOffer && relatedOffer.cashbackBalance > 0) {
                     const applied = Math.min(relatedOffer.cashbackBalance, offer.finalPrice);
                     const updatedRelatedOffer = { ...relatedOffer, cashbackBalance: relatedOffer.cashbackBalance - applied };
                     const updatedOffers = localOffers.map(o => o.id === relatedOffer.id ? updatedRelatedOffer : o);
                     saveOffers(updatedOffers);
                  }
               }

               try {
                  const bookings = JSON.parse(localStorage.getItem('demo_pending_bookings_v4') || '[]');
                  bookings.push({
                     id: `book_${Date.now()}`,
                     userId: auth?.userId || "cust1",
                     offerId: offer.offerId,
                     treatment: offer.method === "Standalone" ? "Standalone Session" : offer.treatment || "Package Session",
                     clinic: clinicName,
                     createdAt: new Date().toISOString()
                  });
                  localStorage.setItem('demo_pending_bookings_v4', JSON.stringify(bookings));
               } catch (e) {}

               setShowBookingModal(null);
               setSysAlert(ar() ? "تم إرسال طلب الحجز للعيادة بنجاح!" : "Booking request sent successfully to the clinic!");
               setTimeout(() => setSysAlert(null), 6000);
            }}>
               {ar() ? "طلب الموعد الآن" : "Request Appointment Now"}
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
                   {clinics.map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
                </select>
             </div>

             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowChangeClinicModal(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
                <button className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold shadow-md hover:bg-brand-pink-600 transition-colors" onClick={() => {
                   // Add to clinic change requests
                   try {
                      const requests = JSON.parse(localStorage.getItem("bel_clinic_change_requests_v1") || "[]");
                      requests.push({
                         id: "req_" + Date.now(),
                         userId: auth?.userId || "cust1",
                         subscriptionId: showChangeClinicModal.id,
                         fromClinicId: showChangeClinicModal.clinicId,
                         toClinicId: newClinicSelection,
                         feePaid: true,
                         status: "pending",
                         createdAt: new Date().toISOString()
                      });
                      localStorage.setItem("bel_clinic_change_requests_v1", JSON.stringify(requests));
                   } catch(e) {}

                   // Add to financial ledger
                   try {
                      const ledger = JSON.parse(localStorage.getItem("bel_financial_ledger_v1") || "[]");
                      ledger.push({
                         id: "txn_" + Date.now(),
                         userId: auth?.userId || "cust1",
                         type: "clinic_change_fee",
                         amount: showChangeClinicModal.currentFee,
                         description: ar() ? `تغيير عيادة الليزر إلى ${clinics.find(c => c.id === newClinicSelection)?.nameAr}` : `Change clinic to ${clinics.find(c => c.id === newClinicSelection)?.nameEn} for laser package`,
                         relatedId: showChangeClinicModal.id,
                         createdAt: new Date().toISOString()
                      });
                      localStorage.setItem("bel_financial_ledger_v1", JSON.stringify(ledger));
                   } catch(e) {}

                   const updatedOffer = { ...showChangeClinicModal, clinicId: newClinicSelection }; // Optimistic update for booking modal

                   setShowChangeClinicModal(null);
                   setSysAlert(ar() ? `تم إرسال طلب تغيير العيادة بنجاح وتم تحصيل رسوم ${showChangeClinicModal.currentFee} د.ك.` : `Clinic change request sent successfully. ${showChangeClinicModal.currentFee} KD fee applied.`);
                   setTimeout(() => setSysAlert(null), 5000);
                   
                   // Show custom booking prompt
                   setShowBookingPromptModal(updatedOffer);
                }}>
                   {ar() ? `دفع ${showChangeClinicModal.currentFee} د.ك وتغيير` : `Pay ${showChangeClinicModal.currentFee} KD & Change`}
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
