import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useMyClinicReport } from "../../../hooks/useApi";
import { API_BASE_URL } from "../../../lib/api";
import DatePicker from "../../../components/DatePicker";
import { ar, SESSION_STATUS_STYLE } from "./shared";
import { ClinicReportTable } from "./ClinicReportTable";

// ===========================================================================
// REPORTS TAB
// ===========================================================================
export function ClinicReportsTab({ clinicId: _clinicId }: { clinicId: string }) {
  const { getAuthHeader } = useAuth();
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
  });
  const { data, loading } = useMyClinicReport({ from, to });
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (format: "csv" | "xlsx") => {
    setDownloading(format);
    try {
      const params = new URLSearchParams({ from, to, format });
      const res = await fetch(`${API_BASE_URL}/reporting/clinic/export?${params.toString()}`, {
        headers: { ...(getAuthHeader() ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinic-report-${from}-to-${to}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message); }
    finally { setDownloading(null); }
  };

  const s = data?.summary;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-surface-900">{ar() ? "التقارير" : "Reports"}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-surface-500 font-medium">{ar() ? "من" : "From"}</label>
          <DatePicker value={from} onChange={e => setFrom(e.target.value)} className="input-field text-sm py-1.5 px-3 w-36" />
          <label className="text-xs text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
          <DatePicker value={to} onChange={e => setTo(e.target.value)} className="input-field text-sm py-1.5 px-3 w-36" />
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: ar() ? "إجمالي الجلسات" : "Total Sessions", value: s.totalSessions },
            { label: ar() ? "مكتملة" : "Completed", value: s.completedSessions, color: "text-emerald-700" },
            { label: ar() ? "لم يحضر" : "No-Show", value: s.noShowSessions, color: "text-red-700" },
            { label: ar() ? "مجدولة" : "Scheduled", value: s.scheduledSessions, color: "text-blue-700" },
            { label: ar() ? "فواتير مدفوعة" : "Paid Invoices", value: `${s.paidInvoices}/${s.totalInvoices}` },
            { label: ar() ? "إيرادات الجلسات الأساسية" : "Total Sales (Base KWD)", value: `${s.sessionRevenueKwd} KWD`, color: "text-surface-900" },
            { label: ar() ? "الكاشباك المستخدم" : "Cashback Utilized", value: `${s.cashbackTotalKwd} KWD`, color: "text-amber-600" },
            { label: ar() ? "صافي الإيرادات" : "Net Revenue", value: `${s.netRevenueKwd} KWD`, color: "text-emerald-700" },
          ].map(k => (
            <div key={k.label} className="card-elevated border border-surface-200 p-4 shadow-sm rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold mb-1">{k.label}</div>
              <div className={`text-xl font-black ${k.color ?? "text-surface-900"}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-elevated border border-surface-200 shadow-sm rounded-xl p-6 space-y-5">
        <div>
          <h4 className="text-sm font-bold text-surface-900 mb-1">{ar() ? "تصدير التقرير الكامل" : "Export Full Report"}</h4>
          <p className="text-xs text-surface-500">{ar() ? "يتضمن جميع الجلسات والفواتير للفترة المحددة" : "Includes all sessions and invoices for the selected date range"}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => download("xlsx")} disabled={downloading !== null || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-bold disabled:opacity-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            {downloading === "xlsx" ? (ar() ? "جاري التحميل..." : "Downloading...") : "Excel (XLSX)"}
          </button>
        </div>
        <div className="text-xs text-surface-400 flex items-center gap-1.5 pt-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {ar() ? `جاري عرض بيانات من ${from} إلى ${to}` : `Showing data from ${from} to ${to}`}
        </div>
      </div>

      {/* ── Data Table ── */}
      <ClinicReportTable data={data} loading={loading} from={from} to={to} />
    </div>
  );
}

// using SESSION_STATUS_STYLE from top of file
