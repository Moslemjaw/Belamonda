import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useApi, useFinanceSnapshot } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { getFinancialLedger, getCashbackLedger } from "../../lib/offerSystem";

const ar = () => i18n.language === "ar";

function TransactionLedger() {
  const [filter, setFilter] = useState("all");
  const ledger = getFinancialLedger().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = filter === "all" ? ledger : ledger.filter(e => e.type === filter);

  const typeLabel = (t: string) => {
    const map: Record<string, [string, string, string]> = {
      offer_purchase: ["Offer Purchase", "شراء عرض", "bg-brand-pink-50 text-brand-pink-700"],
      installment: ["Installment", "قسط", "bg-blue-50 text-blue-700"],
      deposit: ["Deposit", "عربون", "bg-purple-50 text-purple-700"],
      session_payment: ["Session", "جلسة", "bg-emerald-50 text-emerald-700"],
      cashback_usage: ["Cashback", "كاش باك", "bg-amber-50 text-amber-700"],
      clinic_change_fee: ["Clinic Change", "تغيير عيادة", "bg-red-50 text-red-700"],
      cashback_activation: ["CB Activation", "تفعيل كاش باك", "bg-indigo-50 text-indigo-700"],
    };
    const [en, arL, cls] = map[t] || [t, t, "bg-surface-100 text-surface-600"];
    return <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${cls}`}>{ar() ? arL : en}</span>;
  };

  const totals = {
    revenue: ledger.filter(e => ["offer_purchase","installment","deposit","session_payment","clinic_change_fee","cashback_activation"].includes(e.type)).reduce((s, e) => s + e.amount, 0),
    cashbackCredited: getCashbackLedger().filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0),
    cashbackUsed: getCashbackLedger().filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0),
    clinicFees: ledger.filter(e => e.type === "clinic_change_fee").reduce((s, e) => s + e.amount, 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: ar() ? "إجمالي الإيرادات" : "Total Revenue", value: `${totals.revenue.toFixed(3)} KWD`, color: "text-emerald-600" },
          { label: ar() ? "كاش باك ممنوح" : "CB Credited", value: `${totals.cashbackCredited.toFixed(3)} KWD`, color: "text-brand-pink-600" },
          { label: ar() ? "كاش باك مستخدم" : "CB Used", value: `${totals.cashbackUsed.toFixed(3)} KWD`, color: "text-amber-600" },
          { label: ar() ? "رسوم تغيير" : "Clinic Fees", value: `${totals.clinicFees.toFixed(3)} KWD`, color: "text-red-600" },
        ].map(k => (
          <div key={k.label} className="stat-card"><div className="stat-label">{k.label}</div><div className={`stat-value ${k.color}`}>{k.value}</div></div>
        ))}
      </div>
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-surface-900">{ar() ? "سجل المعاملات" : "Transaction Ledger"}</h3>
          <select className="select-field w-48" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">{ar() ? "الكل" : "All"}</option>
            <option value="offer_purchase">{ar() ? "شراء" : "Purchases"}</option>
            <option value="installment">{ar() ? "أقساط" : "Installments"}</option>
            <option value="session_payment">{ar() ? "جلسات" : "Sessions"}</option>
            <option value="cashback_usage">{ar() ? "كاش باك" : "Cashback"}</option>
            <option value="clinic_change_fee">{ar() ? "تغيير عيادة" : "Clinic Change"}</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center text-surface-400 py-12">{ar() ? "لا توجد معاملات بعد" : "No transactions yet"}</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-200">
            <table className="data-table">
              <thead><tr><th>{ar() ? "التاريخ" : "Date"}</th><th>{ar() ? "العميل" : "User"}</th><th>{ar() ? "النوع" : "Type"}</th><th>{ar() ? "المبلغ" : "Amount"}</th><th>{ar() ? "الوصف" : "Description"}</th></tr></thead>
              <tbody>
                {filtered.slice(0, 50).map(e => (
                  <tr key={e.id}>
                    <td className="text-xs text-surface-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td className="font-medium text-sm">{e.userId}</td>
                    <td>{typeLabel(e.type)}</td>
                    <td className={`font-bold ${e.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{e.amount >= 0 ? '+' : ''}{e.amount.toFixed(3)} KWD</td>
                    <td className="text-xs text-surface-500 max-w-[200px] truncate">{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LiabilityTracker({ data }: { data: any }) {
  const cbLedger = getCashbackLedger();
  const totalCredited = cbLedger.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalUsed = cbLedger.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
  const locked = data?.totalCashbackLocked || totalCredited.toFixed(3);
  const unlocked = data?.totalCashbackUnlocked || (totalCredited - totalUsed).toFixed(3);
  const utilized = data?.totalCashbackUtilized || totalUsed.toFixed(3);
  const netLiability = (parseFloat(locked) + parseFloat(unlocked) - parseFloat(utilized)).toFixed(3);

  return (
    <div className="card-elevated p-6">
      <h3 className="text-base font-bold text-surface-900 mb-5">{ar() ? "متتبع التزامات الكاش باك" : "Cashback Liability Tracker"}</h3>
      <div className="grid gap-6 sm:grid-cols-4">
        {[
          { label: ar() ? "إجمالي مقفل" : "Total Locked", value: locked, color: "bg-surface-100 text-surface-700" },
          { label: ar() ? "إجمالي متاح" : "Total Unlocked", value: unlocked, color: "bg-brand-pink-50 text-brand-pink-700" },
          { label: ar() ? "إجمالي مستخدم" : "Total Utilized", value: utilized, color: "bg-emerald-50 text-emerald-700" },
          { label: ar() ? "صافي الالتزام" : "Net Liability", value: netLiability, color: "bg-amber-50 text-amber-700" },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl p-5 text-center ${c.color}`}>
            <div className="text-xs font-medium opacity-70">{c.label}</div>
            <div className="text-xl font-bold mt-1">{c.value}</div>
            <div className="text-xs opacity-60 mt-0.5">{ar() ? "د.ك" : "KWD"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportGenerator() {
  const { getAuthHeader } = useAuth();
  const [generating, setGenerating] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const generate = async (type: string) => {
    setGenerating(type);
    try {
      const r = await apiFetch("/reporting/finance/reports", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ type, from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() }) });
      setResult(r);
    } catch (e: any) { alert(e.message); }
    finally { setGenerating(null); }
  };

  return (
    <div className="card-elevated p-5">
      <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "التقارير المالية" : "Financial Reports"}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { type: "daily_summary", name: ar() ? "ملخص يومي" : "Daily Summary", icon: "📋" },
          { type: "weekly_pl", name: ar() ? "ربح وخسارة أسبوعي" : "Weekly P&L", icon: "📊" },
          { type: "monthly_cashback_liability", name: ar() ? "التزامات الكاش باك" : "Cashback Liability", icon: "💳" },
          { type: "yearly_revenue", name: ar() ? "إيرادات شهرية" : "Monthly Revenue", icon: "📈" },
        ].map(r => (
          <button key={r.type} className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white p-4 hover:shadow-card transition-all text-start w-full" onClick={() => generate(r.type)} disabled={generating === r.type}>
            <span className="text-2xl">{r.icon}</span>
            <div className="flex-1"><div className="text-sm font-medium text-surface-800">{r.name}</div><div className="text-xs text-surface-400">{generating === r.type ? "..." : (ar() ? "إنشاء" : "Generate")}</div></div>
          </button>
        ))}
      </div>
      {result && <pre className="mt-4 rounded-xl bg-surface-50 p-4 text-xs overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function WalletAdjustment() {
  const { getAuthHeader } = useAuth();
  const [form, setForm] = useState({ userId: "", amountKwd: "0.000", reason: "" });
  const [result, setResult] = useState<string | null>(null);

  const adjust = async () => {
    try {
      await apiFetch("/wallet/admin/adjust", { method: "POST", headers: getAuthHeader(), body: JSON.stringify(form) });
      setResult(ar() ? "✅ تم التعديل بنجاح" : "✅ Adjustment applied");
    } catch (e: any) { setResult(`❌ ${e.message}`); }
  };

  return (
    <div className="card-elevated p-5">
      <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "تعديل المحفظة" : "Wallet Adjustment"}</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className="text-xs font-medium text-surface-500">{ar() ? "معرف العميلة" : "User ID"}</label><input className="input-field mt-1" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} placeholder="cust1" /></div>
        <div><label className="text-xs font-medium text-surface-500">{ar() ? "المبلغ" : "Amount (KWD)"}</label><input className="input-field mt-1" value={form.amountKwd} onChange={e => setForm({ ...form, amountKwd: e.target.value })} /></div>
        <div><label className="text-xs font-medium text-surface-500">{ar() ? "السبب" : "Reason"}</label><input className="input-field mt-1" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
        <div className="flex items-end"><button className="btn-primary btn-sm" onClick={adjust}>{ar() ? "تطبيق" : "Apply"}</button></div>
      </div>
      {result && <div className="mt-3 rounded-xl bg-surface-50 p-3 text-sm">{result}</div>}
    </div>
  );
}

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const { data: snapshotData } = useFinanceSnapshot();
  const snapshot = snapshotData?.snapshot;

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "ledger", icon: Icons.clipboard, label: ar() ? "سجل المعاملات" : "Ledger" },
    { key: "cashback", icon: Icons.wallet, label: ar() ? "كاش باك" : "Cashback" },
    { key: "adjustments", icon: Icons.cash, label: ar() ? "تعديلات" : "Adjustments" },
    { key: "reports", icon: Icons.report, label: t("reports") },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة المالية" : "Finance Dashboard"} subtitle={ar() ? "الإيرادات والالتزامات" : "Revenue & liability tracking"}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: ar() ? "إيرادات" : "Revenue", value: snapshot?.totalRevenue || "—", color: "text-emerald-600" },
                { label: ar() ? "مدفوعات معلقة" : "Pending", value: `${snapshot?.pendingPaymentsCount || 0}`, color: "text-amber-600" },
                { label: ar() ? "جلسات اليوم" : "Today Sessions", value: `${snapshot?.sessionsToday || 0}`, color: "" },
                { label: ar() ? "جلسات الشهر" : "Monthly Sessions", value: `${snapshot?.sessionsThisMonth || 0}`, color: "" },
              ].map(k => (
                <div key={k.label} className="stat-card"><div className="stat-label">{k.label}</div><div className={`stat-value ${k.color}`}>{k.value}</div></div>
              ))}
            </div>
            <LiabilityTracker data={snapshot} />
            <ReportGenerator />
          </>
        )}
        {activeNav === "ledger" && <TransactionLedger />}
        {activeNav === "cashback" && <LiabilityTracker data={snapshot} />}
        {activeNav === "adjustments" && <WalletAdjustment />}
        {activeNav === "reports" && <ReportGenerator />}
      </div>
    </DashboardShell>
  );
}
