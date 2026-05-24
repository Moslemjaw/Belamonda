import { Link, NavLink } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BelamondaLogo } from "./BelamondaLogo";
import { useAuth } from "../app/AuthContext";

const navLinkBase =
  "rounded-lg px-3 py-2 text-sm font-medium text-surface-600 hover:text-brand-pink-600 transition-colors";
const navLinkActive = "text-brand-pink-600";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { auth, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const t = (en: string, ar: string) => (isAr ? ar : en);

  const links = [
    { to: "/", label: t("Home", "الرئيسية") },
    { to: "/memberships", label: t("Memberships", "العضويات") },
    { to: "/clinics", label: t("Clinics", "العيادات") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-surface-50 via-white to-brand-pink-50/20">
      <header className="border-b border-surface-100 bg-white/85 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center">
            <BelamondaLogo size={44} />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `${navLinkBase} ${isActive ? navLinkActive : ""}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")}
              className="hidden sm:inline-flex rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-surface-600 hover:bg-surface-50"
              aria-label="Toggle language"
            >
              {isAr ? "EN" : "ع"}
            </button>
            {auth ? (
              <>
                <button
                  onClick={() => logout()}
                  className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-surface-600 hover:text-red-600 transition-colors"
                >
                  {t("Logout", "تسجيل خروج")}
                </button>
                <Link to="/dashboard" className="btn-primary btn-sm">
                  {t("Dashboard", "لوحة التحكم")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-surface-700 hover:text-brand-pink-600"
                >
                  {t("Sign in", "دخول")}
                </Link>
                <Link to="/signup" className="btn-primary btn-sm">
                  {t("Get started", "ابدأ الآن")}
                </Link>
              </>
            )}
            <button
              className="md:hidden rounded-lg p-2 text-surface-600 hover:bg-surface-100"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-surface-100 bg-white/95 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `${navLinkBase} ${isActive ? navLinkActive : ""}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              <button
                onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")}
                className="rounded-lg px-3 py-2 text-sm font-medium text-surface-600 text-start hover:bg-surface-50"
              >
                {isAr ? "Switch to English" : "التبديل إلى العربية"}
              </button>
              {auth && (
                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 text-start hover:bg-red-50 mt-1 border-t border-surface-100 pt-3"
                >
                  {t("Logout", "تسجيل خروج")}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-surface-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <BelamondaLogo size={40} />
            <p className="mt-3 text-sm text-surface-500 max-w-sm leading-relaxed">
              {t(
                "Curated beauty & wellness memberships and cashback across Kuwait's leading clinics.",
                "باقات وكاش باك الجمال والعناية لدى أرقى عيادات الكويت."
              )}
            </p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
              {t("Explore", "استكشف")}
            </div>
            <ul className="space-y-2 text-sm text-surface-700">
              <li><Link to="/memberships" className="hover:text-brand-pink-600">{t("Memberships", "العضويات")}</Link></li>
              <li><Link to="/clinics" className="hover:text-brand-pink-600">{t("Clinics", "العيادات")}</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-surface-500 mb-3">
              {t("Account", "الحساب")}
            </div>
            <ul className="space-y-2 text-sm text-surface-700">
              <li><Link to="/login" className="hover:text-brand-pink-600">{t("Sign in", "دخول")}</Link></li>
              <li><Link to="/signup" className="hover:text-brand-pink-600">{t("Create account", "إنشاء حساب")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-surface-100 py-5 text-center text-xs text-surface-400">
          © {new Date().getFullYear()} Belamonda — Kuwait
        </div>
      </footer>
    </div>
  );
}
