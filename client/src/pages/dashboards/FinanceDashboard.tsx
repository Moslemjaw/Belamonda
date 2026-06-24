import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  useApi,
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
import { UserProfilePanel, UsersManager } from "./AdminDashboard";
import { KpiCard } from "../../components/KpiCard";
import { fmtDate } from "../../lib/dateFormat";

const ar = () => i18n.language === "ar";

// ===========================================================================
// Helpers
// ===========================================================================

type Period = "daily" | "weekly" | "monthly" | "yearly" | "all" | "custom";

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
    from.setUTCDate(from.getUTCDate() - 1); // today only
  } else if (period === "weekly") {
    from.setUTCDate(from.getUTCDate() - 7); // last 7 days
  } else if (period === "monthly") {
    from.setUTCMonth(from.getUTCMonth() - 1); // last 30 days
  } else if (period === "yearly") {
    from.setUTCFullYear(from.getUTCFullYear() - 1); // last year
  } else if (period === "all") {
    from.setUTCFullYear(2020, 0, 1); // far back enough to cover all data
  }
  // "custom" → don't compute, caller keeps existing from/to
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
  bank_transfer: "Paid by Customer Service", cash: "Paid in Clinic", pos: "POS",
  card_mock: "Card (Online)", enet: "ENET", wallet: "Wallet", free_package: "Free Package", other: "Other",
};
const PURPOSE_LABELS: Record<string, string> = {
  enrollment_full: "Membership", installment: "Installment",
  deposit: "Deposit", deposit_balance: "Deposit Balance",
  enrollment_enet: "ENET Enrollment", session_payment: "Session",
  manual_entry: "Manual Entry",
};
const METHOD_COLORS: Record<string, string> = {
  bank_transfer: "bg-blue-50 text-blue-700 border-blue-200",
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pos: "bg-purple-50 text-purple-700 border-purple-200",
  card_mock: "bg-indigo-50 text-indigo-700 border-indigo-200",
  enet: "bg-brand-pink-50 text-brand-pink-700 border-brand-pink-200",
  wallet: "bg-amber-50 text-amber-700 border-amber-200",
  free_package: "bg-surface-100 text-surface-600 border-surface-200",
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
  from, to,
  onCustomDateChange,
}: {
  from: string; to: string;
  onCustomDateChange: (from: string, to: string) => void;
}) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);

  const handleApply = () => {
    let f = localFrom;
    let t = localTo;
    
    if (f) {
      const dFrom = new Date(f); dFrom.setUTCHours(0,0,0,0);
      // We assume isoDate is available globally or in this file
      f = dFrom.toISOString(); 
    }
    if (t) {
      const dTo = new Date(t); dTo.setUTCHours(23,59,59,999);
      t = dTo.toISOString();
    }
    
    onCustomDateChange(f, t);
  };

  return (
    <div className="flex items-center justify-center sm:justify-end gap-2 text-xs rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <label className="text-surface-500 font-medium">{ar() ? "من" : "From"}</label>
      <input type="date" className="input-field text-xs py-1.5 h-auto max-w-[130px]"
        value={localFrom.slice(0, 10)}
        onChange={e => setLocalFrom(e.target.value)} />
      <label className="text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
      <input type="date" className="input-field text-xs py-1.5 h-auto max-w-[130px]"
        value={localTo.slice(0, 10)}
        onChange={e => setLocalTo(e.target.value)} />
      <button 
        className="btn-primary text-xs py-1.5 px-4 rounded-xl ml-2 rtl:ml-0 rtl:mr-2"
        onClick={handleApply}
      >
        {ar() ? "بحث" : "Search"}
      </button>
    </div>
  );
}

// ===========================================================================
// KPI Card
// ===========================================================================



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
  const cashbackApplied = snapshot?.cashbackAppliedKwd ?? totals?.cashbackKwd ?? "0.000";
  const cashbackLiability = snapshot?.cashback?.netLiabilityKwd ??
    fmt(parseKwd(snapshot?.totalCashbackLocked) + parseKwd(snapshot?.totalCashbackUnlocked) - parseKwd(snapshot?.totalCashbackUtilized));

  const chartData = useMemo(() => points.map(p => ({
    bucket: p.bucket,
    Revenue: parseKwd(p.revenueKwd),
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
      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Row 1: Core Financials */}
        <KpiCard label={ar() ? "الإيرادات المتوقعة (الكل مدفوع)" : "Expected Total Revenue"} value={`${snapshot?.expectedTotalRevenueKwd ?? "0.000"} KWD`} sub={ar() ? "إذا تم دفع جميع الأقساط" : "if all installments are fully paid"} accent="teal" icon="📊" isHighlighted />
        <KpiCard label={ar() ? "إجمالي الإيرادات (المحصل)" : "Total Revenue (Collected)"} value={`${snapshot?.paidTowardMembershipsKwd ?? "0.000"} KWD`} sub={`${totals?.transactions ?? 0} ${ar() ? "معاملة" : "transactions"}`} accent="emerald" icon="💰" />
        <KpiCard label={ar() ? "أقساط غير مدفوعة" : "Unpaid Installments"} value={`${snapshot?.unpaidInstallmentsKwd ?? "0.000"} KWD`} sub={ar() ? "مبالغ أقساط لم تُسدد بعد" : "outstanding installment amounts"} accent="red" icon="⏳" />

        {/* Row 2: Breakdowns & Pending */}
        <KpiCard label={ar() ? "إيرادات العضويات" : "Membership Revenue"} value={`${breakdown?.summary?.membershipRevenueKwd ?? "0.000"} KWD`} accent="pink" icon="💳" />
        <KpiCard label={ar() ? "إيرادات الجلسات" : "Session Revenue"} value={`${breakdown?.summary?.sessionRevenueKwd ?? "0.000"} KWD`} accent="blue" icon="💆‍♀️" />
        <KpiCard label={ar() ? "مدفوعات معلقة" : "Pending Payments"} value={`${snapshot?.pendingPaymentsKwd ?? "0.000"} KWD`} sub={`${snapshot?.pendingPaymentsCount ?? 0} ${ar() ? "طلب" : "requests"}`} accent="amber" icon="⚠️" />

        {/* Row 3: Cashback & Operations */}
        <KpiCard label={ar() ? "الكاش باك المطبق" : "Cashback Applied"} value={`${cashbackApplied} KWD`} sub={ar() ? "من الإيرادات" : "off revenue"} accent="amber" icon="🎁" />
        <KpiCard label={ar() ? "التزام الكاش باك" : "Cashback Liability"} value={`${cashbackLiability} KWD`} sub={ar() ? "صافي مستحق" : "net outstanding"} accent="indigo" icon="⚖️" />
        <KpiCard label={ar() ? "جلسات اليوم / الشهر" : "Sessions Today / Month"} value={`${snapshot?.sessionsToday ?? 0} / ${snapshot?.sessionsThisMonth ?? 0}`} accent="violet" icon="📅" />
      </div>

      {/* Revenue Trend Chart */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "تطور الإيرادات" : "Revenue Trend"}</h3>
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
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: any) => `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Revenue" stroke={COLORS.emerald} strokeWidth={2} fill="url(#revFill)" />
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
                <Tooltip formatter={(v: any) => `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
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
                <Tooltip formatter={(v: any) => `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
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
              <Tooltip formatter={(v: any) => `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ar() ? "المحصّل" : "Collected"} value={`${summary?.totalCollectedKwd ?? "0.000"} KWD`} accent="emerald" icon="💰" />
        <KpiCard label={ar() ? "العضويات" : "Memberships"} value={`${summary?.membershipRevenueKwd ?? "0.000"} KWD`} accent="pink" icon="💳" />
        <KpiCard label={ar() ? "الجلسات" : "Sessions"} value={`${summary?.sessionRevenueKwd ?? "0.000"} KWD`} accent="indigo" icon="💆‍♀️" />
        <KpiCard label={ar() ? "كاش باك" : "Cashback"} value={`${summary?.cashbackAppliedKwd ?? "0.000"} KWD`} accent="amber" icon="🎁" />
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
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            {/* Mobile view (Cards) */}
            <div className="md:hidden divide-y divide-surface-100">
              {items.map((p: EnrichedPaymentItem) => (
                <div key={p.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <div className="font-bold text-surface-900 line-clamp-1">{(p as any).customerName || p.offerName || "—"}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{p.offerName ? `${p.offerName} • ` : ""}{p.clinicNameEn || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-surface-900">{p.amountKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                      <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(p.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${METHOD_COLORS[p.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>{METHOD_LABELS[p.method] ?? p.method}</span>
                    <span className="text-[10px] text-surface-600 bg-surface-50 px-2 py-0.5 rounded-md border border-surface-200">{PURPOSE_LABELS[p.purpose ?? ""] ?? (p.purpose || "—")}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[p.status] ?? "bg-surface-100 text-surface-500"}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view (Table) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table text-xs w-full">
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
                      <td className="font-medium text-surface-800 max-w-[120px]">
                        <div className="truncate">{(p as any).customerName || p.userId}</div>
                        {(p as any).customerPhone && <div className="text-[10px] text-surface-400 font-normal truncate">{(p as any).customerPhone}</div>}
                      </td>
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
                      <td className="text-surface-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  const [statusFilter, setStatusFilter] = useState<"" | "paid" | "late" | "upcoming">("");
  const { data, loading } = useFinanceInstallments({ from, to });
  const summary = data?.summary;
  const items = (data?.items ?? []).filter(i => !statusFilter || i.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ar() ? "أقساط مدفوعة" : "Paid Installments"} value={`${summary?.paidKwd ?? "0.000"} KWD`} accent="emerald" icon="✅" />
        <KpiCard label={ar() ? "أقساط قادمة" : "Upcoming"} value={`${summary?.upcomingKwd ?? "0.000"} KWD`} sub={`${summary?.upcomingCount ?? 0} ${ar() ? "قسط" : "items"}`} accent="amber" icon="⏳" />
        <KpiCard label={ar() ? "أقساط متأخرة" : "Late"} value={`${summary?.lateKwd ?? "0.000"} KWD`} sub={`${summary?.lateCount ?? 0} ${ar() ? "قسط" : "items"}`} accent="red" icon="⚠️" />
        <KpiCard label={ar() ? "الإيرادات المتوقعة" : "Forecast Revenue"} value={`${summary?.forecastKwd ?? "0.000"} KWD`} accent="pink" icon="📊" />
      </div>

      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-surface-900">{ar() ? "متتبع الأقساط" : "Installment Tracker"}</h3>
          <select className="select-field text-xs py-1.5 h-auto w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{ar() ? "الكل" : "All"}</option>
            <option value="paid">{ar() ? "مدفوعة" : "Paid"}</option>
            <option value="late">{ar() ? "متأخرة" : "Late"}</option>
            <option value="upcoming">{ar() ? "قادمة" : "Upcoming"}</option>
          </select>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "لا توجد أقساط" : "No installments"}</div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            {/* Mobile view (Cards) */}
            <div className="md:hidden divide-y divide-surface-100">
              {items.map((i, idx) => (
                <div key={`${i.userOfferId}-${i.installmentNumber}-${idx}`} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <div className="font-bold text-surface-900 line-clamp-1">{i.offerName}</div>
                      <div className="text-[10px] text-surface-500 font-mono mt-0.5">{i.customerName || i.userId}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-surface-900">{i.amountKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                      <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(i.dueDate)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-surface-500 bg-surface-50 px-2 py-0.5 rounded-md border border-surface-200">
                      #{i.installmentNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${i.status === "paid" ? "bg-emerald-50 text-emerald-700" : i.status === "late" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {i.status === "paid" ? (ar() ? "مدفوع" : "Paid") : i.status === "late" ? (ar() ? "متأخر" : "Late") : (ar() ? "قادم" : "Upcoming")}
                    </span>
                    {i.method && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                        {i.method === "cash" ? (ar() ? "نقد" : "Cash") : i.method === "knet" ? "KNET" : i.method === "bank_transfer" ? (ar() ? "تحويل بنكي" : "Bank Transfer") : i.method === "card" ? (ar() ? "بطاقة" : "Card") : i.method === "link" ? (ar() ? "رابط" : "Link") : i.method}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view (Table) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table text-sm w-full">
                <thead>
                  <tr className="bg-surface-50">
                    <th>{ar() ? "العميل" : "Customer"}</th>
                    <th>{ar() ? "الباقة" : "Package"}</th>
                    <th className="text-center">#</th>
                    <th className="text-right">{ar() ? "المبلغ" : "Amount"}</th>
                    <th>{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                    <th>{ar() ? "طريقة الدفع" : "Method"}</th>
                    <th>{ar() ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={`${i.userOfferId}-${i.installmentNumber}-${idx}`}>
                      <td className="font-medium text-surface-900">{i.customerName || i.userId}</td>
                      <td className="font-medium">{i.offerName}</td>
                      <td className="text-center text-surface-500">{i.installmentNumber}</td>
                      <td className="text-right font-bold text-surface-900">{i.amountKwd} KWD</td>
                      <td className="text-surface-600">{fmtDate(i.dueDate)}</td>
                      <td>
                        {i.method ? (
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                            {i.method === "cash" ? (ar() ? "نقد" : "Cash") : i.method === "knet" ? "KNET" : i.method === "bank_transfer" ? (ar() ? "تحويل بنكي" : "Bank Transfer") : i.method === "card" ? (ar() ? "بطاقة" : "Card") : i.method === "link" ? (ar() ? "رابط" : "Link") : i.method}
                          </span>
                        ) : (
                          <span className="text-surface-300">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${i.status === "paid" ? "bg-emerald-50 text-emerald-700" : i.status === "late" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                          {i.status === "paid" ? (ar() ? "مدفوع" : "Paid") : i.status === "late" ? (ar() ? "متأخر" : "Late") : (ar() ? "قادم" : "Upcoming")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
  return (
    <div className="space-y-5 animate-fade-in">
      <UsersManager />
    </div>
  );
}

// ===========================================================================
// ANALYTICS TAB — by-offer + by-referral
// ===========================================================================

function AnalyticsTab({ from, to }: { from: string; to: string }) {
  const { data: offers, loading: offersLoading } = useRevenueByOffer({ from, to });
  const { data: referrals, loading: refLoading } = useRevenueByReferral({ from, to });
  const { data: ts } = useFinanceTimeseries("daily", { from, to });

  const offerChart = useMemo(() => (offers?.items ?? []).slice(0, 8).map(o => ({
    name: o.offerName.length > 24 ? o.offerName.slice(0, 22) + "…" : o.offerName,
    Revenue: parseKwd(o.revenueKwd),
    Sales: o.salesCount,
  })), [offers]);

  // Daily performance data for the last 7 visible points
  const dailyPerf = useMemo(() => {
    const pts = ts?.points ?? [];
    return pts.slice(-14).map(p => ({
      date: p.bucket,
      Revenue: parseKwd(p.revenueKwd),
      Cashback: parseKwd(p.cashbackKwd),
      Txns: p.transactions,
    }));
  }, [ts]);

  // Revenue composition: membership vs session
  const totalOfferRevenue = (offers?.items ?? []).reduce((s, o) => s + parseKwd(o.revenueKwd), 0);
  const totalOfferSales = (offers?.items ?? []).reduce((s, o) => s + o.salesCount, 0);
  const topOffer = (offers?.items ?? []).sort((a, b) => parseKwd(b.revenueKwd) - parseKwd(a.revenueKwd))[0];

  return (
    <div className="space-y-5">

      {/* Top-line analytics KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ar() ? "إجمالي إيرادات العروض" : "Total Offer Revenue"} value={`${fmt(totalOfferRevenue)} KWD`} accent="emerald" icon="📦" />
        <KpiCard label={ar() ? "إجمالي المبيعات" : "Total Sales"} value={String(totalOfferSales)} accent="indigo" icon="🛒" />
        <KpiCard label={ar() ? "عدد العروض" : "Active Offers"} value={String((offers?.items ?? []).length)} accent="blue" icon="📋" />
        <KpiCard label={ar() ? "أفضل عرض" : "Top Offer"} value={topOffer ? `${fmt(parseKwd(topOffer.revenueKwd))} KWD` : "—"} sub={topOffer?.offerName ?? ""} accent="pink" icon="🏆" isHighlighted />
      </div>

      {/* Daily Performance Chart — Revenue vs Cashback */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "الأداء اليومي" : "Daily Performance"}</h3>
            <p className="text-xs text-surface-500 mt-0.5">{ar() ? "الإيرادات والكاش باك والمعاملات يومياً" : "Revenue, cashback & transactions per day"}</p>
          </div>
          <span className="text-xs text-surface-400">{dailyPerf.length} {ar() ? "يوم" : "days"}</span>
        </div>
        {dailyPerf.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات" : "No data"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyPerf} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: any, name: any) => name === "Txns" ? v : `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="url(#dailyRevGrad)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cashback" fill={COLORS.amber} radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line type="monotone" dataKey="Txns" stroke={COLORS.indigo} strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily Performance Table */}
      {dailyPerf.length > 0 && (
        <div className="card-elevated p-5 border border-surface-200 shadow-sm">
          <h3 className="text-sm font-bold text-surface-900 mb-3">{ar() ? "جدول الأداء اليومي" : "Daily Performance Table"}</h3>
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-xs">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                  <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                  <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
                  <th className="text-center">{ar() ? "المعاملات" : "Txns"}</th>
                  <th>{ar() ? "مؤشر" : "Indicator"}</th>
                </tr>
              </thead>
              <tbody>
                {[...dailyPerf].reverse().map(d => {
                  const avgRev = dailyPerf.reduce((s, x) => s + x.Revenue, 0) / dailyPerf.length;
                  const isHigh = d.Revenue > avgRev * 1.2;
                  const isLow = d.Revenue < avgRev * 0.5 && d.Revenue > 0;
                  return (
                    <tr key={d.date}>
                      <td className="font-medium text-surface-900 whitespace-nowrap">{d.date}</td>
                      <td className="text-right font-bold text-emerald-700">{fmt(d.Revenue)} KWD</td>
                      <td className="text-right text-amber-600">{fmt(d.Cashback)} KWD</td>
                      <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">{d.Txns}</span></td>
                      <td>
                        {isHigh && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">🔥 Above Avg</span>}
                        {isLow && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">⚠️ Below Avg</span>}
                        {!isHigh && !isLow && d.Revenue > 0 && <span className="text-surface-400 text-[10px]">— Normal</span>}
                        {d.Revenue === 0 && <span className="text-surface-300 text-[10px]">No activity</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <Tooltip formatter={(v: any, name: any) => name === "Sales" ? v : `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill={COLORS.emerald} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Offers Table */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "تفاصيل العروض" : "Offers Detail"}</h3>
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          {/* Mobile view (Cards) */}
          <div className="md:hidden divide-y divide-surface-100">
            {(offers?.items ?? []).length === 0 ? (
              <div className="p-8 text-center"><div className="empty-state-icon mx-auto"><svg className="w-7 h-7 mx-auto text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><div className="text-sm font-bold mt-2">{ar() ? "لا توجد بيانات" : "No data yet"}</div></div>
            ) : (offers?.items ?? []).map(o => (
              <div key={o.offerId} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="font-bold text-surface-900 line-clamp-1">{o.offerName}</div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-emerald-700">{o.revenueKwd}</div>
                    <div className="text-[10px] text-surface-500">{ar() ? "المتوقع:" : "Expected:"} {o.expectedKwd}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 bg-surface-50 border border-surface-200 px-2 py-0.5 rounded-md capitalize">{o.membershipType}</span>
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold">{o.salesCount} {ar() ? "مبيعات" : "Sales"}</span>
                  <span className="text-[10px] text-amber-600 font-bold ml-auto">{o.cashbackKwd} CB</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view (Table) */}
          <div className="overflow-x-auto hidden md:block">
            <table className="data-table text-sm w-full">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "العرض" : "Offer"}</th>
                  <th>{ar() ? "النوع" : "Type"}</th>
                  <th className="text-center">{ar() ? "المبيعات" : "Sales"}</th>
                  <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                  <th className="text-right">{ar() ? "المتوقع" : "Expected"}</th>
                  <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
                </tr>
              </thead>
              <tbody>
                {(offers?.items ?? []).length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد بيانات" : "No data yet"}</div><div className="empty-state-sub">{ar() ? "ستظهر النتائج هنا بمجرد توفرها." : "Results will appear here once available."}</div></div></td></tr>
                ) : (offers?.items ?? []).map(o => (
                  <tr key={o.offerId}>
                    <td className="font-medium">{o.offerName}</td>
                    <td className="text-xs text-surface-500 capitalize">{o.membershipType}</td>
                    <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold">{o.salesCount}</span></td>
                    <td className="text-right font-bold text-emerald-700">{o.revenueKwd}</td>
                    <td className="text-right font-bold text-blue-700">{o.expectedKwd}</td>
                    <td className="text-right text-amber-600">{o.cashbackKwd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            {/* Mobile view (Cards) */}
            <div className="md:hidden divide-y divide-surface-100">
              {(referrals?.items ?? []).map(r => (
                <div key={r.referrerId} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-surface-900 line-clamp-1">{r.displayName}</div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-700">{r.revenueKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-brand-pink-50 text-brand-pink-700 px-2 py-0.5 rounded-md font-bold">{r.referralCode}</span>
                    <span className="text-[10px] text-surface-500 bg-surface-50 border border-surface-200 px-2 py-0.5 rounded-md capitalize">{r.role}</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold ml-auto">{r.salesCount} {ar() ? "مبيعات" : "Sales"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view (Table) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table text-sm w-full">
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
    { kind: "comprehensive", icon: "📚", name: ar() ? "التقرير الشامل" : "Master Data Report", desc: ar() ? "بيانات مجمعة تشمل العملاء والمدفوعات والمزيد" : "Merged data: Users, Memberships, Sessions, Payments" },
    { kind: "payments", icon: "💳", name: ar() ? "كل المدفوعات" : "All Payments", desc: ar() ? "سجل كامل لكل العمليات" : "Complete transaction ledger" },
    { kind: "subscriptions", icon: "👥", name: ar() ? "تقرير الاشتراكات" : "Subscriptions Report", desc: ar() ? "حالة الباقات والجلسات المتبقية" : "Memberships status & used sessions" },
    { kind: "offers", icon: "📦", name: ar() ? "تقرير العروض" : "Offers Report", desc: ar() ? "الإيرادات حسب العرض" : "Revenue by offer" },
    { kind: "referrals", icon: "🔗", name: ar() ? "تقرير الإحالات" : "Referrals Report", desc: ar() ? "أداء أكواد الإحالة والعمولات" : "Referral code performance" },
    { kind: "installments", icon: "📅", name: ar() ? "تقرير الأقساط" : "Installments Report", desc: ar() ? "المدفوعة والقادمة والمتأخرة" : "Paid, upcoming and late" },
    { kind: "clinics", icon: "🏥", name: ar() ? "أداء العيادات" : "Clinics Performance", desc: ar() ? "الاستخدام والإيرادات وجلسات التخلف" : "Utilization, revenue & no-shows" },
  ];

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
              {ar() ? "ستُصدَّر التقارير بصيغة Excel (XLSX) ضمن نطاق التاريخ المحدد أعلاه" : "Reports export as Excel (XLSX) within the date range above"}
            </p>
          </div>
          <div className="text-[11px] text-surface-500 bg-surface-50 px-2 py-1 rounded-md whitespace-nowrap">
            {fmtDate(from)} → {fmtDate(to)}
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-200">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
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
                  <td className="text-surface-500">{fmtDate(inv.createdAt)}</td>
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
  ).map(c => {
    // Enhance data with calculated metrics
    const utilization = c.totalSessions > 0 ? (c.completedSessions / c.totalSessions) * 100 : 0;
    const remainingSessions = Math.max(0, c.totalSessions - c.completedSessions);
    const avgSessionValue = c.totalSessions > 0 ? parseKwd(c.revenueKwd) / c.totalSessions : 0;
    const deferredRevenue = remainingSessions * avgSessionValue;
    return { ...c, utilization, deferredRevenue };
  });

  const totalSessions = items.reduce((s, c) => s + c.totalSessions, 0);
  const totalCompleted = items.reduce((s, c) => s + c.completedSessions, 0);
  const totalMemberships = items.reduce((s, c) => s + c.activeMemberships, 0);
  const totalRevenue = items.reduce((s, c) => s + parseKwd(c.revenueKwd), 0);
  const totalDeferred = items.reduce((s, c) => s + c.deferredRevenue, 0);
  const avgUtilization = items.length > 0 ? items.reduce((s, c) => s + c.utilization, 0) / items.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label={ar() ? "إجمالي العيادات" : "Total Clinics"} value={String(data?.items.length ?? 0)} color="text-indigo-600" icon="🏥" />
        <KpiCard label={ar() ? "إجمالي الجلسات" : "Total Sessions"} value={String(totalSessions)} color="text-blue-600" icon="📅" />
        <KpiCard label={ar() ? "متوسط الاستخدام" : "Avg Utilization"} value={`${avgUtilization.toFixed(1)}%`} color="text-emerald-600" icon="📈" />
        <KpiCard label={ar() ? "إجمالي الإيرادات" : "Total Revenue"} value={`${fmt(totalRevenue)} KWD`} color="text-brand-pink-600" icon="💰" />
        <KpiCard label={ar() ? "إيرادات مؤجلة (مقدرة)" : "Deferred (Est.)"} value={`${fmt(totalDeferred)} KWD`} color="text-amber-600" icon="⏳" />
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
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1.5fr_1.2fr_1.2fr_1fr_28px] gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100 text-[10px] uppercase tracking-wider font-bold text-surface-500">
              <div>{ar() ? "العيادة" : "Clinic"}</div>
              <div className="text-center">{ar() ? "عضويات" : "Memberships"}</div>
              <div className="text-center">{ar() ? "الاستخدام" : "Utilization"}</div>
              <div className="text-right">{ar() ? "الإيرادات" : "Revenue"}</div>
              <div className="text-right">{ar() ? "المؤجل" : "Deferred"}</div>
              <div className="text-center">{ar() ? "فواتير" : "Invoices"}</div>
              <div />
            </div>

            {items.map(c => (
              <div key={c.clinicId}>
                <div
                  className={`grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1.5fr_1.2fr_1.2fr_1fr_28px] gap-4 px-6 py-4 border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer items-center ${expandedId === c.clinicId ? "bg-brand-pink-50/20" : ""}`}
                  onClick={() => setExpandedId(expandedId === c.clinicId ? null : c.clinicId)}
                >
                  <div>
                    <div className="font-bold text-surface-900 text-sm">{ar() ? (c.clinicNameAr || c.clinicNameEn) : c.clinicNameEn}</div>
                    {c.clinicNameAr && !ar() && <div className="text-xs text-surface-400 mt-0.5">{c.clinicNameAr}</div>}
                    <div className="sm:hidden text-xs text-surface-500 mt-1 flex gap-3 flex-wrap">
                      <span>{c.utilization.toFixed(0)}% used</span>
                      <span className="text-emerald-700 font-bold">{c.revenueKwd} KWD</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand-pink-50 text-brand-pink-700 text-xs font-bold">{c.activeMemberships}</span>
                  </div>
                  <div className="hidden sm:flex flex-col justify-center gap-1">
                    <div className="flex justify-between text-[10px] font-bold text-surface-500">
                      <span>{c.completedSessions}/{c.totalSessions}</span>
                      <span className={c.utilization > 80 ? "text-emerald-600" : c.utilization < 30 ? "text-amber-600" : ""}>{c.utilization.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-200 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${c.utilization > 80 ? "bg-emerald-500" : c.utilization < 30 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, c.utilization)}%` }} />
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="font-bold text-emerald-700">{c.revenueKwd}</span>
                    <div className="text-[10px] text-surface-400">KWD</div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="font-bold text-amber-600">{fmt(c.deferredRevenue)}</span>
                    <div className="text-[10px] text-surface-400">KWD</div>
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
// RELIEF TAB — refund tracking
// ===========================================================================

function ReliefTab({ from, to }: { from: string; to: string }) {
  const [filterMethod, setFilterMethod] = useState("");
  const { data, loading } = usePaymentsBreakdown({ status: "refunded", method: filterMethod || undefined, from, to });

  const items = data?.items ?? [];
  const totalRefundedMils = items.reduce((s, p) => s + parseKwd(p.amountKwd), 0);
  const avgRefund = items.length > 0 ? totalRefundedMils / items.length : 0;

  // Breakdown by method
  const byMethod: Record<string, { count: number; total: number }> = {};
  items.forEach(p => {
    if (!byMethod[p.method]) byMethod[p.method] = { count: 0, total: 0 };
    byMethod[p.method].count++;
    byMethod[p.method].total += parseKwd(p.amountKwd);
  });

  const byMethodSorted = Object.entries(byMethod).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label={ar() ? "إجمالي المستردّ" : "Total Refunded"}
          value={`${fmt(totalRefundedMils)} KWD`}
          color="text-rose-600"
          icon="↩️"
        />
        <KpiCard
          label={ar() ? "عدد الاستردادات" : "Refund Count"}
          value={String(items.length)}
          color="text-red-600"
          icon="🔄"
        />
        <KpiCard
          label={ar() ? "متوسط الاسترداد" : "Avg Refund"}
          value={`${fmt(avgRefund)} KWD`}
          color="text-amber-600"
          icon="📊"
        />
        <KpiCard
          label={ar() ? "طرق مختلفة" : "Methods Used"}
          value={String(byMethodSorted.length)}
          color="text-indigo-600"
          icon="💳"
        />
      </div>

      {/* Method breakdown cards */}
      {byMethodSorted.length > 0 && (
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "الاستردادات حسب طريقة الدفع" : "Refunds by Payment Method"}</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
            {byMethodSorted.map(([method, v]) => (
              <div key={method} className="rounded-xl border border-surface-100 bg-surface-50 p-4 flex flex-col gap-1">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full self-start border ${METHOD_COLORS[method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                  {METHOD_LABELS[method] ?? method}
                </span>
                <div className="text-lg font-black text-rose-600 mt-1">{fmt(v.total)} <span className="text-xs font-medium text-surface-400">KWD</span></div>
                <div className="text-xs text-surface-500">{v.count} {ar() ? "استرداد" : v.count === 1 ? "refund" : "refunds"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refunds table */}
      <div className="card-elevated p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-surface-900">
            {ar() ? "سجل الاستردادات" : "Refunds Ledger"}
            <span className="ml-2 text-xs font-medium text-surface-400">({items.length})</span>
          </h3>
          <select className="select-field text-xs py-1.5 h-auto w-full sm:w-40" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="">{ar() ? "كل الطرق" : "All Methods"}</option>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {loading && items.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">✅</div>
            <div className="text-sm font-bold text-surface-700">{ar() ? "لا توجد استردادات في هذه الفترة" : "No refunds in this period"}</div>
            <div className="text-xs text-surface-400 mt-1">{ar() ? "هذا مؤشر ممتاز للجودة" : "That's a great quality indicator"}</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-xs">
              <thead>
                <tr className="bg-rose-50">
                  <th>{ar() ? "المستخدم" : "User"}</th>
                  <th>{ar() ? "العرض" : "Offer"}</th>
                  <th>{ar() ? "العيادة" : "Clinic"}</th>
                  <th>{ar() ? "الطريقة" : "Method"}</th>
                  <th>{ar() ? "النوع" : "Type"}</th>
                  <th className="text-right">{ar() ? "المبلغ المسترد" : "Refunded Amount"}</th>
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p: EnrichedPaymentItem) => (
                  <tr key={p.id} className="hover:bg-rose-50/30">
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
                    <td className="text-right font-black text-rose-600">{p.amountKwd} KWD</td>
                    <td className="text-surface-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
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
// PROFILE TAB — finance staff own account
// ===========================================================================

function ProfileTab() {
  const { getAuthHeader, auth } = useAuth();
  const { data: meData, loading, refetch: refetchMe } = useApi<any>("/users/me");

  const me = meData?.user ?? meData ?? auth;

  const roleLabel: Record<string, string> = {
    admin: "Administrator", finance: "Finance Staff",
    clinicStaff: "Clinic Staff", customer: "Customer",
  };

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", username: "", newPassword: "" });

  useEffect(() => {
    if (me) {
      setForm({
        fullName: me.fullName || me.name || [me.firstName, me.lastName].filter(Boolean).join(" ") || "",
        email: me.email || "",
        phone: me.phone || "",
        username: me.username || "",
        newPassword: "",
      });
    }
  }, [me]);

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        username: form.username,
      };
      if (form.newPassword.trim()) body.newPassword = form.newPassword.trim();
      await apiFetch("/users/me", { method: "PATCH", headers: getAuthHeader(), body: JSON.stringify(body) });
      setIsEditing(false);
      setForm(f => ({ ...f, newPassword: "" }));
      setSaveMsg({ type: "ok", text: ar() ? "تم حفظ الملف الشخصي" : "Profile saved successfully" });
      refetchMe();
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e.message || (ar() ? "فشل الحفظ" : "Save failed") });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !me) {
    return (
      <div className="py-20 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading profile..."}</div>
    );
  }

  const displayName = form.fullName || form.username || me?.email || "—";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">

      {/* Avatar + name card */}
      <div className="card-elevated p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-2xl font-black text-brand-pink-600 shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-black text-surface-900 truncate">{displayName}</div>
          <div className="text-xs text-surface-400 mt-0.5">{me?.email}</div>
          <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-pink-50 text-brand-pink-700">
            {roleLabel[me?.role] ?? me?.role ?? "Finance"}
          </span>
        </div>
      </div>

      {/* Account details */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h4 className="font-bold text-surface-900 text-sm">{ar() ? "بيانات الحساب" : "Account Details"}</h4>
            <p className="text-xs text-surface-400 mt-0.5">{ar() ? "معلومات حسابك الشخصي في النظام" : "Your personal account information in the system"}</p>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${saveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {saveMsg.text}
              </span>
            )}
            {!isEditing ? (
              <button onClick={() => { setIsEditing(true); setSaveMsg(null); }} className="btn-secondary btn-sm text-xs">{ar() ? "تعديل" : "Edit Profile"}</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setIsEditing(false); setSaveMsg(null); }} className="btn-secondary btn-sm text-xs">{ar() ? "إلغاء" : "Cancel"}</button>
                <button onClick={saveProfile} disabled={saving} className="btn-primary btn-sm text-xs">
                  {saving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ" : "Save")}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "اسم المستخدم" : "Username"}</span>
            {isEditing ? <input className="input-field text-sm py-1.5 flex-1" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} dir="ltr" /> : <span className="text-sm font-medium text-surface-800 font-mono">{me?.username || "—"}</span>}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "الاسم الكامل" : "Full Name"}</span>
            {isEditing ? <input className="input-field text-sm py-1.5 flex-1" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /> : <span className="text-sm font-medium text-surface-800">{form.fullName || "—"}</span>}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "البريد الإلكتروني" : "Email"}</span>
            {isEditing ? <input type="email" className="input-field text-sm py-1.5 flex-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" /> : <span className="text-sm font-medium text-surface-800">{me?.email || "—"}</span>}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "الهاتف" : "Phone"}</span>
            {isEditing ? <input className="input-field text-sm py-1.5 flex-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" /> : <span className="text-sm font-medium text-surface-800">{me?.phone || "—"}</span>}
          </div>
          {isEditing && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
              <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "كلمة مرور جديدة" : "New Password"}</span>
              <input type="password" className="input-field text-sm py-1.5 flex-1" placeholder="leave blank to keep current" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} dir="ltr" />
            </div>
          )}
          {me?.role && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
              <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "الدور" : "Role"}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-pink-50 text-brand-pink-700">{roleLabel[me.role] ?? me.role}</span>
            </div>
          )}
          {me?.createdAt && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3">
              <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "تاريخ الانضمام" : "Member Since"}</span>
              <span className="text-sm font-medium text-surface-800">{fmtDate(me.createdAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Access rights */}
      <div className="card-elevated p-5">
        <h4 className="font-bold text-surface-900 text-sm mb-1">{ar() ? "صلاحيات الوصول" : "Access Rights"}</h4>
        <p className="text-xs text-surface-400 mb-4">{ar() ? "الأقسام والبيانات التي يمكنك الاطلاع عليها" : "Dashboard sections and data you have access to"}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: ar() ? "نظرة عامة على الإيرادات" : "Revenue Overview", ok: true },
            { label: ar() ? "سجل المدفوعات" : "Payments Ledger", ok: true },
            { label: ar() ? "تتبع الأقساط" : "Installments Tracking", ok: true },
            { label: ar() ? "بيانات العملاء" : "Customer Data", ok: true },
            { label: ar() ? "تحليلات الأداء" : "Performance Analytics", ok: true },
            { label: ar() ? "تقارير العيادات" : "Clinic Reports", ok: true },
            { label: ar() ? "تصدير التقارير" : "Export Reports", ok: true },
            { label: ar() ? "القيود اليدوية" : "Manual Entries", ok: true },
            { label: ar() ? "الاستردادات" : "Refunds (Relief)", ok: true },
            { label: ar() ? "إدارة النظام" : "System Administration", ok: me?.role === "admin" },
          ].map(item => (
            <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-medium ${item.ok ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-surface-100 bg-surface-50 text-surface-400"}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.ok ? "bg-emerald-500" : "bg-surface-300"}`} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MANUAL ENTRIES TAB
// ===========================================================================

const MANUAL_METHODS = [
  { value: "cash", label: "Paid in Clinic" },
  { value: "bank_transfer", label: "Paid by Customer Service" },
  { value: "pos", label: "POS" },
  { value: "card_mock", label: "Card (Online)" },
  { value: "enet", label: "ENET" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

const MANUAL_PURPOSES = [
  { value: "manual_entry", label: "Manual Entry (General)" },
  { value: "enrollment_full", label: "Membership / Full Payment" },
  { value: "installment", label: "Installment" },
  { value: "deposit", label: "Deposit" },
  { value: "deposit_balance", label: "Deposit Balance" },
  { value: "session_payment", label: "Session Payment" },
];

const MANUAL_STATUSES = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
];

interface ManualEntry {
  id: string;
  amountKwd: string;
  method: string;
  purpose: string;
  status: string;
  manualLabel?: string;
  notes?: string;
  providerRef?: string;
  userId?: string;
  createdByUserId?: string;
  createdAt: string;
}

function ManualEntriesTab({ from, to }: { from?: string; to?: string }) {
  const { getAuthHeader } = useAuth();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [purpose, setPurpose] = useState("manual_entry");
  const [status, setStatus] = useState("completed");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [clinicId, setClinicId] = useState("");
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const clinics = clinicsData?.items ?? [];
  const [ref, setRef] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── List state ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () => {
    setLoadingList(true);
    let url = "/reporting/finance/manual-payments?";
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}`;
    apiFetch(url, { headers: getAuthHeader() })
      .then((d: any) => setEntries(d.items || []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  };

  useEffect(() => { load(); }, [from, to]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setSaveMsg({ type: "err", text: ar() ? "يرجى إدخال مبلغ صحيح" : "Please enter a valid amount" });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        amountKwd: parseFloat(amount).toFixed(3),
        method, purpose, status,
        paymentDate: new Date(paymentDate).toISOString(),
      };
      if (clinicId) body.clinicId = clinicId;
      if (label.trim()) body.manualLabel = label.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (ref.trim()) body.providerRef = ref.trim();

      await apiFetch("/reporting/finance/manual-payment", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaveMsg({ type: "ok", text: ar() ? "تم إضافة القيد بنجاح" : "Entry added successfully" });
      setAmount(""); setLabel(""); setNotes(""); setRef(""); setClinicId("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      load();
    } catch (err: any) {
      setSaveMsg({ type: "err", text: err?.message || "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiFetch(`/reporting/finance/manual-payment/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      setEntries(prev => prev.filter(e => e.id !== id));
      setConfirmDelete(null);
    } catch {
      alert(ar() ? "فشل الحذف" : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  // KPI summary of entries
  const totalCompleted = entries
    .filter(e => e.status === "completed")
    .reduce((s, e) => s + parseKwd(e.amountKwd), 0);

  const purposeLabel = (p: string) =>
    MANUAL_PURPOSES.find(x => x.value === p)?.label ?? p;
  const methodLabel = (m: string) =>
    MANUAL_METHODS.find(x => x.value === m)?.label ?? m;
  const statusBadge: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    refunded: "bg-surface-100 text-surface-500",
    failed: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label={ar() ? "إجمالي القيود المسجّلة" : "Total Manual Entries"} value={String(entries.length)} color="text-brand-pink-600" icon="📋" />
        <KpiCard label={ar() ? "إجمالي المبالغ المكتملة" : "Total Completed Amount"} value={`${fmt(totalCompleted / 1000)} KWD`} color="text-emerald-600" icon="✅" />
        <KpiCard
          label={ar() ? "معلّقة" : "Pending Entries"}
          value={String(entries.filter(e => e.status === "pending").length)}
          color="text-amber-600"
          icon="⏳"
        />
      </div>

      {/* Add Entry Form */}
      <div className="card-elevated p-6">
        <h4 className="font-bold text-surface-900 mb-1 flex items-center gap-2 text-base">
          <span className="w-7 h-7 rounded-lg bg-brand-pink-100 text-brand-pink-600 flex items-center justify-center text-sm">＋</span>
          {ar() ? "إضافة قيد دفع يدوي" : "Add Manual Payment Entry"}
        </h4>
        <p className="text-xs text-surface-400 mb-5">
          {ar()
            ? "استخدم هذا النموذج لتسجيل دفعات لم تُسجَّل تلقائياً في النظام. ستظهر في جميع التقارير المالية."
            : "Use this form to record payments that were not automatically captured by the system. They will appear in all financial reports."}
        </p>
        {saveMsg && (
          <div className={`text-xs mb-4 px-3 py-2 rounded-lg font-medium ${saveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {saveMsg.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "المبلغ (KWD)" : "Amount (KWD)"} <span className="text-red-500">*</span></label>
            <input
              type="number" step="0.001" min="0.001"
              className="input-field"
              placeholder="0.000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"} <span className="text-red-500">*</span></label>
            <select className="select-field" value={method} onChange={e => setMethod(e.target.value)}>
              {MANUAL_METHODS.map(m => <option key={m.value} value={m.value}>{ar() ? METHOD_LABELS[m.value] ?? m.label : m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "نوع الدفعة" : "Purpose"}</label>
            <select className="select-field" value={purpose} onChange={e => setPurpose(e.target.value)}>
              {MANUAL_PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الحالة" : "Status"}</label>
            <select className="select-field" value={status} onChange={e => setStatus(e.target.value)}>
              {MANUAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "العيادة" : "Clinic"}</label>
            <select className="select-field" value={clinicId} onChange={e => setClinicId(e.target.value)}>
              <option value="">{ar() ? "بدون عيادة (الشركة)" : "No Clinic (Corporate)"}</option>
              {clinics.map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "تاريخ الدفعة" : "Payment Date"}</label>
            <input
              type="date"
              className="input-field"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم المرجع / الإيصال" : "Reference / Receipt #"}</label>
            <input type="text" className="input-field" placeholder="TXN-0001" value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "التسمية / الوصف" : "Label / Description"}</label>
            <input type="text" className="input-field" placeholder={ar() ? "مثال: دفعة عميل أحمد" : "e.g. Payment from customer Ahmed"} value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "ملاحظات إضافية" : "Additional Notes"}</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder={ar() ? "أي معلومات إضافية عن هذه الدفعة..." : "Any extra context about this payment..."}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary px-8">
              {saving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "إضافة القيد" : "Add Entry")}
            </button>
          </div>
        </form>
      </div>

      {/* Entries List */}
      <div className="card-elevated overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div>
            <div className="font-bold text-surface-900 text-sm">{ar() ? "القيود اليدوية المسجّلة" : "Recorded Manual Entries"}</div>
            <div className="text-xs text-surface-400 mt-0.5">{ar() ? "جميع هذه القيود مُدرجة في التقارير المالية الشاملة" : "All entries below are included in all financial reports"}</div>
          </div>
          <button onClick={load} className="btn-ghost btn-sm text-xs border border-surface-200 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {ar() ? "تحديث" : "Refresh"}
          </button>
        </div>

        {loadingList ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : entries.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">📋</div>
            <div className="text-sm font-bold text-surface-700">{ar() ? "لا توجد قيود بعد" : "No manual entries yet"}</div>
            <div className="text-xs text-surface-400 mt-1">{ar() ? "استخدم النموذج أعلاه لإضافة أول قيد" : "Use the form above to add your first entry"}</div>
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-surface-100">
            {entries.map(e => (
              <div key={e.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-emerald-700 text-lg">{e.amountKwd} KWD</div>
                    <div className="text-[11px] text-surface-400 mt-0.5 font-mono">{fmtDate(e.createdAt)} • {new Date(e.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusBadge[e.status] ?? "bg-surface-100 text-surface-500"}`}>{e.status}</span>
                </div>
                {(e as any).clinicNameEn && <div className="text-xs text-surface-700 font-medium">🏥 {(e as any).clinicNameEn}</div>}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${METHOD_COLORS[e.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>{methodLabel(e.method)}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">{purposeLabel(e.purpose)}</span>
                </div>
                {e.manualLabel && <div className="text-xs text-surface-600"><span className="text-surface-400 font-medium">{ar() ? "الوصف:" : "Label:"}</span> {e.manualLabel}</div>}
                {e.providerRef && <div className="text-xs text-surface-500 font-mono"><span className="text-surface-400 font-medium">{ar() ? "المرجع:" : "Ref:"}</span> {e.providerRef}</div>}
                {e.notes && <div className="text-xs text-surface-500"><span className="text-surface-400 font-medium">{ar() ? "ملاحظات:" : "Notes:"}</span> {e.notes}</div>}
                <div className="flex justify-end pt-1">
                  {confirmDelete === e.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg">{deleting === e.id ? "…" : (ar() ? "تأكيد الحذف" : "Confirm Delete")}</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-surface-500 hover:text-surface-700 px-3 py-1.5 rounded-lg border border-surface-200">{ar() ? "إلغاء" : "Cancel"}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(e.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      {ar() ? "حذف" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                  <th>{ar() ? "العيادة" : "Clinic"}</th>
                  <th>{ar() ? "المبلغ" : "Amount"}</th>
                  <th>{ar() ? "الطريقة" : "Method"}</th>
                  <th>{ar() ? "النوع" : "Purpose"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                  <th>{ar() ? "الوصف" : "Label"}</th>
                  <th>{ar() ? "المرجع" : "Ref"}</th>
                  <th>{ar() ? "ملاحظات" : "Notes"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-xs font-mono text-surface-500 whitespace-nowrap">
                      {fmtDate(e.createdAt)}<br />
                      <span className="text-[10px]">{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </td>
                    <td className="font-medium text-surface-900 whitespace-nowrap text-xs">
                      {(e as any).clinicNameEn || "—"}
                    </td>
                    <td className="font-black text-emerald-700 whitespace-nowrap">{e.amountKwd} KWD</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${METHOD_COLORS[e.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                        {methodLabel(e.method)}
                      </span>
                    </td>
                    <td className="text-xs text-surface-600">{purposeLabel(e.purpose)}</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge[e.status] ?? "bg-surface-100 text-surface-500"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="text-xs max-w-[140px] truncate" title={e.manualLabel}>{e.manualLabel || <span className="text-surface-300">—</span>}</td>
                    <td className="text-xs font-mono text-surface-500">{e.providerRef || <span className="text-surface-300">—</span>}</td>
                    <td className="text-xs max-w-[160px] truncate text-surface-500" title={e.notes}>{e.notes || <span className="text-surface-300">—</span>}</td>
                    <td>
                      {confirmDelete === e.id ? (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(e.id)}
                            disabled={deleting === e.id}
                            className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg"
                          >
                            {deleting === e.id ? "…" : (ar() ? "تأكيد" : "Confirm")}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-surface-500 hover:text-surface-700 px-2 py-1 rounded-lg border border-surface-200">
                            {ar() ? "إلغاء" : "Cancel"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(e.id)}
                          className="text-surface-400 hover:text-red-500 transition-colors p-1"
                          title={ar() ? "حذف" : "Delete"}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// EFORMS VIEWER
// ===========================================================================

function EFormsViewer({ from, to }: { from: string; to: string }) {
  const { getAuthHeader } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/eforms/admin/submissions?from=${from}&to=${to}`, { headers: getAuthHeader() }) as any;
      setSubmissions(res.items || []);
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubmissions(); }, [from, to]);

  const downloadPdf = async (sub: any) => {
    try {
      const subId = sub.id || sub;
      const headers = getAuthHeader();
      let token = "";
      if (headers?.Authorization?.startsWith("Bearer ")) {
        token = headers.Authorization.slice(7);
      }
      const baseUrl = (import.meta as any).env.VITE_API_URL || "";
      const langParam = ar() ? "ar" : "en";
      const url = `${baseUrl}/eforms/submissions/${subId}/pdf?token=${encodeURIComponent(token)}&lang=${langParam}`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load PDF data");
      const htmlText = await res.text();
      
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "800px";
      iframe.style.height = "1200px";
      iframe.style.left = "-9999px";
      document.body.appendChild(iframe);

      iframe.contentWindow?.document.open();
      iframe.contentWindow?.document.write(htmlText);
      iframe.contentWindow?.document.close();

      await new Promise((resolve) => setTimeout(resolve, 800));

      const title = sub.formTitle || "Form";
      const customer = sub.userName || sub.userId || subId;
      const cleanTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").trim().replace(/\s+/g, "-");
      const cleanCustomer = customer.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").trim().replace(/\s+/g, "-");
      const finalName = `Belamonda-${cleanTitle}-${cleanCustomer}`;

      if (iframe.contentDocument) {
        iframe.contentDocument.title = finalName;
      }
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => iframe.remove(), 2000);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="card-elevated p-5">
      <div className="editorial-header justify-between">
        <div className="flex items-center gap-3">
          <span className="accent" />
          <div>
            <h3>{ar() ? "النماذج الإلكترونية الموقّعة" : "Signed eForms"}</h3>
            <div className="meta">{ar() ? "عرض جميع النماذج الموقّعة من العملاء" : "View all signed forms from customers"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {submissions.length > 0 && <span className="status-pill-pending"><span className="dot" aria-hidden="true" />{submissions.length} {ar() ? "نموذج" : "submissions"}</span>}
          <button className="icon-btn" onClick={fetchSubmissions} aria-label={ar() ? "تحديث" : "Refresh"} title={ar() ? "تحديث" : "Refresh"}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>
      {loading ? <div className="shimmer h-32 rounded-2xl" /> : submissions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا توجد نماذج موقّعة" : "No signed forms"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "لم يتم تقديم أي نماذج بعد" : "No form submissions yet"}</div>
        </div>
      ) : (
        <div className="space-y-1.5 mt-4">
          {submissions.map((s: any) => (
            <div key={s.id} className="queue-row group cursor-pointer" onClick={() => setSelectedSub(s)}>
              <div className="avatar avatar-md bg-indigo-50 text-indigo-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-surface-900 truncate">{s.formTitle || "Untitled Form"}</div>
                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العميل:" : "Customer:"} <span className="font-semibold text-surface-700">{s.userName || s.userId}</span> {s.userPhone && `(${s.userPhone})`} • {new Date(s.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {s.signatureRef && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{ar() ? "موقّع" : "Signed"}</span>}
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); downloadPdf(s); }} title={ar() ? "تحميل PDF" : "Download PDF"}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSub && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-100 shrink-0">
              <h3 className="text-xl font-bold text-surface-900">{selectedSub.formTitle || "Form Submission"}</h3>
              <button className="text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedSub(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "العميل" : "Customer"}</span><span className="font-bold text-surface-900">{selectedSub.userName || selectedSub.userId}<br/><span className="text-xs font-normal text-surface-500">{selectedSub.userPhone}</span></span></div>
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "التاريخ" : "Date"}</span><span className="font-bold text-surface-900">{new Date(selectedSub.createdAt).toLocaleString()}</span></div>
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "إصدار النموذج" : "Form Version"}</span><span className="font-bold text-surface-900">v{selectedSub.formVersion}</span></div>
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "الحالة" : "Status"}</span><span className="font-bold text-emerald-600">{selectedSub.signatureRef ? (ar() ? "موقّع" : "Signed") : (ar() ? "مقدم" : "Submitted")}</span></div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-surface-700 mb-3">{ar() ? "الإجابات" : "Answers"}</h4>
                <div className="space-y-2">
                  {(selectedSub.formSnapshot || []).map((field: any) => {
                    const answer = (selectedSub.answers || []).find((a: any) => a.key === field.key);
                    if (field.type === "static_text") return null;
                    return (
                      <div key={field.key} className="bg-surface-50 p-3 rounded-xl">
                        <span className="text-xs text-surface-400 block mb-0.5">{field.labelEn}{field.required ? " *" : ""}</span>
                        <span className="text-sm font-medium text-surface-900">
                          {field.type === "signature" ? (selectedSub.signatureRef ? (ar() ? "(موقّع)" : "(signed)") : "—")
                            : field.type === "file_upload" ? (ar() ? "(ملف مرفق)" : "(file attached)")
                            : answer?.value != null ? (Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value))
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 pt-4 border-t border-surface-100 shrink-0 flex gap-3">
              <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm" onClick={() => setSelectedSub(null)}>{ar() ? "إغلاق" : "Close"}</button>
              <button className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm" onClick={() => downloadPdf(selectedSub)}>{ar() ? "تحميل PDF" : "Download PDF"}</button>
            </div>
          </div>
        </div>, document.body
      )}
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
