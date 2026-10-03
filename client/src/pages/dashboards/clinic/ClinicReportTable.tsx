import { useState } from "react";
import { fmtDate } from "../../../lib/dateFormat";
import { ar, SESSION_STATUS_STYLE } from "./shared";

export function ClinicReportTable({ data, loading, from, to }: {
  data: { sessions?: any[]; invoices?: any[] } | null;
  loading: boolean;
  from: string;
  to: string;
}) {
  const [tab, setTab] = useState<"sessions" | "invoices">("sessions");
  const [search, setSearch] = useState("");

  const sessions = data?.sessions ?? [];
  const invoices = data?.invoices ?? [];

  const fmtDateLocal = (iso: string) =>
    iso ? fmtDate(iso) : "—";
  const fmtTime = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";

  const filteredSessions = sessions.filter(s =>
    !search || s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.customerPhone?.includes(search) || s.status?.includes(search.toLowerCase())
  );
  const filteredInvoices = invoices.filter(inv =>
    !search || inv.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customerPhone?.includes(search) || inv.status?.includes(search.toLowerCase())
  );

  return (
    <div className="card-elevated border border-surface-200 shadow-sm rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-surface-100 bg-surface-50/60">
        <div className="flex items-center gap-1 bg-white border border-surface-200 rounded-xl p-1 shadow-sm">
          {(["sessions", "invoices"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? "bg-brand-pink-500 text-white shadow-sm" : "text-surface-500 hover:text-surface-900"}`}>
              {t === "sessions"
                ? `${ar() ? "الجلسات" : "Sessions"} (${sessions.length})`
                : `${ar() ? "الفواتير" : "Invoices"} (${invoices.length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input-field text-xs py-1.5 px-3 w-44"
            placeholder={ar() ? "بحث..." : "Search..."}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
      ) : tab === "sessions" ? (
        filteredSessions.length === 0 ? (
          <div className="py-16 text-center text-sm text-surface-400">{ar() ? "لا توجد جلسات في هذه الفترة" : "No sessions found for this period"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  {["#", ar() ? "العميل" : "Customer", ar() ? "الهاتف" : "Phone", ar() ? "التاريخ" : "Date", ar() ? "الوقت" : "Time", ar() ? "حالة الموعد" : "Appointment", ar() ? "حالة الحضور" : "Attendance", ar() ? "الكاشباك (KWD)" : "Cashback (KWD)"].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-surface-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filteredSessions.map((s, i) => (
                  <tr key={s.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-surface-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-surface-900 whitespace-nowrap">{s.customerName || "—"}</td>
                    <td className="px-4 py-3 text-surface-600 font-mono text-xs" dir="ltr">{s.customerPhone || "—"}</td>
                    <td className="px-4 py-3 text-surface-700 whitespace-nowrap">{fmtDateLocal(s.scheduledAt)}</td>
                    <td className="px-4 py-3 text-surface-500">{fmtTime(s.scheduledAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        s.status === 'completed' && s.clinicPaymentStatus !== 'paid'
                          ? "bg-amber-50 text-amber-700"
                          : SESSION_STATUS_STYLE[s.status] ?? "bg-surface-100 text-surface-500"
                      }`}>
                        {s.status === 'completed' && s.clinicPaymentStatus !== 'paid'
                          ? (ar() ? "بانتظار الدفع" : "Awaiting Session Payment")
                          : s.status === 'slot_accepted' ? (ar() ? "مجدول" : "Scheduled")
                          : s.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const attendanceStatus = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status)
                          ? 'awaiting'
                          : ['checked_in', 'in_progress'].includes(s.status) ? 'checked_in'
                          : s.status === 'completed' ? 'attended'
                          : s.status === 'no_show' ? 'no_show'
                          : 'n_a';
                        const attendanceLabel = attendanceStatus === 'awaiting' ? (ar() ? 'في الانتظار' : 'Awaiting')
                          : attendanceStatus === 'checked_in' ? (ar() ? 'وصل' : 'Checked In')
                          : attendanceStatus === 'attended' ? (ar() ? 'حضر' : 'Attended')
                          : attendanceStatus === 'no_show' ? (ar() ? 'لم يحضر' : 'No Show')
                          : '—';
                        const attendanceStyle = attendanceStatus === 'awaiting' ? 'bg-blue-50 text-blue-700'
                          : attendanceStatus === 'checked_in' ? 'bg-teal-50 text-teal-700'
                          : attendanceStatus === 'attended' ? 'bg-emerald-50 text-emerald-700'
                          : attendanceStatus === 'no_show' ? 'bg-red-50 text-red-700'
                          : 'bg-surface-100 text-surface-500';
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${attendanceStyle}`}>
                            {attendanceLabel}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-emerald-700 font-bold">{s.cashbackUnlockedKwd ? `${s.cashbackUnlockedKwd} KWD` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        filteredInvoices.length === 0 ? (
          <div className="py-16 text-center text-sm text-surface-400">{ar() ? "لا توجد فواتير في هذه الفترة" : "No invoices found for this period"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  {["#", ar() ? "العميل" : "Customer", ar() ? "الهاتف" : "Phone", ar() ? "التاريخ" : "Date", ar() ? "العضوية" : "Membership", ar() ? "السعر (KWD)" : "Price (KWD)", ar() ? "الكاشباك (KWD)" : "Cashback (KWD)", ar() ? "حالة الموعد" : "Appointment", ar() ? "حالة الدفع" : "Payment", ar() ? "حالة الحضور" : "Attendance"].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider text-surface-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {filteredInvoices.map((inv, i) => (
                  <tr key={inv.id} className="hover:bg-surface-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-surface-400 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-surface-900 whitespace-nowrap">{inv.customerName || "—"}</td>
                    <td className="px-4 py-3 text-surface-600 font-mono text-xs" dir="ltr">{inv.customerPhone || "—"}</td>
                    <td className="px-4 py-3 text-surface-700 whitespace-nowrap">{fmtDateLocal(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-surface-600 text-xs">{inv.membershipType || "—"}</td>
                    <td className="px-4 py-3 font-bold text-surface-900">{inv.sessionPriceKwd ? `${inv.sessionPriceKwd} KWD` : "—"}</td>
                    <td className="px-4 py-3 text-emerald-700 font-bold">{inv.cashbackDeductedKwd ? `${inv.cashbackDeductedKwd} KWD` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        inv.status === 'completed' && inv.clinicPaymentStatus !== 'paid'
                          ? "bg-amber-50 text-amber-700"
                          : SESSION_STATUS_STYLE[inv.status] ?? "bg-surface-100 text-surface-500"
                      }`}>
                        {inv.status === 'completed' && inv.clinicPaymentStatus !== 'paid'
                          ? (ar() ? "بانتظار الدفع" : "Awaiting Session Payment")
                          : inv.status === 'slot_accepted' ? (ar() ? "مجدول" : "Scheduled")
                          : inv.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {inv.clinicPaymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const attendanceStatus = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(inv.status)
                          ? 'awaiting'
                          : ['checked_in', 'in_progress'].includes(inv.status) ? 'checked_in'
                          : inv.status === 'completed' ? 'attended'
                          : inv.status === 'no_show' ? 'no_show'
                          : 'n_a';
                        const attendanceLabel = attendanceStatus === 'awaiting' ? (ar() ? 'في الانتظار' : 'Awaiting')
                          : attendanceStatus === 'checked_in' ? (ar() ? 'وصل' : 'Checked In')
                          : attendanceStatus === 'attended' ? (ar() ? 'حضر' : 'Attended')
                          : attendanceStatus === 'no_show' ? (ar() ? 'لم يحضر' : 'No Show')
                          : '—';
                        const attendanceStyle = attendanceStatus === 'awaiting' ? 'bg-blue-50 text-blue-700'
                          : attendanceStatus === 'checked_in' ? 'bg-teal-50 text-teal-700'
                          : attendanceStatus === 'attended' ? 'bg-emerald-50 text-emerald-700'
                          : attendanceStatus === 'no_show' ? 'bg-red-50 text-red-700'
                          : 'bg-surface-100 text-surface-500';
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${attendanceStyle}`}>
                            {attendanceLabel}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Footer count */}
      {!loading && (
        <div className="px-5 py-3 border-t border-surface-100 bg-surface-50/40 text-xs text-surface-400">
          {tab === "sessions"
            ? `${filteredSessions.length} ${ar() ? "جلسة" : "session(s)"}`
            : `${filteredInvoices.length} ${ar() ? "فاتورة" : "invoice(s)"}`}
          {search && ` ${ar() ? "— نتائج البحث" : "— filtered"}`}
        </div>
      )}
    </div>
  );
}
