import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import type { ClinicSessionRow, ClinicSessionsSummary } from "../../../hooks/useApi";
import { fmtDateTime } from "../../../lib/dateFormat";
import { ar } from "./shared";
import { downloadClinicSessions } from "./ClinicsTab";

const PAGE = 50;

export function ClinicRowDetail({ clinic, rows, range, saving, onTogglePaid }: {
  clinic: ClinicSessionsSummary;
  rows: ClinicSessionRow[];
  range: { from: string; to: string };
  saving: string | null;
  onTogglePaid: (sessionId: string, paid: boolean) => void;
}) {
  const { getAuthHeader } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [paidFilter, setPaidFilter] = useState<"" | "paid" | "unpaid">("");
  const list = rows.filter(r =>
    !paidFilter || (r.status === "completed" && r.paidToClinic === (paidFilter === "paid"))
  );

  const download = async () => {
    setDownloading(true);
    try { await downloadClinicSessions(getAuthHeader() ?? undefined, range, clinic.clinicId); }
    catch (e: any) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="px-6 py-5 bg-surface-50 border-t border-surface-200 space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-sm text-surface-700">
          {ar() ? "مدفوع لهذا المركز:" : "Paid to this clinic:"}{" "}
          <span className="font-bold text-surface-900">{clinic.paidToClinicCount} / {clinic.completed}</span>{" "}
          {ar() ? "جلسة" : "sessions"}
        </p>
        <select className="select-field text-xs py-1.5 h-auto sm:w-40" value={paidFilter} onChange={e => setPaidFilter(e.target.value as typeof paidFilter)} aria-label={ar() ? "فلتر الدفع للمركز" : "Paid to clinic filter"}>
          <option value="">{ar() ? "كل الجلسات" : "All sessions"}</option>
          <option value="unpaid">{ar() ? "غير مدفوعة للمركز" : "Not paid to clinic"}</option>
          <option value="paid">{ar() ? "مدفوعة للمركز" : "Paid to clinic"}</option>
        </select>
      </div>
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
              <th className="text-center">{ar() ? "مدفوع للمركز" : "Paid to clinic"}</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map(r => (
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
                <td className="text-center">
                  {r.status === "completed" ? (
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-pink-600 cursor-pointer disabled:cursor-wait"
                      checked={r.paidToClinic}
                      disabled={saving === r.sessionId}
                      onChange={e => onTogglePaid(r.sessionId, e.target.checked)}
                      aria-label={`${ar() ? "مدفوع للمركز" : "Paid to clinic"}: ${r.customerName}`}
                    />
                  ) : <span className="text-surface-300">—</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-50 font-bold">
              <td colSpan={4}>{ar() ? "الإجمالي" : "Total"}</td>
              <td>{clinic.completed} / {clinic.noShow}</td>
              <td className="text-right">{clinic.sessionValueKwd}</td>
              <td className="text-right">{clinic.cashbackKwd}</td>
              <td className="text-right">{clinic.paidAtClinicKwd}</td>
              <td className="text-center">{clinic.paidToClinicCount} / {clinic.completed}</td>
            </tr>
          </tbody>
        </table>
        {list.length > shown && (
          <button className="w-full text-center py-2 text-xs text-brand-pink-700 font-bold border-t border-surface-100 hover:bg-surface-50" onClick={() => setShown(shown + PAGE)}>
            {ar() ? `عرض المزيد (${list.length - shown})` : `Show more (${list.length - shown})`}
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
