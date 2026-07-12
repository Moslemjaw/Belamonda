import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BelamondaLogo } from "../components/BelamondaLogo";

import { API_BASE_URL } from "../lib/api";

export default function RecoverAccountPage() {
  const { i18n } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t("Invalid or missing recovery token.", "رمز استعادة الحساب غير صالح أو مفقود."));
      return;
    }

    if (password.length < 8) {
      setError(t("Password must be at least 8 characters", "كلمة المرور يجب أن تكون ٨ أحرف على الأقل"));
      return;
    }
    if (password !== confirm) {
      setError(t("Passwords do not match", "كلمتا المرور غير متطابقتين"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/recover-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to recover account");
      }
      setSuccess(true);
      setTimeout(() => nav("/login", { replace: true }), 3000);
    } catch (err: any) {
      const msg = err?.message || "Failed";
      setError(
        msg === "INVALID_OR_EXPIRED_TOKEN"
          ? t("The recovery link is invalid or has expired.", "رابط الاستعادة غير صالح أو منتهي الصلاحية.")
          : t("An error occurred. Please try again.", "حدث خطأ. يرجى المحاولة مرة أخرى.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white lg:bg-surface-50">
      {/* Top/Left Section - Premium Image Background */}
      <div className="relative flex-none lg:flex-1 h-[25vh] sm:h-[30vh] lg:h-auto w-full flex flex-col items-center justify-center p-6 lg:p-16 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 hover:scale-105"
          style={{ backgroundImage: "url('/login-bg.png')" }}
        />
        {/* Soft light overlay for readability */}
        <div className="absolute inset-0 bg-white/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent lg:from-white/80 lg:via-white/40" />
        
        {/* Decorative glass elements */}
        <div className="absolute top-1/4 left-1/4 w-[40%] h-[40%] rounded-full bg-brand-pink-300/30 blur-3xl mix-blend-multiply" />
        <div className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] rounded-full bg-rose-200/30 blur-3xl mix-blend-multiply" />

        <div className="relative z-10 max-w-lg text-brand-pink-950 animate-fade-in mt-8 lg:mt-12 text-center lg:text-start flex flex-col items-center lg:items-start">
          <div className="flex lg:hidden items-center justify-center mb-2">
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
              <BelamondaLogo size={56} />
            </div>
          </div>
          <Link to="/" className="hidden lg:inline-flex text-brand-pink-800 hover:text-brand-pink-950 text-sm font-bold items-center gap-2 mb-8 bg-white/40 px-4 py-2 rounded-full backdrop-blur-md transition-colors">
            <span className="rtl:rotate-180">←</span> {t("Back to home", "العودة للرئيسية")}
          </Link>
          <h1 className="hidden lg:block text-3xl lg:text-4xl font-black leading-tight drop-shadow-sm tracking-tight">
            {t("Recover Account", "استعادة الحساب")}
          </h1>
          <p className="hidden lg:block mt-5 text-brand-pink-900/90 text-lg leading-relaxed font-semibold">
            {t(
              "Set a new secure password to regain access to your Belamonda account.",
              "عيّني كلمة مرور جديدة للوصول إلى حسابك في بيلاموندو."
            )}
          </p>
        </div>
      </div>

      {/* Right/Bottom Section - Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center p-6 sm:p-12 lg:p-20 relative bg-white rounded-t-[2.5rem] -mt-10 lg:-mt-0 lg:rounded-t-none lg:rounded-l-[3rem] lg:-ml-12 z-20 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)] lg:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="w-full max-w-md mx-auto relative z-10 animate-slide-up">
          <div className="w-12 h-1.5 bg-surface-200 rounded-full mx-auto mb-6 lg:hidden" />
          
          <div className="flex justify-between lg:justify-end items-center gap-3 mb-8 lg:mb-10">
            <button onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")} className="text-xs font-bold text-surface-500 hover:text-brand-pink-600 transition-colors bg-surface-100 hover:bg-brand-pink-50 px-4 py-2 rounded-full flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {isAr ? "English" : "العربية"}
            </button>
          </div>

          <div className="mb-8 lg:mb-10 text-center sm:text-start">
            <h2 className="text-2xl lg:text-3xl font-black text-surface-900 tracking-tight">{t("Reset Password", "إعادة تعيين كلمة المرور")}</h2>
            <p className="mt-2 text-sm text-surface-500 font-medium">
              {t("Enter a new password for your account.", "أدخلي كلمة مرور جديدة لحسابك.")}
            </p>
          </div>

          {success ? (
            <div className="rounded-2xl bg-green-50 border border-green-200 px-6 py-8 text-center animate-fade-in">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-green-800 mb-2">
                {t("Password Updated!", "تم تحديث كلمة المرور!")}
              </h3>
              <p className="text-green-700 text-sm font-medium">
                {t("Redirecting to login...", "جاري التوجيه إلى صفحة الدخول...")}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {!token && (
                <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {t("Missing recovery token. Please use the link sent to you.", "رمز الاستعادة مفقود. يرجى استخدام الرابط المرسل إليك.")}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                  {t("New Password", "كلمة المرور الجديدة")} <span className="text-brand-pink-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                    dir="ltr"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                  {t("Confirm New Password", "تأكيد كلمة المرور")} <span className="text-brand-pink-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                    dir="ltr"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                className="w-full bg-brand-gradient hover:opacity-90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-pink-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                disabled={loading || !token}
              >
                {loading ? t("Updating...", "جاري التحديث...") : t("Update Password", "تحديث كلمة المرور")}
              </button>
            </form>
          )}

          <div className="mt-10 pt-8 border-t border-surface-100">
            <p className="text-center text-sm text-surface-500 font-medium">
              {t("Remember your password?", "تتذكرين كلمة المرور؟")}{" "}
              <Link to="/login" className="font-bold text-brand-pink-600 hover:text-brand-pink-800 transition-colors ml-1">
                {t("Sign in", "سجّلي الدخول")}
              </Link>
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}
