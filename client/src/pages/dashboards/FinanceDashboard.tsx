import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import {
  useFinanceSnapshot,
  usePaymentsBreakdown,
  useFinanceTimeseries,
  useRevenueByOffer,
  useRevenueByUser,
  useRevenueByReferral,
  useFinanceInstallments,
  useClinicSummaries,
  useClinicDetail,
  type EnrichedPaymentItem,
} from "../../hooks/useApi";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

// ===========================================================================
// Helpers
// ===========================================================================

type Period = "daily" | "weekly" | "monthly" | "yearly";

function isoDate(d: Date) {
  return d.toISOString();
}

function rangeForPeriod(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  if (period === "daily") {
    from.setUTCDate(from.getUTCDate() - 30); // last 30 days
  } else if (period === "weekly") {
    from.setUTCDate(from.getUTCDate() - 7 * 12); // last 12 weeks
  } else if (period === "monthly") {
    from.setUTCMonth(from.getUTCMonth() - 12); // last 12 months
  } else {
    from.setUTCFullYear(from.getUTCFullYear() - 5); // last 5 years
  }
  return { from: isoDate(from), to: isoDate(to) };
}

function fmt(n: number) {
  if (Number.isNaN(n)) return "0.000";
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function parseKwd(s?: string | null) {
  if (!s) return 0;
  return parseFloat(s) || 0;
}

const COLORS = {
  pink: "#ec4899",
  emerald: "#10b981",
  indigo: "#6366f1",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#a855f7",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  surface: "#94a3b8",
};
const PIE_COLORS = [COLORS.pink, COLORS.emerald, COLORS.indigo, COLORS.amber, COLORS.purple, COLORS.cyan, COLORS.blue, COLORS.surface];

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer", cash: "Cash", pos: "POS",
  card_mock: "Card (Online)", enet: "ENET", wallet: "Wallet", other: "Other",
};
const PURPOSE_LABELS: Record<string, string> = {
  enrollment_full: "Membership", installment: "Installment",
  deposit: "Deposit", deposit_balance: "Deposit Balance",
  enrollment_enet: "ENET Enrollment", session_payment: "Session",
};
const METHOD_COLORS: Record<string, string> = {
  bank_transfer: "bg-blue-50 text-blue-700 border-blue-200",
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pos: "bg-purple-50 text-purple-700 border-purple-200",
  card_mock: "bg-indigo-50 text-indigo-700 border-indigo-200",
  enet: "bg-brand-pink-50 text-brand-pink-700 border-brand-pink-200",
  wallet: "bg-amber-50 text-amber-700 border-amber-200",
  other: "bg-surface-100 text-surface-600 border-surface-200",
};
const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-surface-100 text-surface-500",
};

// ===========================================================================
// Filter Bar (Period + custom date range, used at top of dashboard)
// ===========================================================================

function FilterBar({
  period, onPeriodChange,
  from, to, onFromChange, onToChange,
}: {
  period: Period;
  onPeriodChange: (p: Period) => void;
  from: string; to: string;
  onFromChange: (s: string) => void;
  onToChange: (s: string) => void;
}) {
  const periods: { key: Period; label: string }[] = [
    { key: "daily", label: ar() ? "يومي" : "Daily" },
    { key: "weekly", label: ar() ? "أسبوعي" : "Weekly" },
    { key: "monthly", label: ar() ? "شهري" : "Monthly" },
    { key: "yearly", label: ar() ? "سنوي" : "Yearly" },
  ];
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-surface-200 bg-white p-3 shadow-sm">
      <div className="inline-flex rounded-xl bg-surface-100 p-1">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => onPeriodChange(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${period === p.key ? "bg-white text-brand-pink-600 shadow-sm" : "text-surface-600 hover:text-surface-900"}`}
          >{p.label}</button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <label className="text-surface-500 font-medium">{ar() ? "من" : "From"}</label>
        <input type="date" className="input-field text-xs py-1.5 h-auto"
          value={from.slice(0, 10)}
          onChange={e => {
            const d = new Date(e.target.value); d.setUTCHours(0,0,0,0);
            onFromChange(isoDate(d));
          }} />
        <label className="text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
        <input type="date" className="input-field text-xs py-1.5 h-auto"
          value={to.slice(0, 10)}
          onChange={e => {
            const d = new Date(e.target.value); d.setUTCHours(23,59,59,999);
            onToChange(isoDate(d));
          }} />
      </div>
    </div>
  );
}

// ===========================================================================
// KPI Card
// ===========================================================================

function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon?: string }) {
  // Map text-* color to brand accent dot
  const dotCls =
    color.includes("emerald") ? "bg-emerald-500" :
    color.includes("pink")    ? "bg-brand-pink-500" :
    color.includes("amber")   ? "bg-amber-500" :
    color.includes("indigo")  ? "bg-indigo-500" :
    color.includes("blue")    ? "bg-blue-500" :
    color.includes("red")     ? "bg-red-500" :
    color.includes("rose")    ? "bg-rose-500" :
    color.includes("violet")  ? "bg-violet-500" :
                                "bg-brand-pink-500";
  return (
    <div className="relative bg-white border border-surface-100 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-6 rounded-full ${dotCls}`} />
          <span className="text-[11px] uppercase tracking-wider text-surface-500 font-bold">{label}</span>
        </div>
        {icon && <span className="text-xl opacity-80 shrink-0">{icon}</span>}
      </div>
      <div className={`mt-3 text-2xl sm:text-3xl font-black leading-none ${color}`}>{value}</div>
      {sub && <div className="mt-2 text-[11px] text-surface-500 font-medium">{sub}</div>}
    </div>
  );
}

// ===========================================================================
// HOME / OVERVIEW TAB — KPIs, revenue trend, breakdowns
// ===========================================================================

function OverviewTab({ period, from, to }: { period: Period; from: string; to: string }) {
  const { data: snapshotData, loading: snapLoading } = useFinanceSnapshot({ from, to });
  const { data: ts, loading: tsLoading } = useFinanceTimeseries(period, { from, to });
  const { data: breakdown } = usePaymentsBreakdown({ from, to });

  const snapshot = snapshotData?.snapshot;
  const points = ts?.points ?? [];
  const totals = ts?.totals;

  const revenue = snapshot?.revenueKwd ?? totals?.revenueKwd ?? "0.000";
  const profit = snapshot?.profitKwd ?? totals?.profitKwd ?? "0.000";
  const cashbackApplied = snapshot?.cashbackAppliedKwd ?? totals?.cashbackKwd ?? "0.000";
  const cashbackLiability = snapshot?.cashback?.netLiabilityKwd ??
    fmt(parseKwd(snapshot?.totalCashbackLocked) + parseKwd(snapshot?.totalCashbackUnlocked) - parseKwd(snapshot?.totalCashbackUtilized));
  const margin = parseKwd(revenue) > 0 ? (parseKwd(profit) / parseKwd(revenue)) * 100 : 0;

  const chartData = useMemo(() => points.map(p => ({
    bucket: p.bucket,
    Revenue: parseKwd(p.revenueKwd),
    Profit: parseKwd(p.profitKwd),
    Cashback: parseKwd(p.cashbackKwd),
  })), [points]);

  const methodPie = useMemo(() => (breakdown?.byMethod ?? []).map(m => ({
    name: METHOD_LABELS[m.method] ?? m.method,
    value: parseKwd(m.totalKwd),
  })), [breakdown]);

  const purposeData = useMemo(() => (breakdown?.byPurpose ?? []).map(p => ({
    name: PURPOSE_LABELS[p.purpose] ?? p.purpose,
    value: parseKwd(p.totalKwd),
  })), [breakdown]);

  const clinicData = useMemo(() => (breakdown?.byClinics ?? []).slice(0, 8).map(c => ({
    name: ar() ? (c.clinicNameAr || c.clinicNameEn) : (c.clinicNameEn || c.clinicNameAr),
    Revenue: parseKwd(c.totalKwd),
  })), [breakdown]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={ar() ? "إجمالي الإيرادات" : "Total Revenue"} value={`${revenue} KWD`} sub={`${totals?.transactions ?? 0} ${ar() ? "معاملة" : "transactions"}`} color="text-emerald-600" icon="💰" />
        <KpiCard label={ar() ? "صافي الربح المقدر" : "Estimated Profit"} value={`${profit} KWD`} sub={`${margin.toFixed(1)}% ${ar() ? "هامش" : "margin"}`} color="text-brand-pink-600" icon="📈" />
        <KpiCard label={ar() ? "الكاش باك المطبق" : "Cashback Applied"} value={`${cashbackApplied} KWD`} sub={ar() ? "من الإيرادات" : "off revenue"} color="text-amber-600" icon="🎁" />
        <KpiCard label={ar() ? "التزام الكاش باك" : "Cashback Liability"} value={`${cashbackLiability} KWD`} sub={ar() ? "صافي مستحق" : "net outstanding"} color="text-indigo-600" icon="⚖️" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={ar() ? "مدفوعات معلقة" : "Pending Payments"} value={`${snapshot?.pendingPaymentsKwd ?? "0.000"} KWD`} sub={`${snapshot?.pendingPaymentsCount ?? 0} ${ar() ? "طلب" : "requests"}`} color="text-amber-600" />
        <KpiCard label={ar() ? "إيرادات العضويات" : "Membership Revenue"} value={`${breakdown?.summary?.membershipRevenueKwd ?? "0.000"} KWD`} color="text-brand-pink-600" />
        <KpiCard label={ar() ? "إيرادات الجلسات" : "Session Revenue"} value={`${breakdown?.summary?.sessionRevenueKwd ?? "0.000"} KWD`} color="text-indigo-600" />
        <KpiCard label={ar() ? "جلسات اليوم / الشهر" : "Sessions Today / Month"} value={`${snapshot?.sessionsToday ?? 0} / ${snapshot?.sessionsThisMonth ?? 0}`} color="text-blue-600" />
      </div>

      {/* Revenue Trend Chart */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "تطور الإيرادات والربح" : "Revenue & Profit Trend"}</h3>
            <p className="text-xs text-surface-500 mt-0.5">{ar() ? `مجمعة حسب ${period === "daily" ? "اليوم" : period === "weekly" ? "الأسبوع" : period === "monthly" ? "الشهر" : "السنة"}` : `Bucketed by ${period}`}</p>
          </div>
          <div className="text-xs text-surface-500">{points.length} {ar() ? "نقطة" : "points"}</div>
        </div>
        {tsLoading && points.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading…"}</div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات في هذه الفترة" : "No data in this range"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.pink} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={COLORS.pink} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: number) => `${fmt(v)} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Revenue" stroke={COLORS.emerald} strokeWidth={2} fill="url(#revFill)" />
              <Area type="monotone" dataKey="Profit" stroke={COLORS.pink} strokeWidth={2} fill="url(#profitFill)" />
              <Line type="monotone" dataKey="Cashback" stroke={COLORS.amber} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdowns: Method donut + Purpose bars */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card-elevated p-5 border border-surface-200 shadow-sm">
          <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "حسب طريقة الدفع" : "By Payment Method"}</h3>
          {methodPie.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={methodPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {methodPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${fmt(v)} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card-elevated p-5 border border-surface-200 shadow-sm">
          <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "حسب نوع الدفع" : "By Payment Type"}</h3>
          {purposeData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات" : "No data"}</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={purposeData} layout="vertical" margin={{ top: 5, right: 16, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" width={80} />
                <Tooltip formatter={(v: number) => `${fmt(v)} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="value" fill={COLORS.pink} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue by Clinic */}
      {clinicData.length > 0 && (
        <div className="card-elevated p-5 border border-surface-200 shadow-sm">
          <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "الإيرادات حسب العيادة" : "Revenue by Clinic"}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, clinicData.length * 36)}>
            <BarChart data={clinicData} layout="vertical" margin={{ top: 5, right: 16, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" width={100} />
              <Tooltip formatter={(v: number) => `${fmt(v)} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Bar dataKey="Revenue" fill={COLORS.indigo} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cashback Wallet Liability summary */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "متتبع التزامات الكاش باك" : "Cashback Wallet Liability"}</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: ar() ? "إجمالي مقفل" : "Locked", value: snapshot?.totalCashbackLocked ?? "0.000", color: "bg-surface-100 text-surface-700" },
            { label: ar() ? "إجمالي متاح" : "Unlocked", value: snapshot?.totalCashbackUnlocked ?? "0.000", color: "bg-brand-pink-50 text-brand-pink-700" },
            { label: ar() ? "إجمالي مستخدم" : "Utilized", value: snapshot?.totalCashbackUtilized ?? "0.000", color: "bg-emerald-50 text-emerald-700" },
            { label: ar() ? "صافي الالتزام" : "Net Liability", value: cashbackLiability, color: "bg-amber-50 text-amber-700" },
          ].map(c => (
            <div key={c.label} className={`rounded-2xl p-4 text-center ${c.color}`}>
              <div className="text-xs font-medium opacity-70">{c.label}</div>
              <div className="text-lg font-bold mt-1">{c.value}</div>
              <div className="text-[10px] opacity-60 mt-0.5">KWD</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// PAYMENTS TAB — full ledger with filters
// ===========================================================================

function PaymentsTab({ from, to }: { from: string; to: string }) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterPurpose, setFilterPurpose] = useState("");

  const { data, loading } = usePaymentsBreakdown({
    status: filterStatus || undefined,
    method: filterMethod || undefined,
    purpose: filterPurpose || undefined,
    from, to,
  });

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={ar() ? "المحصّل" : "Collected"} value={`${summary?.totalCollectedKwd ?? "0.000"} KWD`} color="text-emerald-600" />
        <KpiCard label={ar() ? "العضويات" : "Memberships"} value={`${summary?.membershipRevenueKwd ?? "0.000"} KWD`} color="text-brand-pink-600" />
        <KpiCard label={ar() ? "الجلسات" : "Sessions"} value={`${summary?.sessionRevenueKwd ?? "0.000"} KWD`} color="text-indigo-600" />
        <KpiCard label={ar() ? "كاش باك" : "Cashback"} value={`${summary?.cashbackAppliedKwd ?? "0.000"} KWD`} color="text-amber-600" />
        <KpiCard label={ar() ? "صافي الربح" : "Net Profit"} value={`${summary?.profitKwd ?? "0.000"} KWD`} color="text-emerald-700" />
      </div>

      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payments Ledger"} <span className="text-xs text-surface-400 font-medium">({items.length})</span></h3>
          <div className="flex flex-wrap gap-2">
            <select className="select-field text-xs py-1.5 h-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{ar() ? "كل الحالات" : "All Statuses"}</option>
              <option value="completed">{ar() ? "مكتمل" : "Completed"}</option>
              <option value="pending">{ar() ? "معلق" : "Pending"}</option>
              <option value="failed">{ar() ? "فشل" : "Failed"}</option>
              <option value="refunded">{ar() ? "مسترد" : "Refunded"}</option>
            </select>
            <select className="select-field text-xs py-1.5 h-auto" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
              <option value="">{ar() ? "كل الطرق" : "All Methods"}</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="select-field text-xs py-1.5 h-auto" value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}>
              <option value="">{ar() ? "كل الأنواع" : "All Types"}</option>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "لا توجد مدفوعات في هذه الفترة" : "No payments found in this range"}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-xs">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "المستخدم" : "User"}</th>
                  <th>{ar() ? "العرض" : "Offer"}</th>
                  <th>{ar() ? "العيادة" : "Clinic"}</th>
                  <th>{ar() ? "الطريقة" : "Method"}</th>
                  <th>{ar() ? "النوع" : "Type"}</th>
                  <th className="text-right">{ar() ? "المبلغ" : "Amount"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p: EnrichedPaymentItem) => (
                  <tr key={p.id}>
                    <td className="font-mono text-[10px] text-surface-500 max-w-[80px] truncate">{p.userId}</td>
                    <td className="max-w-[140px]">
                      <div className="font-medium text-surface-800 truncate">{p.offerName || "—"}</div>
                      {p.membershipType && <div className="text-[10px] text-surface-400 capitalize">{p.membershipType}</div>}
                    </td>
                    <td className="text-surface-600">{p.clinicNameEn || "—"}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${METHOD_COLORS[p.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                        {METHOD_LABELS[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="text-surface-600">{PURPOSE_LABELS[p.purpose ?? ""] ?? (p.purpose || "—")}</td>
                    <td className="text-right font-bold text-surface-900">{p.amountKwd}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[p.status] ?? "bg-surface-100 text-surface-500"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="text-surface-500 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
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

// ===========================================================================
// INSTALLMENTS TAB — real data from UserOffer.installmentSchedule
// ===========================================================================

function InstallmentsTab({ from, to }: { from: string; to: string }) {
  const [statusFilter, setStatusFilter] = useState<"" | "late" | "upcoming">("");
  const { data, loading } = useFinanceInstallments({ from, to });
  const summary = data?.summary;
  const items = (data?.items ?? []).filter(i => !statusFilter || i.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={ar() ? "أقساط مدفوعة" : "Paid Installments"} value={`${summary?.paidKwd ?? "0.000"} KWD`} color="text-emerald-600" />
        <KpiCard label={ar() ? "أقساط قادمة" : "Upcoming"} value={`${summary?.upcomingKwd ?? "0.000"} KWD`} sub={`${summary?.upcomingCount ?? 0} ${ar() ? "قسط" : "items"}`} color="text-amber-600" />
        <KpiCard label={ar() ? "أقساط متأخرة" : "Late"} value={`${summary?.lateKwd ?? "0.000"} KWD`} sub={`${summary?.lateCount ?? 0} ${ar() ? "قسط" : "items"}`} color="text-red-600" />
        <KpiCard label={ar() ? "الإيرادات المتوقعة" : "Forecast Revenue"} value={`${summary?.forecastKwd ?? "0.000"} KWD`} color="text-brand-pink-600" />
      </div>

      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-surface-900">{ar() ? "متتبع الأقساط" : "Installment Tracker"}</h3>
          <select className="select-field text-xs py-1.5 h-auto w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{ar() ? "الكل" : "All"}</option>
            <option value="late">{ar() ? "متأخرة" : "Late"}</option>
            <option value="upcoming">{ar() ? "قادمة" : "Upcoming"}</option>
          </select>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "لا توجد أقساط" : "No installments"}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-sm">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "العميل" : "Customer"}</th>
                  <th>{ar() ? "الباقة" : "Package"}</th>
                  <th className="text-center">#</th>
                  <th className="text-right">{ar() ? "المبلغ" : "Amount"}</th>
                  <th>{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={`${i.userOfferId}-${i.installmentNumber}-${idx}`}>
                    <td className="font-mono text-xs text-surface-700">{i.userId}</td>
                    <td className="font-medium">{i.offerName}</td>
                    <td className="text-center text-surface-500">{i.installmentNumber}</td>
                    <td className="text-right font-bold text-surface-900">{i.amountKwd} KWD</td>
                    <td className="text-surface-600">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${i.status === "late" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                        {i.status === "late" ? (ar() ? "متأخر" : "Late") : (ar() ? "قادم" : "Upcoming")}
                      </span>
                    </td>
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

// ===========================================================================
// CUSTOMERS TAB — top customers by LTV
// ===========================================================================

function CustomersTab({ from, to }: { from: string; to: string }) {
  const [search, setSearch] = useState("");
  const { data, loading } = useRevenueByUser({ from, to });
  const items = (data?.items ?? []).filter(u =>
    !search ||
    u.userId.toLowerCase().includes(search.toLowerCase()) ||
    (u.displayName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (u.phone ?? "").includes(search)
  );

  const totalLtv = items.reduce((sum, u) => sum + parseKwd(u.ltvKwd), 0);
  const avgLtv = items.length > 0 ? totalLtv / items.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label={ar() ? "عدد العملاء" : "Customers"} value={String(items.length)} color="text-indigo-600" />
        <KpiCard label={ar() ? "إجمالي LTV" : "Total LTV"} value={`${fmt(totalLtv)} KWD`} color="text-emerald-600" />
        <KpiCard label={ar() ? "متوسط LTV" : "Avg LTV"} value={`${fmt(avgLtv)} KWD`} color="text-brand-pink-600" />
      </div>

      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-base font-bold text-surface-900">{ar() ? "أفضل العملاء" : "Top Customers by Revenue"}</h3>
          <div className="relative">
            <input type="text" placeholder={ar() ? "ابحث عن عميل..." : "Search customer..."}
              className="input-field pl-10 w-full sm:w-64 text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "لا يوجد عملاء" : "No customers"}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-sm">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "العميل" : "Customer"}</th>
                  <th className="text-center">{ar() ? "المشتريات" : "Purchases"}</th>
                  <th className="text-right">{ar() ? "القيمة الدائمة" : "LTV"}</th>
                  <th className="text-right">{ar() ? "كاش باك مستخدم" : "Cashback Used"}</th>
                  <th className="text-center">{ar() ? "معلق" : "Pending"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(u => (
                  <tr key={u.userId}>
                    <td>
                      <div className="font-bold text-surface-900">{u.displayName}</div>
                      <div className="text-xs text-surface-500 font-mono">{u.userId}</div>
                      {(u.email || u.phone) && <div className="text-[10px] text-surface-400">{u.email || u.phone}</div>}
                    </td>
                    <td className="text-center">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold">{u.purchasesCount}</span>
                    </td>
                    <td className="text-right font-bold text-emerald-700">{u.ltvKwd} KWD</td>
                    <td className="text-right text-amber-600 font-medium">{u.cashbackUsedKwd} KWD</td>
                    <td className="text-center">
                      {u.pendingPayments > 0 ? (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md text-xs font-bold">{u.pendingPayments}</span>
                      ) : (
                        <span className="text-surface-400 text-xs">—</span>
                      )}
                    </td>
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

// ===========================================================================
// ANALYTICS TAB — by-offer + by-referral
// ===========================================================================

function AnalyticsTab({ from, to }: { from: string; to: string }) {
  const { data: offers, loading: offersLoading } = useRevenueByOffer({ from, to });
  const { data: referrals, loading: refLoading } = useRevenueByReferral({ from, to });

  const offerChart = useMemo(() => (offers?.items ?? []).slice(0, 8).map(o => ({
    name: o.offerName.length > 24 ? o.offerName.slice(0, 22) + "…" : o.offerName,
    Revenue: parseKwd(o.revenueKwd),
    Profit: parseKwd(o.profitKwd),
  })), [offers]);

  return (
    <div className="space-y-5">
      {/* Offers Chart */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "أفضل العروض من حيث الإيرادات" : "Top Offers by Revenue"}</h3>
        {offersLoading && offerChart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : offerChart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات" : "No data"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, offerChart.length * 40)}>
            <BarChart data={offerChart} layout="vertical" margin={{ top: 5, right: 16, left: 140, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" width={140} />
              <Tooltip formatter={(v: number) => `${fmt(v)} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill={COLORS.emerald} radius={[0, 4, 4, 0]} />
              <Bar dataKey="Profit" fill={COLORS.pink} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Offers Table */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "تفاصيل العروض" : "Offers Detail"}</h3>
        <div className="overflow-x-auto rounded-xl border border-surface-200">
          <table className="data-table text-sm">
            <thead>
              <tr className="bg-surface-50">
                <th>{ar() ? "العرض" : "Offer"}</th>
                <th>{ar() ? "النوع" : "Type"}</th>
                <th className="text-center">{ar() ? "المبيعات" : "Sales"}</th>
                <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
                <th className="text-right">{ar() ? "صافي الربح" : "Profit"}</th>
              </tr>
            </thead>
            <tbody>
              {(offers?.items ?? []).length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد بيانات" : "No data yet"}</div><div className="empty-state-sub">{ar() ? "ستظهر النتائج هنا بمجرد توفرها." : "Results will appear here once available."}</div></div></td></tr>
              ) : (offers?.items ?? []).map(o => (
                <tr key={o.offerId}>
                  <td className="font-medium">{o.offerName}</td>
                  <td className="text-xs text-surface-500 capitalize">{o.membershipType}</td>
                  <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold">{o.salesCount}</span></td>
                  <td className="text-right font-bold text-emerald-700">{o.revenueKwd}</td>
                  <td className="text-right text-amber-600">{o.cashbackKwd}</td>
                  <td className="text-right font-bold text-brand-pink-600">{o.profitKwd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Referrals */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "الإيرادات حسب رمز الإحالة" : "Revenue by Referral Code"}</h3>
        {refLoading && (referrals?.items ?? []).length === 0 ? (
          <div className="text-sm text-surface-400 py-6 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : (referrals?.items ?? []).length === 0 ? (
          <div className="text-sm text-surface-400 py-6 text-center">{ar() ? "لا توجد إحالات في هذه الفترة" : "No referrals in this range"}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-sm">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "المحيل" : "Referrer"}</th>
                  <th>{ar() ? "الكود" : "Code"}</th>
                  <th>{ar() ? "الدور" : "Role"}</th>
                  <th className="text-center">{ar() ? "المبيعات" : "Sales"}</th>
                  <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                </tr>
              </thead>
              <tbody>
                {(referrals?.items ?? []).map(r => (
                  <tr key={r.referrerId}>
                    <td className="font-medium">{r.displayName}</td>
                    <td><span className="font-mono text-xs bg-brand-pink-50 text-brand-pink-700 px-2 py-0.5 rounded-md font-bold">{r.referralCode}</span></td>
                    <td className="text-xs text-surface-500 capitalize">{r.role}</td>
                    <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold">{r.salesCount}</span></td>
                    <td className="text-right font-bold text-emerald-700">{r.revenueKwd} KWD</td>
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

// ===========================================================================
// REPORTS TAB — real CSV export
// ===========================================================================

function ReportsTab({ from, to }: { from: string; to: string }) {
  const { getAuthHeader } = useAuth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reports = [
    { kind: "payments", icon: "💳", name: ar() ? "كل المدفوعات" : "All Payments", desc: ar() ? "سجل كامل لكل العمليات" : "Complete transaction ledger" },
    { kind: "offers", icon: "📦", name: ar() ? "تقرير العروض" : "Offers Report", desc: ar() ? "الإيرادات والربح حسب العرض" : "Revenue & profit by offer" },
    { kind: "users", icon: "👥", name: ar() ? "تقرير العملاء" : "Customers Report", desc: ar() ? "القيمة الدائمة وعدد المشتريات" : "LTV & purchase count" },
    { kind: "referrals", icon: "🔗", name: ar() ? "تقرير الإحالات" : "Referrals Report", desc: ar() ? "أداء أكواد الإحالة" : "Referral code performance" },
    { kind: "installments", icon: "📅", name: ar() ? "تقرير الأقساط" : "Installments Report", desc: ar() ? "المدفوعة والقادمة والمتأخرة" : "Paid, upcoming and late" },
  ];

  const downloadCsv = async (kind: string) => {
    setDownloading(kind); setError(null);
    try {
      const params = new URLSearchParams({ kind, from, to });
      const res = await fetch(`${API_BASE_URL}/reporting/finance/export?${params.toString()}`, {
        headers: { ...(getAuthHeader() ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const downloadXlsx = async (kind: string) => {
    setDownloading(kind); setError(null);
    try {
      const params = new URLSearchParams({ kind, from, to, format: "xlsx" });
      const res = await fetch(`${API_BASE_URL}/reporting/finance/export?${params.toString()}`, {
        headers: { ...(getAuthHeader() ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "تصدير التقارير المالية" : "Export Financial Reports"}</h3>
            <p className="text-xs text-surface-500 mt-1">
              {ar() ? "ستُصدَّر التقارير بصيغة CSV (متوافق مع Excel) ضمن نطاق التاريخ المحدد أعلاه" : "Reports export as CSV (Excel-compatible) within the date range above"}
            </p>
          </div>
          <div className="text-[11px] text-surface-500 bg-surface-50 px-2 py-1 rounded-md whitespace-nowrap">
            {new Date(from).toLocaleDateString()} → {new Date(to).toLocaleDateString()}
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-200">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map(r => (
            <div key={r.kind} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white p-4 hover:border-brand-pink-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{r.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-surface-900 truncate">{r.name}</div>
                  <div className="text-[11px] text-surface-500 truncate">{r.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadCsv(r.kind)}
                  disabled={downloading !== null}
                  className="bg-surface-50 text-surface-700 hover:bg-surface-100 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap border border-surface-200"
                >
                  {downloading === r.kind ? (ar() ? "..." : "...") : "CSV"}
                </button>
                <button
                  onClick={() => downloadXlsx(r.kind)}
                  disabled={downloading !== null}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                >
                  {downloading === r.kind ? (ar() ? "..." : "...") : "XLSX"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// CLINICS TAB — per-clinic numbers, sessions, invoices, downloadable report
// ===========================================================================

function ClinicRowDetail({ clinicId, from, to }: { clinicId: string; from: string; to: string }) {
  const { getAuthHeader } = useAuth();
  const { data, loading } = useClinicDetail(clinicId, { from, to });
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (format: "csv" | "xlsx") => {
    setDownloading(format);
    try {
      const params = new URLSearchParams({ clinicId, from, to, format });
      const res = await fetch(`${API_BASE_URL}/reporting/finance/clinic-export?${params.toString()}`, {
        headers: { ...(getAuthHeader() ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = data?.clinic?.nameEn ?? clinicId;
      a.download = `clinic-${name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message); }
    finally { setDownloading(null); }
  };

  if (loading) return <div className="py-6 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>;
  if (!data) return null;
  const s = data.summary;

  return (
    <div className="px-6 py-5 bg-surface-50 border-t border-surface-200 space-y-4 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: ar() ? "جلسات مكتملة" : "Completed", value: s.completedSessions, color: "text-emerald-700" },
          { label: ar() ? "مجدولة" : "Scheduled", value: s.scheduledSessions, color: "text-blue-700" },
          { label: ar() ? "لم يحضر" : "No-Show", value: s.noShowSessions, color: "text-red-700" },
          { label: ar() ? "فواتير مدفوعة" : "Paid Invoices", value: `${s.paidInvoices}/${s.totalInvoices}`, color: "text-brand-pink-700" },
          { label: ar() ? "إيرادات الجلسات" : "Session Revenue", value: `${s.sessionRevenueKwd} KWD`, color: "text-emerald-700" },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl p-3 border border-surface-200 shadow-sm">
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold mb-1">{k.label}</div>
            <div className={`text-lg font-black ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {data.invoices.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm">
          <table className="data-table text-xs">
            <thead>
              <tr className="bg-surface-50">
                <th>{ar() ? "التاريخ" : "Date"}</th>
                <th>{ar() ? "العميل" : "Customer"}</th>
                <th>{ar() ? "النوع" : "Type"}</th>
                <th className="text-right">{ar() ? "سعر الجلسة" : "Session Price"}</th>
                <th>{ar() ? "دفعة العيادة" : "Clinic Payment"}</th>
                <th>{ar() ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.slice(0, 8).map(inv => (
                <tr key={inv.id}>
                  <td className="text-surface-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="font-medium">{inv.customerName}</td>
                  <td className="text-surface-500 capitalize">{inv.membershipType ?? "—"}</td>
                  <td className="text-right font-bold text-surface-900">{inv.sessionPriceKwd ? `${inv.sessionPriceKwd} KWD` : "—"}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${inv.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {inv.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
                    </span>
                  </td>
                  <td className="text-surface-500">{inv.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.invoices.length > 8 && (
            <div className="text-center py-2 text-xs text-surface-400 border-t border-surface-100">
              +{data.invoices.length - 8} {ar() ? "المزيد — حمّل التقرير للقائمة الكاملة" : "more — download report for full list"}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-surface-500 font-medium">{ar() ? "تحميل التقرير الكامل:" : "Download full report:"}</span>
        <button onClick={() => download("csv")} disabled={downloading !== null}
          className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 hover:bg-surface-200 text-xs font-bold border border-surface-200 disabled:opacity-50">
          {downloading === "csv" ? "..." : "CSV"}
        </button>
        <button onClick={() => download("xlsx")} disabled={downloading !== null}
          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold disabled:opacity-50">
          {downloading === "xlsx" ? "..." : "XLSX"}
        </button>
      </div>
    </div>
  );
}

function ClinicsTab({ from, to }: { from: string; to: string }) {
  const { data, loading } = useClinicSummaries({ from, to });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const items = (data?.items ?? []).filter(c =>
    !search ||
    c.clinicNameEn.toLowerCase().includes(search.toLowerCase()) ||
    c.clinicNameAr.includes(search)
  );

  const totalSessions = (data?.items ?? []).reduce((s, c) => s + c.totalSessions, 0);
  const totalCompleted = (data?.items ?? []).reduce((s, c) => s + c.completedSessions, 0);
  const totalMemberships = (data?.items ?? []).reduce((s, c) => s + c.activeMemberships, 0);
  const totalRevenue = (data?.items ?? []).reduce((s, c) => s + parseKwd(c.revenueKwd), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label={ar() ? "إجمالي العيادات" : "Total Clinics"} value={String(data?.items.length ?? 0)} color="text-indigo-600" icon="🏥" />
        <KpiCard label={ar() ? "إجمالي الجلسات" : "Total Sessions"} value={String(totalSessions)} color="text-blue-600" icon="📅" />
        <KpiCard label={ar() ? "جلسات مكتملة" : "Completed"} value={String(totalCompleted)} color="text-emerald-600" icon="✅" />
        <KpiCard label={ar() ? "إجمالي الإيرادات" : "Total Revenue"} value={`${fmt(totalRevenue)} KWD`} color="text-brand-pink-600" icon="💰" />
      </div>

      <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-3 border-b border-surface-100">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "جميع العيادات" : "All Clinics"} <span className="text-xs text-surface-400 font-medium">({items.length})</span></h3>
            <p className="text-xs text-surface-500 mt-0.5">{ar() ? "انقر على صف لعرض التفاصيل والفواتير والتقرير" : "Click a row to view details, invoices & report"}</p>
          </div>
          <div className="relative">
            <input type="text" placeholder={ar() ? "ابحث عن عيادة..." : "Search clinic..."}
              className="input-field pl-9 text-sm w-full sm:w-56"
              value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "لا توجد عيادات" : "No clinics found"}</div>
        ) : (
          <div>
            <div className="hidden sm:grid grid-cols-[2.2fr_1fr_1fr_1.1fr_1fr_1fr_28px] gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100 text-[10px] uppercase tracking-wider font-bold text-surface-500">
              <div>{ar() ? "العيادة" : "Clinic"}</div>
              <div className="text-center">{ar() ? "الجلسات" : "Sessions"}</div>
              <div className="text-center">{ar() ? "مكتملة" : "Completed"}</div>
              <div className="text-right">{ar() ? "الإيرادات" : "Revenue"}</div>
              <div className="text-center">{ar() ? "عضويات" : "Memberships"}</div>
              <div className="text-center">{ar() ? "فواتير" : "Invoices"}</div>
              <div />
            </div>

            {items.map(c => (
              <div key={c.clinicId}>
                <div
                  className={`grid grid-cols-[1fr_auto] sm:grid-cols-[2.2fr_1fr_1fr_1.1fr_1fr_1fr_28px] gap-4 px-6 py-4 border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer items-center ${expandedId === c.clinicId ? "bg-brand-pink-50/20" : ""}`}
                  onClick={() => setExpandedId(expandedId === c.clinicId ? null : c.clinicId)}
                >
                  <div>
                    <div className="font-bold text-surface-900 text-sm">{ar() ? (c.clinicNameAr || c.clinicNameEn) : c.clinicNameEn}</div>
                    {c.clinicNameAr && !ar() && <div className="text-xs text-surface-400 mt-0.5">{c.clinicNameAr}</div>}
                    <div className="sm:hidden text-xs text-surface-500 mt-1 flex gap-3 flex-wrap">
                      <span>{c.completedSessions}/{c.totalSessions} sessions</span>
                      <span className="text-emerald-700 font-bold">{c.revenueKwd} KWD</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="font-bold text-surface-900">{c.totalSessions}</span>
                    <div className="text-[10px] text-surface-400">{c.scheduledSessions} upcoming</div>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold">{c.completedSessions}</span>
                    {c.noShowSessions > 0 && <div className="text-[10px] text-red-400 mt-0.5">{c.noShowSessions} no-show</div>}
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="font-bold text-emerald-700">{c.revenueKwd}</span>
                    <div className="text-[10px] text-surface-400">KWD</div>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-pink-50 text-brand-pink-700 text-xs font-bold">{c.activeMemberships}</span>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${c.paidInvoices === c.totalInvoices && c.totalInvoices > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {c.paidInvoices}/{c.totalInvoices}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <svg className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${expandedId === c.clinicId ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedId === c.clinicId && (
                  <ClinicRowDetail clinicId={c.clinicId} from={from} to={to} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN DASHBOARD
// ===========================================================================

export default function FinanceDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const [period, setPeriod] = useState<Period>("monthly");
  const initialRange = useMemo(() => rangeForPeriod("monthly"), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    const r = rangeForPeriod(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: ar() ? "نظرة عامة" : "Overview" },
    { key: "payments", icon: Icons.wallet, label: ar() ? "المدفوعات" : "Payments" },
    { key: "installments", icon: Icons.calendar, label: ar() ? "الأقساط" : "Installments" },
    { key: "customers", icon: Icons.profile, label: ar() ? "العملاء" : "Customers" },
    { key: "analytics", icon: Icons.chart, label: ar() ? "تحليلات" : "Analytics" },
    { key: "clinics", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>, label: ar() ? "العيادات" : "Clinics" },
    { key: "reports", icon: Icons.report, label: t("reports") },
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
        <FilterBar
          period={period}
          onPeriodChange={handlePeriodChange}
          from={from} to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />

        {activeNav === "home" && <OverviewTab period={period} from={from} to={to} />}
        {activeNav === "payments" && <PaymentsTab from={from} to={to} />}
        {activeNav === "installments" && <InstallmentsTab from={from} to={to} />}
        {activeNav === "customers" && <CustomersTab from={from} to={to} />}
        {activeNav === "analytics" && <AnalyticsTab from={from} to={to} />}
        {activeNav === "clinics" && <ClinicsTab from={from} to={to} />}
        {activeNav === "reports" && <ReportsTab from={from} to={to} />}
      </div>
    </DashboardShell>
  );
}
