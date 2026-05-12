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
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="relative flex-1 bg-brand-gradient flex items-center justify-center p-8 lg:p-16 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl" />
        <div className="relative z-10 text-center lg:text-start max-w-lg animate-fade-in mt-12 lg:mt-24">
          <div className="flex items-center gap-4 justify-center lg:justify-start mb-8">
            <svg width={64} height={64} viewBox="0 0 80 80" fill="none">
              <path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="white" opacity="0.95" />
              <path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="white" opacity="0.6" />
              <path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="white" opacity="0.6" />
            </svg>
            <span className="text-4xl lg:text-5xl font-bold text-white tracking-tight">Belamonda</span>
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

      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-surface-50">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex justify-end items-center gap-3 mb-8">
            <Link to="/" className="text-xs font-semibold text-brand-pink-600 hover:text-brand-pink-700">
              {isAr ? "الرئيسية" : "Home"}
            </Link>
            <button onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")} className="btn-ghost text-xs gap-1.5">
              🌐 {isAr ? "English" : "العربية"}
            </button>
          </div>

          <div className="mb-8">
            <BelamondaLogo size={36} />
            <h2 className="mt-6 text-2xl font-bold text-surface-900">{t("welcomeBack")}</h2>
            <p className="mt-1 text-sm text-surface-500">{t("loginSubtitle")}</p>
          </div>

          <form
            className="card-elevated p-6 mb-4"
            onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                  {isAr ? "اسم المستخدم، البريد، أو رقم الهاتف" : "Username, Email, or Phone"}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={isAr ? "أدخلي حسابك هنا..." : "Enter your account..."}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  dir="ltr"
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1.5">
                  {isAr ? "كلمة المرور" : "Password"}
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder={isAr ? "أدخلي كلمة المرور..." : "Enter password..."}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={!identifier || !password || loading !== null}
              >
                {loading ? (isAr ? "جارٍ الدخول..." : "Signing in...") : isAr ? "تسجيل الدخول" : "Sign In"}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-surface-500">
            {isAr ? "ليس لديكِ حساب؟" : "Don't have an account?"}{" "}
            <Link to="/signup" className="font-bold text-brand-pink-600 hover:text-brand-pink-700">
              {isAr ? "أنشئي حسابك" : "Create account"}
            </Link>
          </p>

          <p className="mt-8 text-center text-xs text-surface-400">© 2026 Belamonda — Kuwait</p>
        </div>
      </div>
    </div>
  );
}
