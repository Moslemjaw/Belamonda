import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import type { RevenueGranularity } from "../../hooks/useApi";
import { ar, rangeForPeriod } from "./finance/shared";
import type { Period } from "./finance/shared";
import { FilterBar } from "./finance/FilterBar";
import { HomeTab } from "./finance/HomeTab";
import { PaymentsTab } from "./finance/PaymentsTab";
import { InstallmentsTab } from "./finance/InstallmentsTab";
import { ReportsTab } from "./finance/ReportsTab";
import { ClinicsTab } from "./finance/ClinicsTab";
import { ProfileTab } from "./finance/ProfileTab";

const PERIODS: { key: Exclude<Period, "custom">; en: string; ar: string }[] = [
  { key: "today", en: "Today", ar: "اليوم" },
  { key: "week", en: "This week", ar: "هذا الأسبوع" },
  { key: "month", en: "This month", ar: "هذا الشهر" },
];

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const [paymentsStatus, setPaymentsStatus] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const initialRange = useMemo(() => rangeForPeriod("month"), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const handlePeriodChange = (p: Exclude<Period, "custom">) => {
    setPeriod(p);
    const r = rangeForPeriod(p);
    setFrom(r.from);
    setTo(r.to);
  };

  // Manually changing the date pickers → switch to "custom" mode
  const handleCustomDateChange = (newFrom: string, newTo: string) => {
    setPeriod("custom");
    setFrom(newFrom);
    setTo(newTo);
  };

  // Chart buckets: days for up to a month, weeks up to ~4 months, then months.
  const granularity: RevenueGranularity = useMemo(() => {
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    if (days <= 31) return "daily";
    if (days <= 120) return "weekly";
    return "monthly";
  }, [from, to]);

  const navigate = (key: string) => {
    if (key !== "payments") setPaymentsStatus("");
    setActiveNav(key);
  };

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: ar() ? "الرئيسية" : "Home" },
    { key: "payments", icon: Icons.wallet, label: ar() ? "المدفوعات" : "Payments" },
    { key: "installments", icon: Icons.calendar, label: ar() ? "الأقساط" : "Installments" },
    { key: "clinics", icon: Icons.clinic, label: ar() ? "العيادات" : "Clinics" },
    { key: "reports", icon: Icons.report, label: t("reports") },
  ];

  return (
    <DashboardShell
      navItems={navItems}
      activeKey={activeNav}
      onNavigate={navigate}
      title={ar() ? "لوحة المالية" : "Finance Dashboard"}
      subtitle={ar() ? "مبيعات الباقات والتحصيل" : "Package sales & collections"}
      headerActions={
        <button
          type="button"
          onClick={() => setShowProfile(true)}
          className="rounded-xl bg-white/70 backdrop-blur-sm border border-white p-1.5 text-surface-700 hover:bg-white hover:text-brand-pink-600 hover:shadow-sm transition-all"
          aria-label={ar() ? "ملفي" : "My profile"}
          title={ar() ? "ملفي" : "My profile"}
        >
          {Icons.profile}
        </button>
      }
    >
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 lg:pb-0">
            {PERIODS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePeriodChange(p.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${period === p.key ? "bg-surface-900 text-white border-surface-900" : "bg-white text-surface-600 border-surface-200 hover:border-surface-400"}`}
              >
                {ar() ? p.ar : p.en}
              </button>
            ))}
            <span className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border ${period === "custom" ? "bg-surface-900 text-white border-surface-900" : "bg-white text-surface-400 border-surface-200"}`}>
              {ar() ? "مخصص" : "Custom"}
            </span>
          </div>
          <div className="lg:ml-auto rtl:lg:ml-0 rtl:lg:mr-auto">
            <FilterBar from={from} to={to} onCustomDateChange={handleCustomDateChange} />
          </div>
        </div>

        {activeNav === "home" && (
          <HomeTab
            from={from} to={to} granularity={granularity}
            onOpenInstallments={() => navigate("installments")}
            onOpenPendingPayments={() => { setPaymentsStatus("payment_pending"); setActiveNav("payments"); }}
          />
        )}
        {activeNav === "payments" && <PaymentsTab from={from} to={to} initialStatus={paymentsStatus} />}
        {activeNav === "installments" && <InstallmentsTab from={from} to={to} />}
        {activeNav === "clinics" && <ClinicsTab from={from} to={to} />}
        {activeNav === "reports" && <ReportsTab from={from} to={to} />}
      </div>

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setShowProfile(false)}>
          <div className="w-full max-w-2xl my-8 rounded-2xl bg-surface-50 p-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button type="button" className="btn-ghost text-xs border border-surface-200 px-3 py-1" onClick={() => setShowProfile(false)}>
                {ar() ? "إغلاق" : "Close"}
              </button>
            </div>
            <ProfileTab />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
