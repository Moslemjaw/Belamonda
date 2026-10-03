import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { ar, rangeForPeriod, CustomersTab } from "./finance/shared";
import type { Period } from "./finance/shared";
import { FilterBar } from "./finance/FilterBar";
import { OverviewTab } from "./finance/OverviewTab";
import { PaymentsTab } from "./finance/PaymentsTab";
import { InstallmentsTab } from "./finance/InstallmentsTab";
import { AnalyticsTab } from "./finance/AnalyticsTab";
import { ReportsTab } from "./finance/ReportsTab";
import { ClinicsTab } from "./finance/ClinicsTab";
import { ReliefTab } from "./finance/ReliefTab";
import { ProfileTab } from "./finance/ProfileTab";
import { ManualEntriesTab } from "./finance/ManualEntriesTab";
import { EFormsViewer } from "./finance/EFormsViewer";

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const [period, setPeriod] = useState<Period>("monthly");
  const initialRange = useMemo(() => rangeForPeriod("monthly"), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  // Clicking a period button → recalculate the dates from today
  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    if (p !== "custom") {
      const r = rangeForPeriod(p);
      setFrom(r.from);
      setTo(r.to);
    }
  };

  // Manually changing the date pickers → switch to "custom" mode
  const handleCustomDateChange = (newFrom: string, newTo: string) => {
    setPeriod("custom");
    setFrom(newFrom);
    setTo(newTo);
  };

  // Determine the timeseries granularity based on the active period
  const chartPeriod: "daily" | "weekly" | "monthly" | "yearly" = useMemo(() => {
    if (period === "daily") return "daily";
    if (period === "weekly") return "weekly";
    if (period === "yearly") return "yearly";
    if (period === "all" || period === "custom") {
      // Auto-detect best granularity based on date range span
      const diffMs = new Date(to).getTime() - new Date(from).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays <= 31) return "daily";
      if (diffDays <= 120) return "weekly";
      if (diffDays <= 730) return "monthly";
      return "yearly";
    }
    return "monthly";
  }, [period, from, to]);

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: ar() ? "نظرة عامة" : "Overview" },
    { key: "payments", icon: Icons.wallet, label: ar() ? "المدفوعات" : "Payments" },
    { key: "installments", icon: Icons.calendar, label: ar() ? "الأقساط" : "Installments" },
    { key: "customers", icon: Icons.profile, label: ar() ? "العملاء" : "Customers" },
    { key: "eforms", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, label: ar() ? "النماذج (EForms)" : "EForms" },
    { key: "analytics", icon: Icons.chart, label: ar() ? "تحليلات" : "Analytics" },
    { key: "clinics", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>, label: ar() ? "العيادات" : "Clinics" },
    { key: "reports", icon: Icons.report, label: t("reports") },
    { key: "manual", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>, label: ar() ? "قيود يدوية" : "Manual Entries" },
    { key: "relief", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>, label: ar() ? "الاستردادات" : "Relief" },
    { key: "profile", icon: Icons.profile, label: ar() ? "ملفي" : "Profile" },
  ];

  return (
    <DashboardShell
      navItems={navItems}
      activeKey={activeNav}
      onNavigate={setActiveNav}
      title={ar() ? "لوحة المالية" : "Finance Dashboard"}
      subtitle={ar() ? "الإيرادات، الأرباح، والتحليلات" : "Revenue, Profit & Analytics"}
    >
      <div className="space-y-5 animate-fade-in">
        {activeNav !== "profile" && (
          <FilterBar
            from={from} to={to}
            onCustomDateChange={handleCustomDateChange}
          />
        )}

        {activeNav === "home" && <OverviewTab period={chartPeriod} from={from} to={to} />}
        {activeNav === "payments" && <PaymentsTab from={from} to={to} />}
        {activeNav === "installments" && <InstallmentsTab from={from} to={to} />}
        {activeNav === "customers" && <CustomersTab from={from} to={to} />}
        {activeNav === "analytics" && <AnalyticsTab from={from} to={to} />}
        {activeNav === "clinics" && <ClinicsTab from={from} to={to} />}
        {activeNav === "reports" && <ReportsTab from={from} to={to} />}
        {activeNav === "manual" && <ManualEntriesTab from={from} to={to} />}
        {activeNav === "eforms" && <EFormsViewer from={from} to={to} />}
        {activeNav === "relief" && <ReliefTab from={from} to={to} />}
        {activeNav === "profile" && <ProfileTab />}
      </div>
    </DashboardShell>
  );
}
