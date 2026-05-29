import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../app/AuthContext";
import { BelamondaLogo } from "../components/BelamondaLogo";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { loginWithPassword } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAr = i18n.language === "ar";
  const isExpired = new URLSearchParams(window.location.search).get("expired") === "1";

  async function handleSignIn() {
    setLoading("signin");
    setError(null);
    try {
      await loginWithPassword(identifier, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white lg:bg-surface-50">
      {/* Top/Left Section - Premium Image Background */}
      <div className="relative flex-none lg:flex-1 h-[35vh] lg:h-auto w-full flex flex-col items-center justify-center p-6 lg:p-16 overflow-hidden">
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

        <div className="relative z-10 text-center max-w-lg animate-fade-in mt-8 lg:mt-12">
          <div className="flex items-center justify-center mb-4 lg:mb-8">
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl lg:rounded-[2.5rem] p-5 lg:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
              <div className="lg:hidden"><BelamondaLogo size={72} /></div>
              <div className="hidden lg:block"><BelamondaLogo size={120} /></div>
            </div>
          </div>
          <h1 className="hidden lg:block text-3xl lg:text-4xl font-black text-brand-pink-950 leading-snug drop-shadow-sm tracking-tight">
            {isAr ? "منصة الجمال والعناية الشاملة" : "Beauty & Wellness Platform"}
          </h1>
          <p className="hidden lg:block mt-5 text-brand-pink-900/90 text-lg leading-relaxed font-semibold">
            {isAr
              ? "اكتشفي العروض الحصرية، تتبعي الكاش باك الخاص بك، واحجزي جلساتك بسهولة."
              : "Discover exclusive offers, manage your cashback, and book your clinic sessions seamlessly."}
          </p>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center p-6 sm:p-12 lg:p-20 relative bg-white rounded-t-[2.5rem] -mt-10 lg:-mt-0 lg:rounded-t-none lg:rounded-l-[3rem] lg:-ml-12 z-20 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)] lg:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="w-full max-w-md mx-auto relative z-10 animate-slide-up">
          {/* Mobile top handle for visual bottom-sheet feel */}
          <div className="w-12 h-1.5 bg-surface-200 rounded-full mx-auto mb-6 lg:hidden" />
          
          <div className="flex justify-end items-center gap-3 mb-8 lg:mb-10">
            <Link to="/" className="text-xs font-bold text-surface-500 hover:text-brand-pink-600 transition-colors bg-surface-100 hover:bg-brand-pink-50 px-4 py-2 rounded-full">
              {isAr ? "الرئيسية" : "Home"}
            </Link>
            <button onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")} className="text-xs font-bold text-surface-500 hover:text-brand-pink-600 transition-colors bg-surface-100 hover:bg-brand-pink-50 px-4 py-2 rounded-full flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {isAr ? "English" : "العربية"}
            </button>
          </div>

          <div className="mb-8 lg:mb-10 text-center sm:text-start">
            <h2 className="text-2xl lg:text-3xl font-black text-surface-900 tracking-tight">{t("welcomeBack")}</h2>
            <p className="mt-2 text-sm text-surface-500 font-medium">{t("loginSubtitle")}</p>
          </div>

          {isExpired && (
            <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3 text-sm text-amber-800 shadow-sm">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span className="font-medium leading-relaxed">{isAr ? "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى." : "Your session has expired. Please sign in again."}</span>
            </div>
          )}

          <form
            className="space-y-6"
            onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}
          >
            <div>
              <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide mb-2">
                {isAr ? "اسم المستخدم، البريد، أو رقم الهاتف" : "Username, Email, or Phone"}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                  type="text"
                  className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                  placeholder={isAr ? "أدخلي حسابك هنا..." : "Enter your account..."}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  dir="ltr"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-surface-700 uppercase tracking-wide">
                  {isAr ? "كلمة المرور" : "Password"}
                </label>
                <button 
                  type="button" 
                  onClick={() => alert(isAr ? "سيتم توفير هذه الميزة قريباً!" : "Forgot password feature coming soon!")}
                  className="text-xs font-bold text-brand-pink-600 hover:text-brand-pink-800 transition-colors"
                >
                  {isAr ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400 group-focus-within:text-brand-pink-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input
                  type="password"
                  className="w-full bg-surface-50 border border-surface-200 text-surface-900 rounded-2xl py-3.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-pink-500/20 focus:border-brand-pink-500 transition-all font-medium text-sm"
                  placeholder={isAr ? "أدخلي كلمة المرور..." : "Enter password..."}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  autoComplete="current-password"
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
              disabled={!identifier || !password || loading !== null}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {isAr ? "جارٍ الدخول..." : "Signing in..."}
                </span>
              ) : (
                isAr ? "تسجيل الدخول" : "Sign In"
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-surface-100">
            <p className="text-center text-sm text-surface-500 font-medium">
              {isAr ? "ليس لديكِ حساب؟" : "Don't have an account?"}{" "}
              <Link to="/signup" className="font-bold text-brand-pink-600 hover:text-brand-pink-800 transition-colors ml-1">
                {isAr ? "أنشئي حسابك" : "Create account"}
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
