import { useState } from "react";
import { useClinicSummaries } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { ar, fmt, parseKwd } from "./shared";
import { ClinicRowDetail } from "./ClinicRowDetail";

export function ClinicsTab({ from, to }: { from: string; to: string }) {
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
        <KpiCard label={ar() ? "إجمالي العيادات" : "Total Clinics"} value={String(data?.items.length ?? 0)} accent="indigo" icon="🏥" />
        <KpiCard label={ar() ? "إجمالي الجلسات" : "Total Sessions"} value={String(totalSessions)} accent="blue" icon="📅" />
        <KpiCard label={ar() ? "متوسط الاستخدام" : "Avg Utilization"} value={`${avgUtilization.toFixed(1)}%`} accent="emerald" icon="📈" />
        <KpiCard label={ar() ? "إجمالي الإيرادات" : "Total Revenue"} value={`${fmt(totalRevenue)} KWD`} accent="pink" icon="💰" />
        <KpiCard label={ar() ? "إيرادات مؤجلة (مقدرة)" : "Deferred (Est.)"} value={`${fmt(totalDeferred)} KWD`} accent="amber" icon="⏳" />
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
