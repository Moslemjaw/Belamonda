import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../app/AuthContext";
import { BelamondaLogo } from "../components/BelamondaLogo";

export default function SignupPage() {
  const { registerCustomer } = useAuth();
  const { i18n } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const refCode = params.get("ref") || undefined;
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other">("female");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError(t("Please enter your full name", "يرجى إدخال اسمك الكامل"));
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t("Please enter a valid email", "يرجى إدخال بريد إلكتروني صحيح"));
      return;
    }
    if (!/^\+?\d[\d\s-]{5,}$/.test(phone.trim())) {
      setError(t("Please enter a valid phone number", "يرجى إدخال رقم هاتف صحيح"));
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
    if (!agreed) {
      setError(t("Please accept the terms", "يرجى قبول الشروط"));
      return;
    }

    setLoading(true);
    try {
      await registerCustomer({
        fullName: fullName.trim(),
        gender,
        email: email.trim(),
        phone: phone.trim(),
        password,
        referralCode: refCode,
      });
      nav(next, { replace: true });
    } catch (err: any) {
      const msg = err?.message || "Failed";
      setError(
        msg === "DUPLICATE_IDENTIFIER"
          ? t("This account already exists. Try signing in.", "الحساب موجود مسبقاً. حاولي تسجيل الدخول.")
          : msg === "VALIDATION_ERROR"
            ? t("Please double-check your details.", "يرجى التحقق من بياناتك.")
            : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-surface-50">
      {/* Left Section - Premium Image Background */}
      <div className="relative flex-1 hidden lg:flex flex-col items-center justify-center p-8 lg:p-16 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 hover:scale-105"
          style={{ backgroundImage: "url('/login-bg.png')" }}
        />
        {/* Soft light overlay for readability */}
        <div className="absolute inset-0 bg-white/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/40 to-transparent" />
        
        {/* Decorative glass elements */}
        <div className="absolute top-1/4 left-1/4 w-[40%] h-[40%] rounded-full bg-brand-pink-300/30 blur-3xl mix-blend-multiply" />
        <div className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] rounded-full bg-rose-200/30 blur-3xl mix-blend-multiply" />

        <div className="relative z-10 max-w-lg text-brand-pink-950 animate-fade-in mt-12">
          <Link to="/" className="text-brand-pink-800 hover:text-brand-pink-950 text-sm font-bold inline-flex items-center gap-2 mb-8 bg-white/40 px-4 py-2 rounded-full backdrop-blur-md transition-colors">
            <span className="rtl:rotate-180">←</span> {t("Back to home", "العودة للرئيسية")}
          </Link>
          <h1 className="text-3xl lg:text-4xl font-black leading-tight drop-shadow-sm tracking-tight">
            {t("Join Belamonda.", "انضمي إلى بيلاموندو.")}
          </h1>
          <p className="mt-5 text-brand-pink-900/90 text-lg leading-relaxed font-semibold">
            {t(
              "Create your account in under a minute. No card required, instant access to offers and cashback.",
              "أنشئي حسابك في دقيقة. بدون بطاقة، ووصول فوري للعروض والكاش باك."
            )}
          </p>
          <div className="mt-8 grid gap-4 max-w-sm">
            {[
              { en: "Browse exclusive offers", ar: "تصفّحي عروض حصرية" },
              { en: "Earn cashback on every visit", ar: "اكسبي كاش باك مع كل زيارة" },
              { en: "Manage all your bookings", ar: "أدِيري كل حجوزاتك" },
            ].map((b) => (
              <div key={b.en} className="flex items-center gap-4 text-base font-medium">
                <span className="w-8 h-8 rounded-full bg-white/60 text-brand-pink-700 grid place-items-center shadow-sm">✓</span>
                <span className="text-brand-pink-950/80">{isAr ? b.ar : b.en}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Section - Signup Form */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-20 relative bg-white lg:rounded-l-[3rem] lg:-ml-12 z-20 shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        {/* Mobile-only background image to keep consistency */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-5 lg:hidden pointer-events-none"
          style={{ backgroundImage: "url('/login-bg.png')" }}
        />
        
        <div className="w-full max-w-md mx-auto relative z-10 animate-slide-up">
          <div className="flex justify-end items-center gap-3 mb-10">
            <button onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")} className="text-xs font-bold text-surface-500 hover:text-brand-pink-600 transition-colors bg-surface-100 hover:bg-brand-pink-50 px-4 py-2 rounded-full flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {isAr ? "English" : "العربية"}
            </button>
          </div>

          <div className="mb-10 text-center sm:text-start">
            <div className="inline-block lg:hidden mb-6 bg-brand-pink-50 p-4 rounded-3xl">
              <BelamondaLogo size={64} />
            </div>
            <h2 className="text-3xl font-black text-surface-900 tracking-tight">{t("Create your account", "أنشئي حسابك")}</h2>
            <p className="mt-2 text-sm text-surface-500 font-medium">{t("It only takes a minute.", "يستغرق دقيقة فقط.")}</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                {t("Full name", "الاسم الكامل")} <span className="text-brand-pink-500">*</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("Sara Al-Sabah", "سارة الصباح")}
                  className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                {t("Gender", "الجنس")} <span className="text-brand-pink-500">*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "female" | "male" | "other")}
                className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm appearance-none"
                required
              >
                <option value="female">{t("Female", "أنثى")}</option>
                <option value="male">{t("Male", "ذكر")}</option>
                <option value="other">{t("Other", "أخرى")}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                {t("Email", "البريد الإلكتروني")} <span className="text-surface-400 font-normal normal-case">({t("Optional", "اختياري")})</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                  dir="ltr"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                {t("Phone", "الهاتف")} <span className="text-brand-pink-500">*</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+965 9XXX XXXX"
                  className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                  dir="ltr"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                  {t("Password", "كلمة المرور")} <span className="text-brand-pink-500">*</span>
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
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                  {t("Confirm", "تأكيد")} <span className="text-brand-pink-500">*</span>
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
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 mt-4 mb-2 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="peer appearance-none w-5 h-5 border-2 border-surface-300 rounded bg-white checked:bg-brand-pink-500 checked:border-brand-pink-500 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-pink-500/30"
                />
                <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-xs font-medium text-surface-600 mt-0.5 leading-relaxed group-hover:text-surface-800 transition-colors">
                {t("I agree to the ", "أوافق على ")}
                <a className="font-bold text-brand-pink-600 hover:text-brand-pink-800 underline decoration-brand-pink-600/30 hover:decoration-brand-pink-600 transition-colors" href="#">{t("Terms & Privacy Policy", "الشروط وسياسة الخصوصية")}</a>
              </span>
            </label>

            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}

            <button type="submit" className="w-full bg-brand-gradient hover:opacity-90 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-pink-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {t("Creating...", "جارٍ الإنشاء...")}
                </span>
              ) : t("Create account", "إنشاء الحساب")}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-surface-100">
            <p className="text-center text-sm text-surface-500 font-medium">
              {t("Already have an account?", "لديكِ حساب؟")}{" "}
              <Link to="/login" className="font-bold text-brand-pink-600 hover:text-brand-pink-800 transition-colors ml-1">
                {t("Sign in", "سجّلي الدخول")}
              </Link>
            </p>
          </div>
          
          <p className="mt-10 text-center text-xs font-medium text-surface-400 uppercase tracking-widest">
            © {new Date().getFullYear()} Belamonda — Kuwait
          </p>
        </div>
      </div>
    </div>
  );
}
