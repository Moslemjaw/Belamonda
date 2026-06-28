import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useClinicSchedule, useMyClinicReport, invalidateCache } from "../../hooks/useApi";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import { sharedClinics } from "../../lib/clinics";
import { fmtDate } from "../../lib/dateFormat";
import i18n from "../../app/i18n";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReferralActivityWidget } from "../../components/ReferralActivityWidget";
import NoticeBanner from "../../components/NoticeBanner";
import { KpiCard } from "../../components/KpiCard";

const ar = () => i18n.language === "ar";


function SessionCard({ session, onMark, onMarkPaid }: { session: any; onMark: (id: string, status: string) => void; onMarkPaid: (id: string) => void }) {
  const { getAuthHeader } = useAuth();
  
  const isPast = session.status !== "scheduled";
  const isOfferActive = isPast ? true : (session.userOfferId ? session.eligibility?.offerActive : true);
  const isPaymentConfirmed = isPast ? true : (session.clinicPaymentStatus === "paid" || session.eligibility?.paymentConfirmed);
  const isIntervalMet = isPast ? true : (session.eligibility?.intervalMet !== false);

  const allGreen = isOfferActive && isPaymentConfirmed && isIntervalMet;
  const time = new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = fmtDate(session.scheduledAt);

  const gross = parseFloat(session.sessionPriceKwd || "0");
  const isFree = gross === 0;

  return (
    <div className={`card-elevated p-5 relative overflow-hidden group transition-all hover:shadow-lg flex flex-col rounded-[24px] border ${!allGreen && session.status === "scheduled" ? "border-red-200 bg-red-50/30" : "border-surface-200 bg-white/80 backdrop-blur-xl"}`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${session.status === 'completed' ? 'bg-emerald-500' : session.status === 'no_show' ? 'bg-red-500' : session.status === 'cancelled' ? 'bg-surface-300' : 'bg-brand-pink-500'}`} />
      
      <div className="flex flex-col gap-4 mb-5 pl-2">
        <div className="flex items-center gap-3">
           <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-surface-100 to-surface-200 border border-white flex items-center justify-center text-brand-pink-600 font-bold text-xl shadow-sm shrink-0">
             {(session.customerName || session.userId || "?").charAt(0).toUpperCase()}
           </div>
           <div className="flex-1 min-w-0">
             <div className="text-base font-black text-surface-900 truncate">{session.customerName || (ar() ? "عميل" : "Customer")}</div>
             <div className="text-xs text-surface-500 font-medium mt-0.5">{session.offerName ? <><span className="text-brand-pink-500 font-bold">{session.offerName}</span> · </> : null}{date}</div>
           </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
           <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100/80 text-surface-900 text-sm font-bold shadow-sm">
             <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             {time}
           </span>
           {session.membershipType && session.membershipType !== "none" && <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-brand-pink-50 text-brand-pink-600 border border-brand-pink-100 uppercase tracking-wider">{session.membershipType}</span>}
        </div>
      </div>

      <div className="space-y-3 mb-5 pl-2">
        <div className={`p-3 rounded-xl border ${isFree ? "bg-emerald-50 border-emerald-200 text-emerald-800" : session.clinicPaymentStatus === "paid" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">{ar() ? "حالة الدفع" : "Payment Status"}</span>
            {isFree ? (
              <span className="text-xs font-black uppercase flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> FREE SESSION</span>
            ) : session.clinicPaymentStatus === "paid" ? (
              <span className="text-xs font-black uppercase flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> PAID</span>
            ) : (
              <span className="text-xs font-black uppercase flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> PENDING</span>
            )}
          </div>
          {!isFree && (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black">{session.sessionPriceKwd} KWD</span>
              {session.cashbackDeductedKwd && parseFloat(session.cashbackDeductedKwd) > 0 && (
                <span className="text-[10px] opacity-80">(Cashback deducted: {session.cashbackDeductedKwd} KWD)</span>
              )}
            </div>
          )}
          {!isFree && session.clinicPaymentStatus !== "paid" && session.bookingRequestId && (
            <button
              onClick={() => onMarkPaid(session.bookingRequestId!)}
              className="mt-2 w-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg transition-colors shadow-sm"
            >
              {ar() ? "تأكيد الدفع النقدى" : "Mark as Paid (Cash)"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto pl-2">
        {session.status === "scheduled" && (
          <div className={`text-center py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-200`}>
            {session.status.replace("_", " ")}
          </div>
        )}
        {session.status !== "scheduled" && (
          <div className={`text-center py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border ${session.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : session.status === 'no_show' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-surface-100 text-surface-600 border-surface-200'}`}>
            {session.status.replace("_", " ")}
          </div>
        )}
      </div>

      {session.cashbackUnlockedKwd && parseFloat(session.cashbackUnlockedKwd) > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-emerald-400 text-white text-[10px] font-bold px-3 py-1 rounded-bl-[20px] shadow-sm">
           +{session.cashbackUnlockedKwd} KWD
        </div>
      )}
    </div>
  );
}

function ScheduleTable({
  sessions,
  onMark,
  onMarkPaid,
}: {
  sessions: any[];
  onMark: (id: string, status: string) => void;
  onMarkPaid: (bookingRequestId: string) => void;
}) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);

  const groups = {
    today: sessions.filter((s) => {
      const t = new Date(s.scheduledAt);
      return t >= today && t < tomorrow;
    }),
    tomorrow: sessions.filter((s) => {
      const t = new Date(s.scheduledAt);
      return t >= tomorrow && t < dayAfterTomorrow;
    }),
    upcoming: sessions.filter((s) => new Date(s.scheduledAt) >= dayAfterTomorrow),
  };

  const renderRows = (items: any[]) =>
    items.map((s) => (
      <tr key={s.id} className="border-b border-surface-100">
        <td className="py-2">
          <div className="text-sm font-semibold text-surface-800">{s.customerName || "Customer"}</div>
          {s.customerPhone && <div className="text-xs font-mono text-surface-500 mt-0.5" dir="ltr">{s.customerPhone}</div>}
        </td>
        <td className="py-2 text-sm text-surface-600">{s.offerName || "Session"}</td>
        <td className="py-2 text-sm text-surface-600">{new Date(s.scheduledAt).toLocaleString()}</td>
        <td className="py-2 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.status === "completed" ? "bg-emerald-100 text-emerald-700" : s.status === "no_show" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
            {s.status}
          </span>
        </td>
        <td className="py-2 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.clinicPaymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {s.clinicPaymentStatus === "paid" ? "Paid" : "Pending"}
          </span>
        </td>
      </tr>
    ));

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div className="bg-white rounded-2xl border border-surface-200 p-4">
      <h4 className="text-sm font-bold text-surface-900 mb-3">{title} ({items.length})</h4>
      {items.length === 0 ? (
        <div className="text-xs text-surface-400 py-4">No sessions</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-surface-400 border-b border-surface-100">
                <th className="py-2">Customer</th>
                <th className="py-2">Service</th>
                <th className="py-2">Time</th>
                <th className="py-2">Status</th>
                <th className="py-2">Payment</th>
              </tr>
            </thead>
            <tbody>{renderRows(items)}</tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <Section title="Today" items={groups.today} />
      <Section title="Tomorrow" items={groups.tomorrow} />
      <Section title="Upcoming" items={groups.upcoming} />
    </div>
  );
}

function ClinicPerformanceTab({ sessions, completed, noShows, scheduled }: {
  clinicId: string;
  sessions: any[];
  completed: any[];
  noShows: any[];
  scheduled: any[];
}) {
  const completionRate = sessions.length > 0 ? ((completed.length / sessions.length) * 100).toFixed(1) : "0";
  const noShowRate = sessions.length > 0 ? ((noShows.length / sessions.length) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-xl font-bold text-surface-900">{ar() ? "أداء العيادة" : "Clinic Performance"}</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard icon={Icons.calendar} label={ar() ? "جلسات مكتملة" : "Completed"} value={completed.length} accent="emerald" />
        <KpiCard icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          label={ar() ? "معدل الإكمال" : "Completion Rate"} value={`${completionRate}%`} accent="blue" />
        <KpiCard icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
          label={ar() ? "نسبة عدم الحضور" : "No-Show Rate"} value={`${noShowRate}%`} accent="red" />
        <KpiCard icon={Icons.calendar} label={ar() ? "جلسات قادمة" : "Upcoming"} value={scheduled.length} accent="pink" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-elevated p-6 border border-surface-200 shadow-sm">
          <h4 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "توزيع الجلسات" : "Session Breakdown"}</h4>
          <div className="space-y-3">
            {[
              { label: ar() ? "مكتملة" : "Completed", count: completed.length, color: "bg-emerald-500", total: sessions.length },
              { label: ar() ? "مجدولة" : "Upcoming", count: scheduled.length, color: "bg-blue-400", total: sessions.length },
              { label: ar() ? "لم يحضر" : "No-Show", count: noShows.length, color: "bg-red-400", total: sessions.length },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-surface-600 font-medium">{row.label}</span>
                  <span className="font-bold text-surface-900">{row.count} <span className="text-surface-400 font-normal">/ {row.total}</span></span>
                </div>
                <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${row.color}`}
                    style={{ width: row.total > 0 ? `${(row.count / row.total) * 100}%` : "0%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-6 border border-surface-200 shadow-sm">
          <h4 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "نشاط الإحالات" : "Referral Activity"}</h4>
          <ReferralActivityWidget />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// INVOICES TAB
// ===========================================================================
function ClinicInvoicesTab({ clinicId: _clinicId }: { clinicId: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
  });
  const { data, loading } = useMyClinicReport({ from, to });

  const invoices = data?.invoices ?? [];
  const s = data?.summary;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-surface-900">{ar() ? "الفواتير" : "Invoices"}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-surface-500 font-medium">{ar() ? "من" : "From"}</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field text-sm py-1.5 px-3 w-36" />
          <label className="text-xs text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field text-sm py-1.5 px-3 w-36" />
        </div>
      </div>

      {s && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: ar() ? "إجمالي الفواتير" : "Total Invoices", value: s.totalInvoices, color: "text-surface-900" },
            { label: ar() ? "مدفوعة" : "Paid", value: s.paidInvoices, color: "text-emerald-700" },
            { label: ar() ? "معلقة" : "Pending", value: s.pendingInvoices, color: "text-amber-700" },
            { label: ar() ? "الإيرادات المدفوعة" : "Paid Revenue", value: `${s.paidRevenueKwd} KWD`, color: "text-emerald-700" },
          ].map(k => (
            <div key={k.label} className="card-elevated border border-surface-200 p-4 shadow-sm rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-surface-500 font-bold mb-1">{k.label}</div>
              <div className={`text-2xl font-black ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden rounded-xl">
        {loading ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : invoices.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "لا توجد فواتير في هذه الفترة" : "No invoices in this period"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-sm">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                  <th>{ar() ? "العميل" : "Customer"}</th>
                  <th>{ar() ? "نوع العضوية" : "Membership Type"}</th>
                  <th className="text-right">{ar() ? "سعر الجلسة" : "Session Price"}</th>
                  <th>{ar() ? "دفعة العيادة" : "Clinic Payment"}</th>
                  <th>{ar() ? "حالة الفاتورة" : "Invoice Status"}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="text-surface-500 whitespace-nowrap">{fmtDate(inv.createdAt)}</td>
                    <td>
                      <div className="font-medium text-surface-900">{inv.customerName}</div>
                      {inv.customerPhone && <div className="text-xs text-surface-400">{inv.customerPhone}</div>}
                    </td>
                    <td className="capitalize text-surface-600">{inv.membershipType ?? "—"}</td>
                    <td className="text-right font-bold text-surface-900">
                      {inv.sessionPriceKwd ? `${inv.sessionPriceKwd} KWD` : "—"}
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${inv.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {inv.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
                      </span>
                    </td>
                    <td className="text-surface-500 capitalize">{inv.status.replace(/_/g, " ")}</td>
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
// REPORTS TAB
// ===========================================================================
function ClinicReportsTab({ clinicId: _clinicId }: { clinicId: string }) {
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
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field text-sm py-1.5 px-3 w-36" />
          <label className="text-xs text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field text-sm py-1.5 px-3 w-36" />
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

const SESSION_STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-blue-50 text-blue-700",
  no_show:   "bg-red-50 text-red-600",
  cancelled: "bg-surface-100 text-surface-500",
};

function ClinicReportTable({ data, loading, from, to }: {
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
                  {["#", ar() ? "العميل" : "Customer", ar() ? "الهاتف" : "Phone", ar() ? "التاريخ" : "Date", ar() ? "الوقت" : "Time", ar() ? "الحالة" : "Status", ar() ? "الكاشباك (KWD)" : "Cashback (KWD)"].map(h => (
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${SESSION_STATUS_STYLE[s.status] ?? "bg-surface-100 text-surface-500"}`}>
                        {s.status?.replace("_", " ")}
                      </span>
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
                  {["#", ar() ? "العميل" : "Customer", ar() ? "الهاتف" : "Phone", ar() ? "التاريخ" : "Date", ar() ? "العضوية" : "Membership", ar() ? "السعر (KWD)" : "Price (KWD)", ar() ? "الكاشباك (KWD)" : "Cashback (KWD)", ar() ? "حالة الفاتورة" : "Invoice", ar() ? "حالة الدفع" : "Payment"].map(h => (
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${SESSION_STATUS_STYLE[inv.status] ?? "bg-surface-100 text-surface-500"}`}>
                        {inv.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inv.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {inv.clinicPaymentStatus}
                      </span>
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

// ===========================================================================
// QR CARD SCANNER TAB
// ===========================================================================
const SESSION_STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  no_show: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-surface-100 text-surface-500 border-surface-200",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  pending_payment: "bg-amber-50 text-amber-700",
  reserved: "bg-blue-50 text-blue-700",
  expired: "bg-surface-100 text-surface-500",
  cancelled: "bg-red-50 text-red-600",
};


function POSCheckoutModal({ isOpen, onClose, baseAmountKwd, walletBalanceKwd, baseCashbackKwd, baseItemName, onSubmit, isBooking, clinicProducts }: {
  isOpen: boolean;
  onClose: () => void;
  baseAmountKwd: string;
  walletBalanceKwd: string;
  baseCashbackKwd: string;
  baseItemName?: string;
  onSubmit: (extraItems: any[], cashbackToDeductKwd: string) => Promise<void>;
  isBooking?: boolean;
  clinicProducts?: {name: string; nameAr?: string; nameEn?: string; priceKwd: string; cashbackDeductionKwd?: string}[];
}) {
  const { t } = useTranslation();
  const [extraItems, setExtraItems] = useState<{name: string, priceKwd: string, cashbackDeductionKwd?: string, qty: number}[]>([]);
  const [useCashback, setUseCashback] = useState(true);
  const [customCb, setCustomCb] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCbDeduction, setNewItemCbDeduction] = useState("");

  const baseAmount = parseFloat(baseAmountKwd || "0");
  const walletBalance = parseFloat(walletBalanceKwd || "0");
  const baseCb = parseFloat(baseCashbackKwd || "0");
  
  const extraSum = extraItems.reduce((sum, item) => sum + parseFloat(item.priceKwd || "0") * item.qty, 0);
  const extraCbSum = extraItems.reduce((sum, item) => sum + parseFloat(item.cashbackDeductionKwd || "0") * item.qty, 0);
  
  const totalBill = baseAmount + extraSum;
  // Cashback = sum of per-session deductions, capped by wallet balance
  const totalCbAllowance = baseCb + extraCbSum;
  const maxCb = Math.min(totalCbAllowance, walletBalance);
  
  let applicableCashback = 0;
  if (useCashback) {
    if (customCb.trim() !== "") {
      applicableCashback = Math.min(Math.max(0, parseFloat(customCb) || 0), maxCb, totalBill);
    } else {
      applicableCashback = Math.min(totalBill, maxCb);
    }
  }
  
  const finalPay = Math.max(0, totalBill - applicableCashback);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <h3 className="font-bold text-surface-900 text-lg">{ar() ? "تأكيد الدفع والسداد" : "POS Checkout"}</h3>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-200 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Base Session */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <span className="font-bold text-surface-700">{baseItemName || (ar() ? "حجز الجلسة الأساسي" : "Session Booking Base")}</span>
            <span className="font-mono font-bold text-surface-900">{baseAmount.toFixed(3)} KWD</span>
          </div>

          {/* Extra Items */}
          <div className="space-y-3">
            <div className="font-bold text-sm text-surface-900">{ar() ? "الخدمات والمنتجات الإضافية" : "Additional Products / Services"}</div>
            {extraItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-3 bg-surface-50 rounded-xl border border-surface-100">
                <div className="flex-1">
                  <div className="font-bold">{item.name}</div>
                  <div className="text-xs text-surface-500">{item.qty} × {parseFloat(item.priceKwd).toFixed(3)} KWD</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-surface-900">{(item.qty * parseFloat(item.priceKwd)).toFixed(3)}</span>
                  <button onClick={() => setExtraItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            
            <div className="space-y-2">
              {clinicProducts && clinicProducts.length > 0 ? (
                <div className="flex gap-2">
                  <select 
                    className="input-field text-sm flex-1 py-2"
                    onChange={e => {
                      const p = clinicProducts.find(x => x.name === e.target.value);
                      if (p) {
                        setNewItemName(ar() ? (p.nameAr || p.name) : (p.nameEn || p.name));
                        setNewItemPrice(p.priceKwd);
                        setNewItemCbDeduction(p.cashbackDeductionKwd || "0");
                      } else {
                        setNewItemName("");
                        setNewItemPrice("");
                        setNewItemCbDeduction("");
                      }
                    }}
                    value={clinicProducts.find(x => (ar() ? (x.nameAr || x.name) : (x.nameEn || x.name)) === newItemName)?.name || ""}
                  >
                    <option value="">{ar() ? "-- اختر منتج / جلسة --" : "-- Select Product / Session --"}</option>
                    {clinicProducts.map((p, idx) => {
                      const displayName = ar() ? (p.nameAr || p.name) : (p.nameEn || p.name);
                      return <option key={idx} value={p.name}>{displayName} - {parseFloat(p.priceKwd).toFixed(3)} KWD</option>;
                    })}
                  </select>
                  <button onClick={() => {
                    if (!newItemName.trim() || !newItemPrice || isNaN(Number(newItemPrice))) return;
                    setExtraItems(prev => {
                      const existing = prev.find(x => x.name === newItemName);
                      if (existing) {
                        return prev.map(x => x.name === newItemName ? { ...x, qty: x.qty + 1 } : x);
                      }
                      return [...prev, { name: newItemName, priceKwd: Number(newItemPrice).toFixed(3), cashbackDeductionKwd: newItemCbDeduction, qty: 1 }];
                    });
                    setNewItemName("");
                    setNewItemPrice("");
                    setNewItemCbDeduction("");
                  }} className="btn-secondary py-2 px-4 bg-brand-pink-50 text-brand-pink-700 hover:bg-brand-pink-100 border-none font-bold" disabled={!newItemName}>+</button>
                </div>
              ) : (
                <div className="text-xs text-surface-400 bg-surface-50 p-2 rounded-lg text-center">
                  {ar() ? "لا توجد منتجات مسجلة لهذه العيادة" : "No products available for this clinic"}
                </div>
              )}
            </div>
          </div>

          {/* Cashback */}
          {maxCb > 0 && (
            <div className="p-4 bg-brand-pink-50 rounded-xl border border-brand-pink-200">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={useCashback} onChange={e => {
                    setUseCashback(e.target.checked);
                    if (!e.target.checked) setCustomCb("");
                  }} className="rounded text-brand-pink-500 focus:ring-brand-pink-500 w-4 h-4" />
                  <span className="font-bold text-sm text-brand-pink-900">{ar() ? "خصم الكاشباك" : "Apply Cashback"}</span>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-white rounded-lg text-brand-pink-700 shadow-sm border border-brand-pink-100">
                  {ar() ? "الحد الأقصى:" : "Max:"} {maxCb.toFixed(3)}
                </div>
              </label>
              {useCashback && (
                <div className="mt-3 text-sm text-brand-pink-800 flex justify-between border-t border-brand-pink-100/50 pt-3 items-center">
                  <span>{ar() ? "مبلغ الخصم (اختياري جزء):" : "Amount to use (optional):"}</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max={maxCb} 
                      step="0.001"
                      className="border border-brand-pink-200 rounded-lg py-1 px-2 text-right w-24 text-sm focus:ring-brand-pink-400 focus:border-brand-pink-400 bg-white"
                      placeholder={maxCb.toFixed(3)}
                      value={customCb}
                      onChange={e => setCustomCb(e.target.value)}
                    />
                    <span className="font-bold font-mono">KWD</span>
                  </div>
                </div>
              )}
              {useCashback && applicableCashback > 0 && (
                <div className="mt-2 text-sm text-brand-pink-800 flex justify-end gap-2">
                  <span>{ar() ? "الخصم المطبق:" : "Applied Discount:"}</span>
                  <span className="font-bold font-mono">- {applicableCashback.toFixed(3)} KWD</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-surface-100 bg-surface-50 space-y-4">
          <div className="flex items-end justify-between">
            <div className="text-sm font-bold text-surface-500 uppercase tracking-wider">{ar() ? "الإجمالي المطلوب" : "Total to Pay"}</div>
            <div className="text-3xl font-black text-emerald-600">{finalPay.toFixed(3)} <span className="text-sm">KWD</span></div>
          </div>
          <button 
            onClick={async () => {
              setLoading(true);
              try {
                await onSubmit(extraItems, applicableCashback.toFixed(3));
                onClose();
              } catch(e: any) {
                alert(e.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="btn-primary w-full py-3.5 text-base shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "..." : (ar() ? "تأكيد واستكمال الدفع ✓" : "Confirm & Complete Checkout ✓")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustCashbackModal({ isOpen, onClose, maxCashbackKwd, onAdjust }: {
  isOpen: boolean; onClose: () => void; maxCashbackKwd: string; onAdjust: (amountKwd: string, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <h3 className="font-bold text-surface-900">{ar() ? "تعديل رصيد الكاشباك" : "Adjust Cashback"}</h3>
          <button onClick={onClose} className="p-1.5 text-surface-400 hover:text-surface-700 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs text-surface-500 bg-surface-50 p-3 rounded-lg border border-surface-100">
            {ar() ? "استخدم أرقام سالبة (مثل -5) لخصم الرصيد، أو موجبة لإضافته. الرصيد الحالي: " : "Use negative values (e.g. -5) to deduct. Current balance: "} 
            <span className="font-bold text-emerald-600">{maxCashbackKwd} KWD</span>
          </div>
          <div>
            <label className="text-xs font-bold text-surface-700 block mb-1">{ar() ? "المبلغ (KWD)" : "Amount (KWD)"}</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="input-field" placeholder="e.g. 5.000 or -5.000" dir="ltr" />
          </div>
          <div>
            <label className="text-xs font-bold text-surface-700 block mb-1">{ar() ? "سبب التعديل" : "Reason for Adjustment"}</label>
            <input type="text" value={reason} onChange={e=>setReason(e.target.value)} className="input-field" placeholder={ar() ? "مثال: تعويض، خطأ، الخ" : "e.g. Compensation, Error, etc."} />
          </div>
          <button disabled={loading || !amount || !reason} onClick={async () => {
            setLoading(true);
            try { await onAdjust(amount, reason); onClose(); } catch(e:any) { alert(e.message); } finally { setLoading(false); }
          }} className="btn-primary w-full mt-2">
            {loading ? "..." : (ar() ? "تأكيد التعديل" : "Confirm Adjustment")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanTabs({ tabs, kyc, memberships, payments, clinicSessions, clinicBookings, markingId, onMarkSession, onMarkPaid, maxCashbackKwd, clinicProducts }: {
  tabs: { key: string; label: string }[];
  kyc: any;
  memberships: any[];
  payments: any[];
  clinicSessions: any[];
  clinicBookings: any[];
  markingId: string | null;
  onMarkSession: (id: string, status: string, posData?: any) => Promise<void>;
  onMarkPaid: (id: string, posData?: any) => Promise<void>;
  maxCashbackKwd: string;
  clinicProducts?: {name: string; nameAr?: string; nameEn?: string; priceKwd: string; cashbackDeductionKwd?: string}[];
}) {
  const [activeTab, setActiveTab] = useState("sessions");
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<any | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-20 pt-2 pb-2 bg-surface-50/95 backdrop-blur-xl transition-all">
        <div className="flex gap-1.5 bg-surface-200/60 p-1.5 rounded-[16px] shadow-inner border border-surface-200/30 overflow-x-auto hide-scrollbar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`shrink-0 px-4 py-2 rounded-[12px] text-xs font-bold whitespace-nowrap transition-all ${activeTab === t.key ? "bg-white text-brand-pink-700 shadow-sm" : "text-surface-500 hover:text-surface-800 hover:bg-surface-100/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Info Tab ── */}
      {activeTab === "info" && (
        <div className="card-elevated p-6 bg-white/80 backdrop-blur-xl border border-surface-200 rounded-[28px] space-y-6">
          <h4 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {ar() ? "المعلومات الشخصية" : "Personal Information"}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {memberships.length > 0 && (
              <div className="sm:col-span-2 bg-gradient-to-r from-surface-50 to-white rounded-2xl p-5 border border-surface-200 shadow-sm">
                <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-3">{ar() ? "ملخص العضويات" : "Membership Summary"}</div>
                <div className="flex gap-3 flex-wrap">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{memberships.filter(m => m.status === "active").length} {ar() ? "فعالة" : "Active"}</span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{memberships.filter(m => m.status === "pending_payment").length} {ar() ? "معلقة" : "Pending"}</span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-surface-100 text-surface-700 border border-surface-200/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-surface-500"></span>{memberships.length} {ar() ? "إجمالي" : "Total"}</span>
                </div>
              </div>
            )}
            <div className="bg-surface-50/50 rounded-2xl p-5 border border-surface-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-0.5">{ar() ? "إجمالي الجلسات بالعيادة" : "Clinic Sessions"}</div>
                  <div className="text-xl font-black text-surface-900">{clinicSessions.length}</div>
                </div>
              </div>
            </div>
            <div className="bg-surface-50/50 rounded-2xl p-5 border border-surface-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-0.5">{ar() ? "إجمالي المدفوعات" : "Total Payments"}</div>
                  <div className="text-xl font-black text-surface-900">{payments.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Memberships Tab ── */}
      {activeTab === "memberships" && (
        <div className="card-elevated p-5 space-y-3">
          <h4 className="font-bold text-surface-900">{ar() ? "جميع العضويات" : "All Memberships"}</h4>
          {memberships.length === 0 ? (
            <div className="text-center py-8 text-sm text-surface-400">{ar() ? "لا توجد عضويات" : "No memberships"}</div>
          ) : memberships.map((m: any) => (
            <div key={m.id} className="p-4 bg-surface-50 rounded-xl border border-surface-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-surface-900">{m.offerName}</div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status] ?? "bg-surface-100 text-surface-600"}`}>{m.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><span className="text-surface-500">{ar() ? "طريقة الدفع:" : "Mode:"}</span> <span className="font-bold text-surface-800">{m.purchaseMode}</span></div>
                <div><span className="text-surface-500">{ar() ? "المبلغ:" : "Amount:"}</span> <span className="font-bold text-surface-800">{m.paymentAmountKwd} KWD</span></div>
                <div><span className="text-surface-500">{ar() ? "الجلسات:" : "Sessions:"}</span> <span className="font-bold text-surface-800">{m.sessionsUsed}{m.maxSessions != null ? `/${m.maxSessions}` : ""}</span></div>
                {m.purchaseMode === "installments" && (
                  <div><span className="text-surface-500">{ar() ? "الأقساط:" : "Installments:"}</span> <span className="font-bold text-surface-800">{m.installmentsPaid}/{m.installmentCount}</span></div>
                )}
              </div>
              <div className="text-[10px] text-surface-400 flex gap-3 flex-wrap">
                {m.activatedAt && <span>{ar() ? "مفعلة:" : "Activated:"} {m.activatedAt}</span>}
                {m.expiresAt && <span>{ar() ? "تنتهي:" : "Expires:"} {m.expiresAt}</span>}
                {m.createdAt && <span>{ar() ? "أنشئت:" : "Created:"} {m.createdAt}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* Clinic Bookings - Mark Paid */}
          {clinicBookings.filter((b: any) => b.clinicPaymentStatus !== "paid").length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-200/60 rounded-[28px] p-5 sm:p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-full -z-10" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[14px] bg-orange-100 flex items-center justify-center text-orange-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-orange-900">{ar() ? "بانتظار الدفع" : "Awaiting Payment"}</h4>
                  <p className="text-xs text-orange-700/80 mt-0.5">{ar() ? "يجب تحصيل هذا المبلغ من العميل" : "Please collect this amount from the customer"}</p>
                </div>
              </div>
              <div className="space-y-3">
                {clinicBookings.filter((b: any) => b.clinicPaymentStatus !== "paid").map((b: any) => (
                  <div key={b.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/60 backdrop-blur-md rounded-[20px] border border-orange-100 gap-4">
                    <div>
                      <div className="text-lg font-black text-orange-900 mb-1">{b.clinicTakeKwd || b.sessionPriceKwd || "0.000"} KWD</div>
                      <div className="text-[10px] font-bold text-orange-700/60 uppercase tracking-wider">{ar() ? "الخدمة / الموعد" : "Service / Date"}</div>
                      <div className="text-xs font-semibold text-orange-800 mt-1">
                        {b.standaloneName || b.offerName || "Session"}
                        <span className="mx-2 text-orange-300">•</span>
                        {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "—"}
                      </div>
                    </div>
                    <button
                      className="w-full sm:w-auto btn-primary bg-orange-500 hover:bg-orange-600 border-none shadow-orange-500/20 py-2.5 px-6 rounded-xl font-bold shadow-glow"
                      onClick={() => setCheckoutBooking(b)}
                      disabled={payingBookingId === b.id}
                    >
                      {payingBookingId === b.id ? "…" : ar() ? "POS تحصيل" : "POS Checkout"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-elevated p-5 sm:p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-surface-200">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-surface-900">{ar() ? "سجل الجلسات" : "Session History"}</h4>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface-100 text-surface-600">{clinicSessions.length} {ar() ? "جلسة" : "sessions"}</span>
            </div>
            {clinicSessions.length === 0 ? (
              <div className="text-center py-10 text-sm text-surface-400 bg-surface-50/50 rounded-2xl border border-dashed border-surface-200">{ar() ? "لا توجد جلسات" : "No sessions at your clinic"}</div>
            ) : (
              <div className="space-y-3">
                {clinicSessions.map((s: any) => (
                  <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface-50/80 rounded-[20px] border border-surface-100/80 gap-4 transition-all hover:border-surface-300">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start gap-3 mb-2 sm:mb-0">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${SESSION_STATUS_COLORS[s.status] ?? "bg-surface-100 text-surface-500 border-surface-200"}`}>{s.status?.replace("_", " ")}</span>
                        <div className="text-sm font-bold text-surface-900 sm:hidden">
                          {new Date(s.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-surface-900 hidden sm:block mt-2">
                        {fmtDate(s.scheduledAt)}
                        <span className="text-surface-300 mx-2">•</span>
                        {new Date(s.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-surface-500 sm:hidden mt-1">
                        {fmtDate(s.scheduledAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      {s.status === "scheduled" && (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button disabled={markingId === s.id} onClick={() => onMarkSession(s.id, "completed")} className="flex-1 sm:flex-none text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 shadow-sm transition-colors">{markingId === s.id ? "…" : "✓ " + (ar() ? "حضر" : "Came")}</button>
                          <button disabled={markingId === s.id} onClick={() => onMarkSession(s.id, "no_show")} className="flex-1 sm:flex-none text-xs font-bold px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 disabled:opacity-50 transition-colors">{markingId === s.id ? "…" : "✗ " + (ar() ? "لم يحضر" : "No Show")}</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payments Tab ── */}
      {activeTab === "payments" && (
        <div className="card-elevated p-5 space-y-3">
          <h4 className="font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payment History"}</h4>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-sm text-surface-400">{ar() ? "لا توجد مدفوعات" : "No payments"}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-200">
              <table className="w-full text-sm min-w-[500px]">
                <thead><tr className="bg-surface-50 text-xs text-surface-500 uppercase tracking-wider">
                  <th className="py-2 px-3 text-left">{ar() ? "التاريخ" : "Date"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "المبلغ" : "Amount"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "الطريقة" : "Method"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "الغرض" : "Purpose"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "الحالة" : "Status"}</th>
                </tr></thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-t border-surface-100">
                      <td className="py-2 px-3 text-surface-600">{p.createdAt ? fmtDate(p.createdAt) : "—"}</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">{p.amountKwd} KWD</td>
                      <td className="py-2 px-3 text-surface-600">{p.method}</td>
                      <td className="py-2 px-3 text-surface-600">{p.purpose}{p.installmentNumber ? ` #${p.installmentNumber}` : ""}</td>
                      <td className="py-2 px-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── KYC Tab ── */}
      {activeTab === "kyc" && (
        <div className="card-elevated p-5 space-y-4">
          <h4 className="font-bold text-surface-900">{ar() ? "بيانات الهوية" : "KYC / Civil ID"}</h4>
          {!kyc ? (
            <div className="text-center py-8 text-sm text-surface-400">{ar() ? "لم يتم تقديم طلب التحقق" : "No KYC submission"}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                  <div className="text-xs text-surface-500">{ar() ? "الحالة" : "Status"}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${kyc.status === "approved" ? "bg-emerald-50 text-emerald-700" : kyc.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{kyc.status}</span>
                </div>
                <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                  <div className="text-xs text-surface-500">{ar() ? "رقم الهوية" : "Civil ID (masked)"}</div>
                  <div className="font-black text-surface-900 tracking-widest font-mono mt-0.5">{kyc.civilIdNumberMasked}</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: ar() ? "الهوية (أمامية)" : "Civil ID — Front", ref: kyc.civilIdFrontRef },
                  { label: ar() ? "الهوية (خلفية)" : "Civil ID — Back", ref: kyc.civilIdBackRef },
                  { label: ar() ? "التوقيع" : "Signature", ref: kyc.signatureRef },
                ].filter(d => d.ref).map(doc => (
                  <div key={doc.label} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-surface-100 text-xs font-bold text-surface-600">{doc.label}</div>
                    <div className="p-2">
                      <a href={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} target="_blank" rel="noreferrer" className="block w-full">
                        <img src={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} alt={doc.label} className="w-full h-32 object-contain rounded-lg bg-surface-50 hover:opacity-90 transition-opacity" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <POSCheckoutModal 
        isOpen={!!checkoutSession} 
        onClose={() => setCheckoutSession(null)} 
        baseAmountKwd={"0.000"} 
        walletBalanceKwd={maxCashbackKwd}
        baseCashbackKwd={"0"} // The base session's cashback (if any) was already handled, only allow cashback on extra items
        clinicProducts={clinicProducts}
        onSubmit={async (extraItems, cashbackToDeductKwd) => {
          if (checkoutSession) {
            await onMarkSession(checkoutSession.id, "completed", { extraItems, cashbackToDeductKwd });
          }
        }} 
      />
      <POSCheckoutModal 
        isOpen={!!checkoutBooking} 
        isBooking={true}
        onClose={() => setCheckoutBooking(null)} 
        baseItemName={checkoutBooking?.offerName ? `${checkoutBooking.offerName} Session Booking` : "Session Booking Base"}
        baseAmountKwd={checkoutBooking?.clinicTakeKwd || checkoutBooking?.sessionPriceKwd || "0"} 
        walletBalanceKwd={maxCashbackKwd}
        baseCashbackKwd={checkoutBooking?.maxSessionCashbackKwd || "0"}
        clinicProducts={clinicProducts}
        onSubmit={async (extraItems, cashbackToDeductKwd) => {
          if (checkoutBooking) {
            await onMarkPaid(checkoutBooking.id, { extraItems, cashbackToDeductKwd });
          }
        }} 
      />
    </div>
  );
}


function ClinicScannerTab({ onMarkSession }: { onMarkSession: (sessionId: string, status: string, posData?: any) => Promise<void> }) {
  const { getAuthHeader } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isStopped = false;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("qr-reader", { 
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minDim * 0.75);
          return { width: size, height: size };
        }, aspectRatio: 1.0 },
        (decodedText) => {
          if (isStopped) return;
          
          let extracted = decodedText.trim();
          const match = extracted.match(/\/verify\/([a-f0-9]+)/i);
          if (match) extracted = match[1];
          if (extracted.length < 10) return; // Ignore false positives and keep scanning

          isStopped = true;
          setToken(decodedText);
          setShowScanner(false);
          try {
            html5QrCode?.stop().catch(() => {}).finally(() => html5QrCode?.clear());
          } catch (e) {}
          handleScan(decodedText);
        },
        () => {}
      ).catch((err) => {
        console.error(err);
        setError(ar() ? "تعذر تشغيل الكاميرا. تحقق من الصلاحيات." : "Could not start camera. Check permissions.");
      });

      return () => {
        isStopped = true;
        try {
          html5QrCode?.stop().catch(() => {}).finally(() => html5QrCode?.clear());
        } catch (e) {}
      };
    }
  }, [showScanner]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [showAdjustCb, setShowAdjustCb] = useState(false);

  const handleScan = async (scanToken?: string) => {
    const rawInput = scanToken ?? token;
    if (!rawInput.trim()) return;
    
    // Extract token from URL if full URL was pasted
    let extracted = rawInput.trim();
    const match = extracted.match(/\/verify\/([a-f0-9]+)/i);
    if (match) extracted = match[1];
    
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch(`/public/clinic/scan/${extracted}`, {
        headers: getAuthHeader(),
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || (ar() ? "لم يتم العثور على العميل" : "Customer not found"));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSession = async (sessionId: string, status: string, posData?: any) => {
    setMarkingId(sessionId);
    try {
      await onMarkSession(sessionId, status, posData);
      // Refresh the scan
      await handleScan();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setMarkingId(null);
    }
  };

  const card = result?.card;
  const clinicSessions = result?.clinicSessions ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "ماسح بطاقة العضوية" : "Membership Card Scanner"}</h2>
        <p className="text-sm text-surface-500 mt-1">{ar() ? "امسح رمز QR من بطاقة العميل أو أدخل الرمز يدوياً لعرض بياناته." : "Scan the QR code from the customer's card or enter the token manually."}</p>
      </div>

      {/* Scanner input */}
      <div className="card-elevated p-6 bg-gradient-to-br from-surface-50 to-white">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-5 h-5 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleScan(); }}
              placeholder={ar() ? "أدخل رمز البطاقة أو الصق رابط QR..." : "Enter card token or paste QR link..."}
              className="input-field text-sm py-3 pl-11 pr-4 w-full bg-white"
              dir="ltr"
            />
          </div>
          <button
            onClick={() => setShowScanner(!showScanner)}
            className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 shrink-0 border transition-colors ${showScanner ? 'bg-red-50 text-red-600 border-red-200' : 'bg-surface-50 hover:bg-surface-100 text-surface-700 border-surface-200'}`}
            title={ar() ? "مسح عبر الكاميرا" : "Scan via Camera"}
          >
            {showScanner ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )}
          </button>
          <button
            onClick={() => handleScan()}
            disabled={loading || !token.trim()}
            className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            {ar() ? "بحث" : "Search"}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            {error}
          </div>
        )}

        {showScanner && (
          <div className="mt-4 rounded-xl overflow-hidden border border-surface-200 bg-black">
            <div id="qr-reader" className="w-full"></div>
          </div>
        )}
      </div>

      {/* Results */}
      {card && (() => {
        const scanKyc = result?.kyc;
        const scanMemberships = result?.memberships ?? [];
        const scanPayments = result?.payments ?? [];
        const scanBookings = result?.clinicBookings ?? [];
        const SCAN_TABS = [
          { key: "info", label: ar() ? "المعلومات" : "Info" },
          { key: "memberships", label: ar() ? "العضويات" : "Memberships" },
          { key: "sessions", label: ar() ? "الجلسات" : "Sessions" },
          { key: "payments", label: ar() ? "المدفوعات" : "Payments" },
          { key: "kyc", label: ar() ? "الهوية" : "KYC / ID" },
        ];
        return (
        <div className="space-y-5 animate-fade-in">
          {/* Customer Profile Card */}
          <div className="bg-white/80 backdrop-blur-xl border border-surface-200/60 shadow-lg shadow-surface-200/20 rounded-[32px] overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-pink-500/5 rounded-bl-full -z-10" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-tr-full -z-10" />
            
            <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-brand-pink-500 rounded-[20px] rotate-3 opacity-20"></div>
                  <div className="h-20 w-20 rounded-[20px] bg-gradient-to-br from-brand-pink-50 to-white flex items-center justify-center text-3xl font-black text-brand-pink-600 shadow-sm border border-brand-pink-100/50 relative z-10">
                    {(card.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-surface-900 tracking-tight">{card.displayName}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2">
                    {card.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-surface-600 font-mono" dir="ltr">
                        <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {card.phone}
                      </div>
                    )}
                    {card.email && (
                      <div className="flex items-center gap-1.5 text-sm text-surface-600">
                        <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {card.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {card.kycVerified && (
                      <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        {ar() ? "هوية موثقة" : "ID Verified"}
                      </span>
                    )}
                    {card.memberSince && (
                      <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-2.5 py-1 rounded-lg bg-surface-100/80">
                        {ar() ? "عضو منذ" : "Since"} {card.memberSince}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="bg-surface-50/50 border-t border-surface-200/50 p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 relative z-10">
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-pink-500 hidden sm:block"></div>
                  {ar() ? "عضويات فعالة" : "Active Offers"}
                </div>
                <div className="text-2xl font-black text-surface-900">{scanMemberships.filter((m: any) => m.status === "active").length}</div>
              </div>
              <div className="flex flex-col justify-center relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-8 bg-surface-200/50 hidden sm:block"></div>
                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1 flex items-center gap-1.5 sm:pl-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 hidden sm:block"></div>
                  {ar() ? "جلسات مجدولة" : "Scheduled"}
                </div>
                <div className="text-2xl font-black text-surface-900 sm:pl-6">{card.activeSessionCount ?? 0}</div>
              </div>
              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 border-surface-200/50 pt-4 sm:pt-0 flex flex-col justify-center relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-8 bg-surface-200/50 hidden sm:block"></div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1.5 sm:pl-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 hidden sm:block"></div>
                  {ar() ? "كاشباك متاح" : "Cashback"}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 sm:pl-6 flex-wrap">
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 truncate">{card.cashbackUnlockedKwd ?? "0.000"}</div>
                  <button onClick={() => setShowAdjustCb(true)} className="btn-ghost btn-sm text-[10px] bg-white border border-surface-200 rounded-lg shadow-sm shrink-0">
                    {ar() ? "تعديل" : "Adjust"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <ScanTabs maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} clinicProducts={result?.clinicProducts ?? []} tabs={SCAN_TABS} kyc={scanKyc} memberships={scanMemberships} payments={scanPayments} clinicSessions={clinicSessions} clinicBookings={scanBookings} markingId={markingId} onMarkSession={handleMarkSession} onMarkPaid={async (id: string, posData?: any) => {
            try {
              await apiFetch(`/scheduling/requests/${id}/mark-paid`, { 
                method: "POST", 
                headers: getAuthHeader(),
                body: JSON.stringify(posData || {})
              });
              await handleScan();
            } catch (e: any) { alert(e.message); }
          }} />
          <AdjustCashbackModal isOpen={showAdjustCb} onClose={() => setShowAdjustCb(false)} maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} onAdjust={async (amountKwd, reason) => {
            await apiFetch("/public/clinic/wallet/adjust", {
              method: "POST", headers: getAuthHeader(), body: JSON.stringify({ userId: result?.card?.userId, amountKwd, reason })
            });
            await handleScan();
          }} />
        </div>
        );
      })()}

      {/* Empty State */}
      {!card && !loading && !error && (
        <div className="card-elevated p-16 text-center border-dashed border-2 border-surface-200 bg-surface-50/50">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-5">
            <svg className="w-12 h-12 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "جاهز للمسح" : "Ready to Scan"}</h3>
          <p className="text-sm text-surface-500 max-w-sm mx-auto">{ar() ? "أدخل رمز البطاقة أو امسح رمز QR من بطاقة العميل لعرض بياناته وجلساته." : "Enter the card token or scan the QR code from the customer's membership card to view their profile and sessions."}</p>
        </div>
      )}
    </div>
  );
}

export default function ClinicDashboard() {
  const { t } = useTranslation();
  const { auth, getAuthHeader } = useAuth();
  const [activeNav, setActiveNav] = useState("home");
  const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "all">("today");
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicSaveMsg, setClinicSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [chatConvId, setChatConvId] = useState<string | undefined>(undefined);
  const [complaintForm, setComplaintForm] = useState({ category: "other", subject: "", description: "" });
  const [sysAlert, setSysAlert] = useState<string | null>(null);
  
  // Clinic staff accounts are linked to a clinicId from backend auth.
  // Fall back to the old demo clinic ids only if missing.
  const CLINIC_ID = auth?.clinicId || auth?.userId || "clinic_fallback";
  const [clinicData, setClinicData] = useState<{nameEn: string, nameAr: string}>({ nameEn: "Loading...", nameAr: "جاري التحميل..." });

  useEffect(() => {
     apiFetch(`/clinics/${CLINIC_ID}`).then((res: any) => {
        if (res.clinic) {
           setClinicData({ nameEn: res.clinic.nameEn, nameAr: res.clinic.nameAr });
           setSettingsForm({
             nameEn: res.clinic.nameEn || "",
             nameAr: res.clinic.nameAr || "",
             address: res.clinic.address || "Kuwait City",
             contactName: res.clinic.contactName || "Admin",
             contactPhone: res.clinic.contactPhone || res.clinic.phone || "+965 —",
             contactEmail: res.clinic.contactEmail || `contact@clinic.com`
           });
        }
     }).catch(() => {
        setClinicData({ nameEn: "Clinic Dashboard", nameAr: "لوحة العيادة" });
     });
  }, [CLINIC_ID]);

  const [settingsForm, setSettingsForm] = useState({
    nameEn: clinicData.nameEn,
    nameAr: clinicData.nameAr,
    address: "Kuwait City",
    contactName: "Admin",
    contactPhone: "+965 90000000",
    contactEmail: `contact@clinic.com`
  });
  const { data, loading, refetch } = useClinicSchedule(CLINIC_ID);

  useEffect(() => {
    const t = window.setInterval(() => {
      void refetch();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [refetch]);

  const sessions = data?.items || [];
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completed = sessions.filter(s => s.status === "completed");
  const noShows = sessions.filter(s => s.status === "no_show");

  const markSession = async (sessionId: string, status: string) => {
    try {
      await apiFetch(`/scheduling/clinic/sessions/${sessionId}/mark`, {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ status, notes: `Marked as ${status}` }),
      });
      invalidateCache("/scheduling/clinic/");
      void refetch(true);
    } catch (e: any) { alert(e.message); }
  };

  const saveClinicSettings = async () => {
    setClinicSaving(true);
    setClinicSaveMsg(null);
    try {
      const res: any = await apiFetch("/clinics/me", {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({
          nameEn: settingsForm.nameEn,
          nameAr: settingsForm.nameAr,
          address: settingsForm.address,
          contactName: settingsForm.contactName,
          contactPhone: settingsForm.contactPhone,
          contactEmail: settingsForm.contactEmail,
        }),
      });
      if (res.clinic) {
        setClinicData({ nameEn: res.clinic.nameEn, nameAr: res.clinic.nameAr });
      }
      setIsEditingSettings(false);
      setClinicSaveMsg({ type: "ok", text: ar() ? "تم الحفظ بنجاح!" : "Saved successfully!" });
      setTimeout(() => setClinicSaveMsg(null), 4000);
    } catch (e: any) {
      setClinicSaveMsg({ type: "err", text: e.message || (ar() ? "فشل الحفظ" : "Save failed") });
    } finally {
      setClinicSaving(false);
    }
  };

  const markPaidFromSchedule = async (bookingRequestId: string) => {
    try {
      await apiFetch(`/scheduling/requests/${bookingRequestId}/mark-paid`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      refetch();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "scanner", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>, label: ar() ? "ماسح البطاقة" : "Scan Card" },
    { key: "chat", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>, label: ar() ? "محادثات الحجوزات" : "Booking Chat" },
    { key: "schedule", icon: Icons.calendar, label: t("schedule") },
    { key: "invoices", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, label: ar() ? "الفواتير" : "Invoices" },
    { key: "reports", icon: Icons.report, label: ar() ? "التقارير" : "Reports" },
    { key: "performance", icon: Icons.chart, label: ar() ? "الأداء" : "Performance" },
    { key: "complaints", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>, label: ar() ? "الشكاوى والدعم" : "Complaints & Support" },
    { key: "profile", icon: Icons.profile, label: ar() ? "الملف الشخصي" : "Profile & Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة العيادة" : "Clinic Dashboard"} subtitle={ar() ? `${clinicData.nameAr} — جدول اليوم` : `${clinicData.nameEn} — Today's Schedule`} banner={<NoticeBanner />}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 mb-8">
              <KpiCard icon={Icons.calendar} label={ar() ? "إجمالي المواعيد" : "Total Sessions"} value={sessions.length} isHighlighted accent="pink" />
              <KpiCard icon={Icons.calendar} label={ar() ? "مجدولة" : "Scheduled"} value={scheduled.length} accent="blue" />
              <KpiCard icon={Icons.calendar} label={ar() ? "مكتملة" : "Completed"} value={completed.length} accent="emerald" />
              <KpiCard icon={Icons.calendar} label={ar() ? "لم يحضر" : "No Show"} value={noShows.length} accent="red" />
            </div>
            {/* Sessions Grid */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-surface-900 flex items-center gap-3">
                  {ar() ? "المواعيد" : "Appointments"}
                </h3>
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
                  <div className="flex bg-surface-100/50 p-1 rounded-xl">
                    <button onClick={() => setDateFilter("today")} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${dateFilter === "today" ? "bg-white text-brand-pink-600 shadow-sm" : "text-surface-500 hover:text-surface-900"}`}>{ar() ? "اليوم" : "Today"}</button>
                    <button onClick={() => setDateFilter("tomorrow")} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${dateFilter === "tomorrow" ? "bg-white text-brand-pink-600 shadow-sm" : "text-surface-500 hover:text-surface-900"}`}>{ar() ? "غداً" : "Tomorrow"}</button>
                    <button onClick={() => setDateFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${dateFilter === "all" ? "bg-white text-brand-pink-600 shadow-sm" : "text-surface-500 hover:text-surface-900"}`}>{ar() ? "الكل" : "All Upcoming"}</button>
                  </div>
                  <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-xl shrink-0" onClick={() => { invalidateCache("/scheduling/clinic/"); void refetch(true); }}>↻ {ar() ? "تحديث" : "Refresh"}</button>
                </div>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">{[1,2,3,4].map(i => <div key={i} className="shimmer h-64 rounded-3xl" />)}</div>
              ) : sessions.length === 0 ? (
                <div className="card-elevated p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-surface-200 bg-surface-50/50 min-h-[300px]">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm mb-4">📅</div>
                  <h3 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "الجدول فارغ" : "Your schedule is clear"}</h3>
                  <div className="text-sm text-surface-500">{ar() ? "لا توجد مواعيد مجدولة لهذه العيادة حالياً." : "No appointments scheduled for this clinic at the moment."}</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {sessions
                    .filter(s => {
                      if (dateFilter === "all") return true;
                      const d = new Date(s.scheduledAt);
                      const today = new Date();
                      if (dateFilter === "today") return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                      if (dateFilter === "tomorrow") {
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        return d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
                      }
                      return true;
                    })
                    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
                    .map(s => (
                    <SessionCard key={s.id} session={s} onMark={markSession} onMarkPaid={markPaidFromSchedule} />
                  ))}
                  {sessions.filter(s => {
                      if (dateFilter === "all") return true;
                      const d = new Date(s.scheduledAt);
                      const today = new Date();
                      if (dateFilter === "today") return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                      if (dateFilter === "tomorrow") {
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        return d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
                      }
                      return true;
                    }).length === 0 && (
                      <div className="col-span-full py-12 text-center text-surface-500 bg-surface-50/50 rounded-3xl border border-dashed border-surface-200">
                        {ar() ? "لا توجد مواعيد مطابقة للفلتر" : "No appointments match the selected filter"}
                      </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeNav === "schedule" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "جدول العيادة" : "Clinic Schedule"}</h3>
              <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg" onClick={() => { invalidateCache("/scheduling/clinic/"); void refetch(true); }}>
                ↻ {ar() ? "تحديث" : "Refresh"}
              </button>
            </div>
            <ScheduleTable sessions={sessions} onMark={markSession} onMarkPaid={markPaidFromSchedule} />
          </div>
        )}

        {activeNav === "chat" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "محادثات الحجوزات" : "Booking Conversations"}</h2>
              <p className="text-sm text-surface-500 mt-1">
                {ar() ? "اقترح أوقاتاً وأكد الحجوزات مع العملاء وخدمة العملاء." : "Propose times and confirm bookings with customers and CR."}
              </p>
            </div>
            {chatConvId && (
              <div className="text-xs text-surface-500">
                {ar() ? `تم فتح محادثة الطلب: ${chatConvId.slice(0, 8)}` : `Opened from request conversation: ${chatConvId.slice(0, 8)}`}
              </div>
            )}
            <ChatWidget key={chatConvId ?? "default"} conversationId={chatConvId} showBookingActions clinicMode={true} />
          </div>
        )}
        {activeNav === "performance" && (
          <ClinicPerformanceTab clinicId={CLINIC_ID} sessions={sessions} completed={completed} noShows={noShows} scheduled={scheduled} />
        )}

        {activeNav === "invoices" && (
          <ClinicInvoicesTab clinicId={CLINIC_ID} />
        )}

        {activeNav === "scanner" && (
          <ClinicScannerTab onMarkSession={markSession} />
        )}

        {activeNav === "reports" && (
          <ClinicReportsTab clinicId={CLINIC_ID} />
        )}

        {activeNav === "complaints" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              </div>
              <div>
                <h2 className="text-base font-black text-surface-900">{ar() ? "الشكاوى والدعم" : "Complaints & Support"}</h2>
                <p className="text-xs text-surface-400">{ar() ? "قدم شكوى أو تواصل مع الدعم الفني" : "Submit a complaint or contact support"}</p>
              </div>
            </div>

            <div className="space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!complaintForm.subject || !complaintForm.description) return;
                  try {
                    await apiFetch("/complaints/me", {
                      method: "POST",
                      headers: getAuthHeader(),
                      body: JSON.stringify(complaintForm)
                    });
                    setComplaintForm({ category: "other", subject: "", description: "" });
                    setSysAlert(ar() ? "تم إرسال الشكوى بنجاح وسيتم مراجعتها قريباً" : "Complaint submitted successfully and will be reviewed soon");
                    setTimeout(() => setSysAlert(null), 5000);
                  } catch (err: any) {
                    setSysAlert(err.message || (ar() ? "حدث خطأ أثناء إرسال الشكوى" : "Error submitting complaint"));
                    setTimeout(() => setSysAlert(null), 5000);
                  }
                }}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-surface-200 shadow-sm"
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-surface-900 mb-1 block">{ar() ? "الفئة" : "Category"}</label>
                    <select
                      className="select-field w-full bg-surface-50 border-surface-200"
                      value={complaintForm.category}
                      onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
                    >
                      <option value="system">{ar() ? "مشكلة في النظام" : "System Issue"}</option>
                      <option value="billing">{ar() ? "مشكلة مالية" : "Billing Issue"}</option>
                      <option value="other">{ar() ? "أخرى" : "Other"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-surface-900 mb-1 block">{ar() ? "الموضوع" : "Subject"}</label>
                    <input
                      required
                      minLength={3}
                      type="text"
                      className="input-field w-full bg-surface-50 border-surface-200"
                      value={complaintForm.subject}
                      onChange={(e) => setComplaintForm({ ...complaintForm, subject: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-surface-900 mb-1 block">{ar() ? "التفاصيل" : "Description"}</label>
                    <textarea
                      required
                      minLength={10}
                      className="input-field w-full h-24 resize-none bg-surface-50 border-surface-200"
                      value={complaintForm.description}
                      onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full sm:w-auto mt-2">
                    {ar() ? "إرسال الشكوى" : "Submit Complaint"}
                  </button>
                </div>
              </form>

              {sysAlert && (
                <div className="max-w-md bg-surface-900 text-white text-sm font-medium px-4 py-3 rounded-2xl animate-fade-in">
                  {sysAlert}
                </div>
              )}
            </div>
          </div>
        )}

        {activeNav === "profile" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "الملف الشخصي والإعدادات" : "Profile & Settings"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "إدارة بيانات العيادة ورابط الإحالة." : "Manage clinic details and your referral link."}</p>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <h3 className="text-lg font-bold text-surface-900">{ar() ? "إعدادات العيادة" : "Clinic Settings"}</h3>
                <div className="flex items-center gap-2">
                  {clinicSaveMsg && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${clinicSaveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {clinicSaveMsg.text}
                    </span>
                  )}
                  {!isEditingSettings ? (
                    <button onClick={() => { setIsEditingSettings(true); setClinicSaveMsg(null); }} className="btn-secondary btn-sm bg-white shadow-sm border border-surface-200">{ar() ? "تعديل البيانات" : "Edit Details"}</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => { setIsEditingSettings(false); setClinicSaveMsg(null); }} className="btn-secondary btn-sm">{ar() ? "إلغاء" : "Cancel"}</button>
                      <button onClick={saveClinicSettings} disabled={clinicSaving} className="btn-primary btn-sm">
                        {clinicSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التعديلات" : "Save Changes")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="card-elevated p-6 bg-gradient-to-br from-surface-50 to-white">
                  <h4 className="font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    {ar() ? "البيانات الأساسية" : "Basic Details"}
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Clinic Name (English)</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.nameEn} onChange={e => setSettingsForm({...settingsForm, nameEn: e.target.value})} /> : <div className="text-lg font-bold text-surface-900 p-2 bg-surface-100 rounded-lg">{settingsForm.nameEn}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">اسم العيادة (عربي)</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.nameAr} onChange={e => setSettingsForm({...settingsForm, nameAr: e.target.value})} /> : <div className="text-lg font-bold text-surface-900 p-2 bg-surface-100 rounded-lg">{settingsForm.nameAr}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "الموقع / العنوان" : "Location / Address"}</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.address} onChange={e => setSettingsForm({...settingsForm, address: e.target.value})} /> : <div className="text-base font-medium text-surface-700 p-2 bg-surface-100 rounded-lg flex items-center gap-2"><svg className="w-4 h-4 text-brand-pink-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{settingsForm.address}</div>}
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6 bg-gradient-to-br from-surface-50 to-white">
                  <h4 className="font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {ar() ? "بيانات التواصل" : "Contact Details"}
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "اسم المسؤول" : "Contact Person"}</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.contactName} onChange={e => setSettingsForm({...settingsForm, contactName: e.target.value})} /> : <div className="text-base font-bold text-surface-900 p-2 bg-surface-100 rounded-lg">{settingsForm.contactName}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.contactPhone} onChange={e => setSettingsForm({...settingsForm, contactPhone: e.target.value})} dir="ltr" /> : <div className="text-base font-medium text-surface-900 p-2 bg-surface-100 rounded-lg font-mono" dir="ltr">{settingsForm.contactPhone}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
                      {isEditingSettings ? <input type="email" className="input-field bg-white" value={settingsForm.contactEmail} onChange={e => setSettingsForm({...settingsForm, contactEmail: e.target.value})} dir="ltr" /> : <div className="text-base font-medium text-surface-900 p-2 bg-surface-100 rounded-lg font-mono" dir="ltr">{settingsForm.contactEmail}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-100">
                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                  {Icons.share}
                  {ar() ? "رابط الإحالة" : "Referral & Share Link"}
                </h3>
              </div>
              <div className="p-6">
                <ShareLinkPage hideHeader />
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
