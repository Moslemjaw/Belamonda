import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Role } from "@belamonda/shared";
import { useAuth } from "../app/AuthContext";
import { BelamondaLogo } from "../components/BelamondaLogo";
import i18n from "../app/i18n";
import { sharedClinics } from "../lib/clinics";

const DEMO_ACCOUNTS: { id: string; role: Role; label: string; labelAr: string; icon: string }[] = [
  { id: "cust1", role: "customer", label: "Customer", labelAr: "عميلة", icon: "👤" },
  { id: "admin1", role: "admin", label: "Admin", labelAr: "مدير", icon: "⚙️" },
  { id: "cs1", role: "cs", label: "Customer Service", labelAr: "خدمة العملاء", icon: "🎧" },
  { id: "fin1", role: "finance", label: "Finance", labelAr: "المالية", icon: "📊" },
  ...sharedClinics.map(c => ({ id: c.id, role: "clinicStaff" as Role, label: c.nameEn, labelAr: c.nameAr, icon: "🏥" }))
];

export default function LoginPage() {
  const { t } = useTranslation();
  const { loginWithPassword } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  
  // Auth state
  const [isSignUp, setIsSignUp] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  
  const [showDemo, setShowDemo] = useState(false);

  async function handleSignIn() {
    setLoading("signin");
    try {
      await loginWithPassword(identifier, password);
    } catch (err) {
      console.error("Login failed:", err);
      alert(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleSignUp() {
    setLoading("signup");
    try {
      // simple local customer signup: username optional, identifier can be phone/email/username
      // backend will validate presence of at least one identifier field.
      const isEmail = identifier.includes("@");
      const isPhone = /^\+?\d[\d\s-]{5,}$/.test(identifier);
      const payload: any = { password };
      if (username.trim()) payload.username = username.trim();
      if (isEmail) payload.email = identifier.trim();
      else if (isPhone) payload.phone = identifier.trim();
      else payload.username = (payload.username || identifier.trim());

      const { passwordRegister } = await import("../lib/demoTokens");
      const r = await passwordRegister(payload);
      // use token directly by signing in again via password flow for consistent state
      // (avoid duplicating state logic)
      await loginWithPassword(identifier || payload.username, password);
      void r;
    } catch (err) {
      console.error("Signup failed:", err);
      alert(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(null);
    }
  }

  const isAr = i18n.language === "ar";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side — Brand hero */}
      <div className="relative flex-1 bg-brand-gradient flex items-center justify-center p-8 lg:p-16 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10 text-center lg:text-start max-w-lg animate-fade-in mt-12 lg:mt-24">
          <div className="flex items-center gap-4 justify-center lg:justify-start mb-8">
            <svg width={64} height={64} viewBox="0 0 80 80" fill="none">
              <path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="white" opacity="0.95"/>
              <path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="white" opacity="0.6"/>
              <path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="white" opacity="0.6"/>
              <path d="M12 35C12 35 12 45 20 52C26 57 34 55 40 55C30 55 15 52 12 35Z" fill="white" opacity="0.35"/>
              <path d="M68 35C68 35 68 45 60 52C54 57 46 55 40 55C50 55 65 52 68 35Z" fill="white" opacity="0.35"/>
            </svg>
            <span className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              Belamonda
            </span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-semibold text-white/95 leading-snug">
            {isAr ? "منصة الجمال والعناية الشاملة" : "Beauty & Wellness Platform"}
          </h1>
          <p className="mt-4 text-white/70 text-base leading-relaxed">
            {isAr
              ? "اكتشفي العروض الحصرية، تتبعي الكاش باك الخاص بك، واحجزي جلساتك بسهولة."
              : "Discover exclusive offers, manage your cashback, and book your clinic sessions seamlessly."}
          </p>
        </div>
      </div>

      {/* Right side — Login form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-surface-50">
        <div className="w-full max-w-md animate-slide-up">
          {/* Language toggle */}
          <div className="flex justify-end items-center gap-3 mb-8">
            <Link to="/" className="text-xs font-semibold text-brand-pink-600 hover:text-brand-pink-700">
              {isAr ? "الرئيسية" : "Home"}
            </Link>
            <button
              onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")}
              className="btn-ghost text-xs gap-1.5"
            >
              🌐 {isAr ? "English" : "العربية"}
            </button>
          </div>

          <div className="mb-8">
            <BelamondaLogo size={36} />
            <h2 className="mt-6 text-2xl font-bold text-surface-900">
              {isSignUp ? (isAr ? "إنشاء حساب جديد" : "Create an Account") : t("welcomeBack")}
            </h2>
            <p className="mt-1 text-sm text-surface-500">
              {isSignUp 
                ? (isAr ? "سجلي الآن للوصول إلى أفضل العروض" : "Sign up to access exclusive beauty offers")
                : t("loginSubtitle")}
            </p>
          </div>

          {/* Form Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-surface-200 rounded-xl">
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isSignUp ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
              onClick={() => { setIsSignUp(false); setIdentifier(""); setPassword(""); setUsername(""); }}
            >
              {isAr ? "تسجيل الدخول" : "Sign In"}
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isSignUp ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700'}`}
              onClick={() => { setIsSignUp(true); setIdentifier(""); setPassword(""); setUsername(""); }}
            >
              {isAr ? "إنشاء حساب" : "Sign Up"}
            </button>
          </div>

          {/* Identifier + Password Form */}
          <div className="card-elevated p-6 mb-6">
            <div className="space-y-4">
              {isSignUp && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-medium text-surface-600 mb-1.5">
                    {isAr ? "اسم المستخدم (Username)" : "Username"}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. beauty_lover99"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                  {isSignUp 
                    ? (isAr ? "البريد الإلكتروني أو رقم الهاتف" : "Email or Phone Number") 
                    : (isAr ? "اسم المستخدم، البريد، أو رقم الهاتف" : "Username, Email, or Phone")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-field flex-1"
                    placeholder={isAr ? "أدخل حسابك هنا..." : "Enter your account..."}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="animate-slide-up">
                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                  {isAr ? "كلمة المرور" : "Password"}
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder={isAr ? "أدخل كلمة المرور..." : "Enter password..."}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                />
              </div>

              <button
                className="btn-primary w-full"
                onClick={() => (isSignUp ? handleSignUp() : handleSignIn())}
                disabled={!identifier || !password || loading !== null}
              >
                {isSignUp ? (isAr ? "تسجيل" : "Sign Up") : (isAr ? "تسجيل الدخول" : "Sign In")}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-6 cursor-pointer" onClick={() => setShowDemo(!showDemo)}>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-50 px-4 text-xs text-surface-400 font-medium hover:text-surface-600 transition-colors">
                {isAr ? "دخول الموظفين (للتجربة)" : "Staff Login (Demo)"}
              </span>
            </div>
          </div>

          {/* Demo role cards (Hidden by default) */}
          {showDemo && (
            <div className="grid grid-cols-1 gap-2 animate-fade-in">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.id}
                  className="card-elevated flex items-center gap-4 px-5 py-3.5 text-start w-full group"
                  onClick={() => { setIdentifier(acc.id); setPassword("demo12345"); }}
                  disabled={loading !== null}
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">
                    {acc.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-surface-800">
                      {isAr ? acc.labelAr : acc.label}
                    </div>
                    <div className="text-xs text-surface-400 mt-0.5">
                      {acc.id} • {acc.role}
                    </div>
                  </div>
                  {loading === acc.id ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-pink-300 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4 text-surface-300 group-hover:text-brand-pink-400 transition-colors rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="mt-8 text-center text-xs text-surface-400">
            © 2026 Belamonda — Kuwait
          </p>
        </div>
      </div>
    </div>
  );
}
