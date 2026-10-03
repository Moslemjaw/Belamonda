import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useMyClinicReport } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { ar, SESSION_STATUS_STYLE } from "./shared";

// ===========================================================================
// COMPLETED SESSIONS TAB
// ===========================================================================
export function ClinicCompletedSessionsTab({ clinicId: _clinicId }: { clinicId: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
  });
  const [search, setSearch] = useState("");
  const { data, loading } = useMyClinicReport({ from, to });
  const { getAuthHeader } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (invoiceId: string) => {
    if (!window.confirm(ar() ? "هل أنت متأكد من حذف هذه الجلسة؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to delete this session? This cannot be undone.")) return;
    setDeletingId(invoiceId);
    try {
      await apiFetch(`/scheduling/admin/requests/${invoiceId}`, {
        method: "DELETE",
        headers: getAuthHeader()
      });
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const invoices = data?.invoices ?? [];
  // Filter to only completed sessions
  const completedInvoices = invoices.filter(inv => inv.status === 'completed');
  
  const filteredInvoices = completedInvoices.filter(inv =>
    !search || inv.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    inv.customerPhone?.includes(search)
  );

  const totalRevenue = completedInvoices.reduce((sum, inv) => sum + parseFloat(inv.sessionPriceKwd || "0"), 0);
  const paidCount = completedInvoices.filter(inv => inv.clinicPaymentStatus === "paid").length;
  const pendingCount = completedInvoices.length - paidCount;
  const paidRevenue = completedInvoices.filter(inv => inv.clinicPaymentStatus === "paid").reduce((sum, inv) => sum + parseFloat(inv.sessionPriceKwd || "0"), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-surface-900">{ar() ? "الجلسات المكتملة" : "Completed Sessions"}</h3>
          <p className="text-sm text-surface-500 mt-1">
            {ar() ? "عرض جميع الجلسات المكتملة في العيادة" : "View all completed sessions for your clinic"}
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <svg className={`w-5 h-5 text-surface-400 absolute top-1/2 -translate-y-1/2 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            className={`input-field w-full ${ar() ? 'pr-10' : 'pl-10'}`}
            placeholder={ar() ? "بحث بالاسم او الهاتف..." : "Search customer name or phone..."}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-auto flex flex-wrap md:flex-nowrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-surface-500 font-bold uppercase tracking-wider whitespace-nowrap">{ar() ? "من" : "From"}</label>
            <DatePicker value={from} onChange={e => setFrom(e.target.value)} className="input-field w-full md:w-36 font-medium text-surface-700" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-surface-500 font-bold uppercase tracking-wider whitespace-nowrap">{ar() ? "إلى" : "To"}</label>
            <DatePicker value={to} onChange={e => setTo(e.target.value)} className="input-field w-full md:w-36 font-medium text-surface-700" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: ar() ? "الجلسات المكتملة" : "Completed Sessions", value: completedInvoices.length, color: "text-emerald-700" },
          { label: ar() ? "مدفوعة" : "Paid", value: paidCount, color: "text-emerald-700" },
          { label: ar() ? "معلقة" : "Pending", value: pendingCount, color: "text-amber-700" },
          { label: ar() ? "الإيرادات المدفوعة" : "Paid Revenue", value: `${paidRevenue.toFixed(3)} KWD`, color: "text-emerald-700" },
        ].map(k => (
          <div key={k.label} className="card-elevated border border-surface-200 p-4 shadow-sm rounded-xl">
            <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold mb-1">{k.label}</div>
            <div className={`text-2xl font-black ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden rounded-xl">
        {loading ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "لا توجد جلسات مكتملة في هذه الفترة" : "No completed sessions found"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-sm">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                  <th>{ar() ? "العميل" : "Customer"}</th>
                  <th>{ar() ? "نوع العضوية" : "Membership Type"}</th>
                  <th>{ar() ? "سعر الجلسة" : "Session Price"}</th>
                  <th>{ar() ? "حالة الموعد" : "Appointment"}</th>
                  <th>{ar() ? "حالة الدفع" : "Payment"}</th>
                  <th>{ar() ? "حالة الحضور" : "Attendance"}</th>
                  <th className="text-right">{ar() ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="text-surface-500 whitespace-nowrap">{fmtDate(inv.scheduledAt || inv.createdAt)}</td>
                    <td>
                      <div className="font-medium text-surface-900">{inv.customerName}</div>
                      {inv.customerPhone && <div className="text-xs text-surface-400">{inv.customerPhone}</div>}
                    </td>
                    <td className="capitalize text-surface-600">{inv.membershipType ?? "—"}</td>
                    <td className="font-bold text-surface-900">
                      {inv.sessionPriceKwd ? `${inv.sessionPriceKwd} KWD` : "—"}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                        inv.status === 'completed' && inv.clinicPaymentStatus !== 'paid'
                          ? "bg-amber-50 text-amber-700"
                          : SESSION_STATUS_STYLE[inv.status] ?? "bg-surface-100 text-surface-500"
                      }`}>
                        {inv.status === 'completed' && inv.clinicPaymentStatus !== 'paid'
                          ? (ar() ? "بانتظار الدفع" : "AWAITING SESSION PAYMENT")
                          : inv.status === 'slot_accepted' ? (ar() ? "مجدول" : "SCHEDULED")
                          : inv.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${inv.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {inv.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide bg-emerald-50 text-emerald-700">
                        {ar() ? "حضر" : "Attended"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDelete(inv.id)}
                        disabled={deletingId === inv.id}
                        className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {deletingId === inv.id ? (ar() ? "جاري الحذف..." : "Deleting...") : (ar() ? "حذف" : "Delete")}
                      </button>
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
