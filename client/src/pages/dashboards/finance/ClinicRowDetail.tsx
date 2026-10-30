import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import type { ClinicSessionRow, ClinicSessionsSummary } from "../../../hooks/useApi";
import { fmtDateTime } from "../../../lib/dateFormat";
import { ar } from "./shared";
import { downloadClinicSessions } from "./ClinicsTab";

const PAGE = 50;

export function ClinicRowDetail({ clinic, rows, range }: {
  clinic: ClinicSessionsSummary;
  rows: ClinicSessionRow[];
  range: { from: string; to: string };
}) {
  const { getAuthHeader } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const download = async () => {
    setDownloading(true);
    try { await downloadClinicSessions(getAuthHeader() ?? undefined, range, clinic.clinicId); }
    catch (e: any) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="px-6 py-5 bg-surface-50 border-t border-surface-200 space-y-4 animate-fade-in">
      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm">
        <table className="data-table text-xs">
          <thead>
            <tr className="bg-surface-50">
              <th>{ar() ? "التاريخ" : "Date"}</th>
              <th>{ar() ? "العميل" : "Customer"}</th>
              <th>{ar() ? "الباقة أو الخدمة" : "Package / service"}</th>
              <th>{ar() ? "إضافات" : "Extras"}</th>
              <th>{ar() ? "الحالة" : "Status"}</th>
              <th className="text-right">{ar() ? "القيمة" : "Value"}</th>
              <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
              <th className="text-right">{ar() ? "مدفوع في المركز" : "Paid at clinic"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map(r => (
              <tr key={r.sessionId}>
                <td className="text-surface-500 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                <td>
                  <div className="font-medium">{r.customerName}</div>
                  {r.customerPhone && <div className="text-[10px] text-surface-400">{r.customerPhone}</div>}
                </td>
                <td>
                  {r.packageName || "—"}
                  {r.membershipCancelled && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{ar() ? "اشتراك ملغي" : "Cancelled membership"}</span>
                  )}
                </td>
                <td className="text-surface-500">{r.extras || "—"}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${r.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {r.status === "completed" ? (ar() ? "حضر" : "Completed") : (ar() ? "لم يحضر" : "No-show")}
                  </span>
                </td>
                <td className="text-right font-bold text-surface-900">{r.sessionValueKwd}</td>
                <td className="text-right text-amber-700">{r.cashbackKwd}</td>
                <td className="text-right font-bold text-brand-pink-700">{r.paidAtClinicKwd}</td>
              </tr>
            ))}
            <tr className="bg-surface-50 font-bold">
              <td colSpan={4}>{ar() ? "الإجمالي" : "Total"}</td>
              <td>{clinic.completed} / {clinic.noShow}</td>
              <td className="text-right">{clinic.sessionValueKwd}</td>
              <td className="text-right">{clinic.cashbackKwd}</td>
              <td className="text-right">{clinic.paidAtClinicKwd}</td>
            </tr>
          </tbody>
        </table>
        {rows.length > shown && (
          <button className="w-full text-center py-2 text-xs text-brand-pink-700 font-bold border-t border-surface-100 hover:bg-surface-50" onClick={() => setShown(shown + PAGE)}>
            {ar() ? `عرض المزيد (${rows.length - shown})` : `Show more (${rows.length - shown})`}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-surface-500 font-medium">{ar() ? "تقرير هذا المركز:" : "This clinic's report:"}</span>
        <button onClick={() => void download()} disabled={downloading}
          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold disabled:opacity-50">
          {downloading ? "..." : "Excel"}
        </button>
      </div>
    </div>
  );
}
