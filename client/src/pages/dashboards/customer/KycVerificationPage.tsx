import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

// ==========================================
// KYC Page Component
// ==========================================
export function KycVerificationPage({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const { getAuthHeader } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [form, setForm] = useState({
    civilId: "",
    civilIdFront: "",
    civilIdBack: "",
    terms1: false,
    terms2: false,
    terms3: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof form) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setForm(prev => ({ ...prev, [field]: ev.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const submitKyc = async () => {
    setKycError(null);
    if (!form.terms1 || !form.terms2 || !form.terms3) {
      setKycError(ar() ? "يرجى الموافقة على جميع الشروط" : "Please agree to all terms");
      return;
    }
    const cleanCivilId = (form.civilId || "").replace(/\D/g, "");
    if (cleanCivilId.length !== 12) {
      setKycError(ar() ? "الرقم المدني يجب أن يكون 12 رقم" : "Civil ID must be exactly 12 digits");
      setStep(1);
      return;
    }
    if (!form.civilIdFront || !form.civilIdBack) {
      setKycError(ar() ? "يرجى رفع صورة البطاقة المدنية من الجهتين" : "Please upload both sides of your Civil ID");
      setStep(2);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/kyc/submit", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          civilIdNumber: cleanCivilId,
          civilIdFrontRef: form.civilIdFront,
          civilIdBackRef: form.civilIdBack,
          checkboxes: { termsAndConditions: true, dataPrivacyConsent: true, serviceLiabilityWaiver: true, age18Plus: true, paymentTermsAcknowledgment: true },
        }),
      });
      onComplete();
    } catch (e: any) {
      const msg = e.message || "";
      if (msg === "ALREADY_PENDING") {
        setKycError(ar() ? "لديك طلب توثيق قيد المراجعة بالفعل. يرجى الانتظار حتى تتم مراجعته." : "You already have a pending verification request. Please wait for it to be reviewed.");
      } else if (msg === "ALREADY_VERIFIED") {
        setKycError(ar() ? "حسابك موثق بالفعل." : "Your account is already verified.");
      } else if (msg === "VALIDATION_ERROR") {
        setKycError(ar() ? "يرجى التأكد من صحة البيانات المدخلة والمحاولة مرة أخرى" : "Please verify your information and try again");
      } else {
        setKycError(msg || (ar() ? "فشل الإرسال" : "Submission failed"));
      }
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
            <button className="btn-primary w-full btn-lg" onClick={() => setStep(2)} disabled={form.civilId.replace(/\D/g, "").length !== 12}>{ar() ? "متابعة" : "Continue"}</button>
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
              <label className="border-2 border-dashed border-brand-pink-200 bg-brand-pink-50/30 rounded-2xl p-6 text-center cursor-pointer hover:bg-brand-pink-50 transition-colors relative overflow-hidden group block">
                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'civilIdFront')} />
                {form.civilIdFront ? (
                  <img src={form.civilIdFront} alt="Front" className="w-full h-24 object-contain rounded-lg mb-2" />
                ) : (
                  <span className="text-2xl mb-2 block">📷</span>
                )}
                <span className="text-xs font-semibold text-brand-pink-600">{ar() ? "الجهة الأمامية" : "Front Side"}</span>
              </label>
              <label className="border-2 border-dashed border-brand-pink-200 bg-brand-pink-50/30 rounded-2xl p-6 text-center cursor-pointer hover:bg-brand-pink-50 transition-colors relative overflow-hidden group block">
                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileChange(e, 'civilIdBack')} />
                {form.civilIdBack ? (
                  <img src={form.civilIdBack} alt="Back" className="w-full h-24 object-contain rounded-lg mb-2" />
                ) : (
                  <span className="text-2xl mb-2 block">📷</span>
                )}
                <span className="text-xs font-semibold text-brand-pink-600">{ar() ? "الجهة الخلفية" : "Back Side"}</span>
              </label>
            </div>
            <button className="btn-primary w-full btn-lg mt-4" disabled={!form.civilIdFront || !form.civilIdBack} onClick={() => setStep(3)}>{ar() ? "متابعة" : "Continue"}</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-slide-in-right">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-pink-100 text-brand-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-surface-900">{ar() ? "الإقرار والشروط" : "Terms & Conditions"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "يرجى الموافقة على الشروط" : "Please agree to the terms"}</p>
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
              {submitting ? (ar() ? "جاري الإرسال..." : "Submitting...") : (ar() ? "اعتماد وإرسال" : "Submit")}
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
