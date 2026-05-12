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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="relative flex-1 bg-brand-gradient flex items-center justify-center p-8 lg:p-16 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl" />
        <div className="relative z-10 max-w-lg text-white">
          <Link to="/" className="text-white/80 hover:text-white text-sm font-semibold inline-flex items-center gap-2 mb-8">
            <span className="rtl:rotate-180">←</span> {t("Back to home", "العودة للرئيسية")}
          </Link>
          <h1 className="text-3xl lg:text-4xl font-black leading-tight">
            {t("Join Belamonda.", "انضمي إلى بيلاموندو.")}
          </h1>
          <p className="mt-3 text-white/85 text-base leading-relaxed">
            {t(
              "Create your account in under a minute. No card required, instant access to offers and cashback.",
              "أنشئي حسابك في دقيقة. بدون بطاقة، ووصول فوري للعروض والكاش باك."
            )}
          </p>
          <div className="mt-8 grid gap-3 max-w-sm">
            {[
              { en: "Browse exclusive offers", ar: "تصفّحي عروض حصرية" },
              { en: "Earn cashback on every visit", ar: "اكسبي كاش باك مع كل زيارة" },
              { en: "Manage all your bookings", ar: "أدِيري كل حجوزاتك" },
            ].map((b) => (
              <div key={b.en} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-white/20 grid place-items-center">✓</span>
                <span>{isAr ? b.ar : b.en}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-surface-50">
        <div className="w-full max-w-md">
          <div className="flex justify-end mb-6">
            <button onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")} className="text-xs font-semibold text-surface-500 hover:text-brand-pink-600">
              {isAr ? "English" : "العربية"}
            </button>
          </div>
          <BelamondaLogo size={36} />
          <h2 className="mt-6 text-2xl font-black text-surface-900">{t("Create your account", "أنشئي حسابك")}</h2>
          <p className="text-sm text-surface-500 mt-1">{t("It only takes a minute.", "يستغرق دقيقة فقط.")}</p>

          <form onSubmit={submit} className="card-elevated p-6 mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-surface-700 mb-1.5">
                {t("Full name", "الاسم الكامل")} <span className="text-brand-pink-500">*</span>
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("Sara Al-Sabah", "سارة الصباح")}
                className="input-field"
                autoComplete="name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-700 mb-1.5">
                {t("Gender", "الجنس")} <span className="text-brand-pink-500">*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "female" | "male" | "other")}
                className="select-field"
                required
              >
                <option value="female">{t("Female", "أنثى")}</option>
                <option value="male">{t("Male", "ذكر")}</option>
                <option value="other">{t("Other", "أخرى")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-700 mb-1.5">
                {t("Email", "البريد الإلكتروني")} <span className="text-brand-pink-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-700 mb-1.5">
                {t("Phone", "الهاتف")} <span className="text-brand-pink-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+965 9XXX XXXX"
                className="input-field"
                dir="ltr"
                autoComplete="tel"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-surface-700 mb-1.5">
                  {t("Password", "كلمة المرور")} <span className="text-brand-pink-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  dir="ltr"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-surface-700 mb-1.5">
                  {t("Confirm", "تأكيد")} <span className="text-brand-pink-500">*</span>
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-field"
                  dir="ltr"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-surface-600">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                {t("I agree to the ", "أوافق على ")}
                <a className="font-bold text-brand-pink-600 hover:underline" href="#">{t("Terms & Privacy Policy", "الشروط وسياسة الخصوصية")}</a>
              </span>
            </label>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? t("Creating...", "جارٍ الإنشاء...") : t("Create account", "إنشاء الحساب")}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-6">
            {t("Already have an account?", "لديكِ حساب؟")}{" "}
            <Link to="/login" className="font-bold text-brand-pink-600 hover:text-brand-pink-700">
              {t("Sign in", "سجّلي الدخول")}
            </Link>
          </p>
          <p className="mt-8 text-center text-xs text-surface-400">© 2026 Belamonda — Kuwait</p>
        </div>
      </div>
    </div>
  );
}
