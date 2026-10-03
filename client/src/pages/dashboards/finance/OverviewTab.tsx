import { useMemo } from "react";
import { ResponsiveContainer, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useFinanceSnapshot, usePaymentsBreakdown, useFinanceTimeseries } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { ar, fmt, parseKwd, COLORS, PIE_COLORS, METHOD_LABELS, PURPOSE_LABELS } from "./shared";
import type { Period } from "./shared";

export function OverviewTab({ period, from, to }: { period: Period; from: string; to: string }) {
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
