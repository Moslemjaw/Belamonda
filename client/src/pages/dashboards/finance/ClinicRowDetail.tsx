import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useClinicDetail } from "../../../hooks/useApi";
import { API_BASE_URL } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

export function ClinicRowDetail({ clinicId, from, to }: { clinicId: string; from: string; to: string }) {
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
                <th>{ar() ? "سعر الجلسة" : "Session Price"}</th>
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
                  <td className="font-bold text-surface-900">{inv.sessionPriceKwd ? `${inv.sessionPriceKwd} KWD` : "—"}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${inv.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {inv.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide
                      ${inv.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : ''}
                      ${inv.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : ''}
                      ${inv.status === 'no_show' ? 'bg-red-50 text-red-700' : ''}
                      ${inv.status === 'cancelled' ? 'bg-surface-100 text-surface-600' : ''}
                      ${inv.status === 'request_received' ? 'bg-amber-50 text-amber-700' : ''}
                      ${inv.status === 'slot_assigned' ? 'bg-brand-pink-50 text-brand-pink-700' : ''}
                      ${inv.status === 'checked_in' ? 'bg-teal-50 text-teal-700' : ''}
                      ${inv.status === 'in_progress' ? 'bg-purple-50 text-purple-700' : ''}
                      ${inv.status === 'rescheduled' ? 'bg-orange-50 text-orange-700' : ''}
                    `}>
                      {inv.status.replace(/_/g, ' ')}
                    </span>
                  </td>
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
