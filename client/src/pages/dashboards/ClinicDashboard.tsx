import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useClinicSchedule } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { sharedClinics } from "../../lib/clinics";
import i18n from "../../app/i18n";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReferralActivityWidget } from "../../components/ReferralActivityWidget";

const ar = () => i18n.language === "ar";

function KpiCard({ label, value, icon, isHighlighted, iconBg = "bg-brand-pink-50", iconText = "text-brand-pink-600", iconBorder = "border-brand-pink-100" }: { label: string; value: string | number; icon: React.ReactNode; isHighlighted?: boolean; iconBg?: string; iconText?: string; iconBorder?: string; }) {
  return (
    <div className={`card-elevated p-6 flex flex-col justify-between relative overflow-hidden group ${isHighlighted ? 'bg-gradient-to-br from-brand-pink-500 to-brand-pink-700 text-white border-none shadow-brand-pink-500/30 shadow-lg' : 'bg-white'}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-10 transition-transform duration-500 group-hover:scale-110 ${isHighlighted ? 'bg-white/10' : iconBg.replace('bg-', 'bg-').concat('/50')}`} />
      <div className="flex justify-between items-start mb-6">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm backdrop-blur-md ${isHighlighted ? 'bg-white/20 text-white' : `${iconBg} ${iconText} border ${iconBorder}`}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isHighlighted ? 'text-brand-pink-100' : 'text-surface-500'}`}>{label}</div>
        <div className={`text-4xl font-black ${isHighlighted ? 'text-white' : 'text-surface-900'}`}>{value}</div>
      </div>
    </div>
  );
}

function SessionCard({ session, onMark, onRefresh }: { session: any; onMark: (id: string, status: string) => void; onRefresh: () => void }) {
  const { getAuthHeader } = useAuth();
  const [showReschedule, setShowReschedule] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const allGreen = session.eligibility?.offerActive && session.eligibility?.paymentConfirmed && session.eligibility?.intervalMet;
  const time = new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(session.scheduledAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const submitReschedule = async () => {
    if (!newTime) { alert(ar() ? "اختر وقتاً جديداً" : "Please select a new time"); return; }
    setRescheduling(true);
    try {
      await apiFetch(`/scheduling/clinic/sessions/${session.id}/reschedule`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt: new Date(newTime).toISOString() })
      });
      setShowReschedule(false);
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setRescheduling(false); }
  };

  return (
    <div className={`card-elevated p-5 relative overflow-hidden group transition-all hover:shadow-lg flex flex-col ${!allGreen && session.status === "scheduled" ? "border-red-200 bg-red-50/10" : "bg-white"}`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${session.status === 'completed' ? 'bg-emerald-500' : session.status === 'no_show' ? 'bg-red-500' : session.status === 'cancelled' ? 'bg-surface-300' : 'bg-brand-pink-500'}`} />
      
      <div className="flex justify-between items-start mb-5 pl-2">
        <div className="flex items-center gap-3">
           <div className="w-11 h-11 rounded-2xl bg-surface-100 flex items-center justify-center text-brand-pink-600 font-bold text-lg shadow-sm">
             {(session.customerName || session.userId || "?").charAt(0).toUpperCase()}
           </div>
           <div>
             <div className="text-sm font-bold text-surface-900">{session.customerName || (ar() ? "عميل" : "Customer")}</div>
             <div className="text-xs text-surface-500 font-medium mt-0.5">{session.offerName ? <><span className="text-brand-pink-500">{session.offerName}</span> · </> : null}{date}</div>
           </div>
        </div>
        <div className="text-right">
           <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 text-surface-900 text-sm font-bold shadow-sm">
             <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             {time}
           </span>
        </div>
      </div>

      <div className="space-y-2 mb-5 bg-surface-50 p-4 rounded-2xl border border-surface-100/50 pl-4 ml-2">
        {session.payment && (
          <div className="flex items-center justify-between text-xs pb-2 border-b border-surface-200">
            <span className="text-surface-600 font-medium">{ar() ? "سجل الدفع" : "Enrollment payment"}</span>
            <span className="font-bold text-surface-800">
              {session.payment.status} · {session.payment.amountKwd} KWD
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
           <span className="text-surface-600 font-medium">{ar() ? "العرض نشط" : "Offer Active"}</span>
           {session.eligibility?.offerActive ? <span className="text-emerald-600 font-bold flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Yes</span> : <span className="text-red-500 font-bold">No</span>}
        </div>
        <div className="flex items-center justify-between text-xs">
           <span className="text-surface-600 font-medium">{ar() ? "حالة الدفع" : "Payment"}</span>
           {session.eligibility?.paymentConfirmed ? <span className="text-emerald-600 font-bold flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> OK</span> : <span className="text-red-500 font-bold">Pending</span>}
        </div>
        <div className="flex items-center justify-between text-xs">
           <span className="text-surface-600 font-medium">{ar() ? "المدة المتاحة" : "Interval Met"}</span>
           {session.eligibility?.intervalMet ? <span className="text-emerald-600 font-bold flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Yes</span> : <span className="text-red-500 font-bold border-b border-dashed border-red-300 pb-0.5">Too early</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto pl-2 gap-2 flex-wrap">
        <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg ${session.status === "completed" ? "bg-emerald-100 text-emerald-700" : session.status === "no_show" ? "bg-red-100 text-red-700" : session.status === "cancelled" ? "bg-surface-200 text-surface-600" : "bg-blue-100 text-blue-700"}`}>
          {session.status.replace('_', ' ')}
        </span>
        {session.status === "scheduled" && (
          <div className="flex gap-2 flex-wrap">
            {allGreen && (
              <>
                <button className="flex items-center gap-1 bg-emerald-500 text-white hover:bg-emerald-600 transition-colors rounded-xl px-4 py-2 text-xs font-bold shadow-sm" onClick={() => onMark(session.id, "completed")}>
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   {ar() ? "مكتمل" : "Complete"}
                </button>
                <button className="flex items-center gap-1 bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors rounded-xl px-3 py-2 text-xs font-bold shadow-sm" onClick={() => onMark(session.id, "no_show")}>
                   {ar() ? "لم يحضر" : "No Show"}
                </button>
              </>
            )}
            <button className="flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100 transition-colors rounded-xl px-3 py-2 text-xs font-bold shadow-sm" onClick={() => onMark(session.id, "cancelled")}>
              {ar() ? "إلغاء الجلسة" : "Cancel Session"}
            </button>
            <button
              className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors rounded-xl px-3 py-2 text-xs font-bold shadow-sm"
              onClick={() => { setShowReschedule(!showReschedule); setNewTime(""); }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {ar() ? "إعادة جدولة" : "Reschedule"}
            </button>
          </div>
        )}
      </div>

      {showReschedule && session.status === "scheduled" && (
        <div className="mt-4 pt-4 border-t border-surface-100 space-y-3 pl-2">
          <label className="text-xs font-bold text-surface-700 block">{ar() ? "اختر الوقت الجديد" : "Select new appointment time"}</label>
          <input
            type="datetime-local"
            className="input-field bg-surface-50 text-sm w-full sm:w-72"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={rescheduling}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              onClick={() => void submitReschedule()}
            >{rescheduling ? "…" : ar() ? "تأكيد الجدولة" : "Confirm Reschedule"}</button>
            <button type="button" className="text-xs font-bold text-surface-500 hover:text-surface-700 px-3 py-2" onClick={() => setShowReschedule(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
          </div>
        </div>
      )}

      {session.cashbackUnlockedKwd && parseFloat(session.cashbackUnlockedKwd) > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-emerald-400 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
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
        <td className="py-2 text-sm font-semibold text-surface-800">{s.customerName || "Customer"}</td>
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
        <td className="py-2 text-right">
          <div className="flex flex-wrap gap-1 justify-end">
            {s.status === "scheduled" && (
              <>
                <button className="text-xs font-bold bg-emerald-500 text-white px-2 py-1 rounded" onClick={() => onMark(s.id, "completed")}>Came</button>
                <button className="text-xs font-bold bg-red-500 text-white px-2 py-1 rounded" onClick={() => onMark(s.id, "no_show")}>No Show</button>
              </>
            )}
            {s.bookingRequestId && s.clinicPaymentStatus !== "paid" && (
              <button className="text-xs font-bold bg-amber-500 text-white px-2 py-1 rounded" onClick={() => onMarkPaid(s.bookingRequestId)}>Paid</button>
            )}
          </div>
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
                <th className="py-2 text-right">Actions</th>
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

type BookingRequestRow = {
  id: string; status: string; userId: string; offerId: string; clinicId: string;
  preferredAt?: string; proposedAt?: string; rejectionReason?: string;
  conversationId?: string; notes?: string; createdAt: string;
  sessionPriceKwd?: string; membershipType?: string; cashbackDeductedKwd?: string;
  clinicPaymentStatus?: "pending" | "paid";
  customerName?: string | null; customerPhone?: string | null;
};

type CustomerContext = {
  paymentMode: string;
  paymentLabel: string;
  paymentStatus: string;
  installmentsPaid: number | null;
  installmentCount: number | null;
  sessionsUsed: number;
  maxSessions: number | null;
  cashbackUnlockedKwd: string;
  cashbackLockedKwd: string;
};

function CustomerContextBadge({ ctx }: { ctx: CustomerContext }) {
  const paymentColor =
    ctx.paymentMode === "installments"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : ctx.paymentMode === "deposit" && ctx.paymentStatus === "reserved"
      ? "bg-orange-100 text-orange-800 border-orange-200"
      : ctx.paymentMode === "deposit"
      ? "bg-purple-100 text-purple-800 border-purple-200"
      : "bg-emerald-100 text-emerald-800 border-emerald-200";

  return (
    <div className="mt-3 pt-3 border-t border-surface-100 grid grid-cols-3 gap-3">
      <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">{ar() ? "حالة الدفع" : "Payment"}</div>
        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${paymentColor}`}>
          {ctx.paymentLabel}
        </span>
      </div>
      <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">{ar() ? "الجلسات" : "Sessions"}</div>
        <div className="text-sm font-black text-surface-900">
          {ctx.sessionsUsed}
          {ctx.maxSessions != null && <span className="font-normal text-surface-400">/{ctx.maxSessions}</span>}
          {ctx.maxSessions == null && <span className="text-[10px] font-medium text-surface-400 ml-1">used</span>}
        </div>
      </div>
      <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
        <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">{ar() ? "الكاش باك" : "Cashback"}</div>
        <div className="text-sm font-black text-emerald-700">{ctx.cashbackUnlockedKwd} KWD</div>
        {parseFloat(ctx.cashbackLockedKwd) > 0 && (
          <div className="text-[10px] text-surface-400 mt-0.5">{ctx.cashbackLockedKwd} {ar() ? "محجوز" : "locked"}</div>
        )}
      </div>
    </div>
  );
}

function BookingRequestsPanel({ onOpenChat }: { onOpenChat: (convId: string) => void }) {
  const { getAuthHeader } = useAuth();
  const [requests, setRequests] = useState<BookingRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "reject" | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contextMap, setContextMap] = useState<Record<string, CustomerContext | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqData = await apiFetch("/scheduling/clinic/requests?status=open", { headers: getAuthHeader() }) as { items?: BookingRequestRow[] };
      setRequests(reqData.items ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [getAuthHeader]);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (contextMap[id] !== undefined) return;
    try {
      const data = await apiFetch(`/scheduling/clinic/requests/${id}/customer-context`, { headers: getAuthHeader() }) as { context: CustomerContext };
      setContextMap((prev) => ({ ...prev, [id]: data.context }));
    } catch {
      setContextMap((prev) => ({ ...prev, [id]: null }));
    }
  };

  const openAction = (id: string, type: "confirm" | "reject") => {
    setActionId(id); setActionType(type); setScheduledAt(""); setReason("");
  };
  const closeAction = () => { setActionId(null); setActionType(null); };

  const submitConfirm = async (id: string) => {
    if (!scheduledAt) { alert(ar() ? "اختر وقت الموعد" : "Please pick a scheduled time"); return; }
    setBusy(true);
    try {
      await apiFetch(`/scheduling/requests/${id}/confirm`, {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      closeAction(); void load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const submitReject = async (id: string) => {
    if (!reason.trim()) { alert(ar() ? "أدخل سبب الرفض" : "Please enter a rejection reason"); return; }
    setBusy(true);
    try {
      await apiFetch(`/scheduling/requests/${id}/reject`, {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ reason }),
      });
      closeAction(); void load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const statusChip = (status: string) => {
    const map: Record<string, { label: string; labelAr: string; cls: string }> = {
      awaiting_session_payment: { label: "Awaiting Payment", labelAr: "بانتظار الدفع", cls: "bg-orange-100 text-orange-800" },
      under_review:  { label: "Under Review",  labelAr: "قيد المراجعة", cls: "bg-amber-100 text-amber-800" },
      slot_proposed: { label: "Slot Proposed", labelAr: "وقت مقترح",    cls: "bg-blue-100 text-blue-800" },
      slot_accepted: { label: "Slot Accepted", labelAr: "وقت مقبول",    cls: "bg-purple-100 text-purple-800" },
      confirmed:     { label: "Confirmed",     labelAr: "مؤكد",          cls: "bg-emerald-100 text-emerald-800" },
      rejected:      { label: "Rejected",      labelAr: "مرفوض",         cls: "bg-red-100 text-red-800" },
    };
    const m = map[status] ?? { label: status, labelAr: status, cls: "bg-surface-100 text-surface-700" };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{ar() ? m.labelAr : m.label}</span>;
  };

  const markPaid = async (id: string) => {
    setPayingId(id);
    try {
      await apiFetch(`/scheduling/requests/${id}/mark-paid`, {
        method: "POST",
        headers: getAuthHeader()
      });
      void load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{ar() ? "طلبات الحجز" : "Booking Requests"}</h2>
          <p className="text-sm text-surface-500 mt-1">{ar() ? "راجع طلبات الحجز الواردة وأكدها أو ارفضها" : "Review incoming booking requests and confirm or decline them."}</p>
        </div>
        <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg" onClick={load}>
          ↻ {ar() ? "تحديث" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="shimmer h-24 rounded-2xl" />)}</div>
      ) : requests.length === 0 ? (
        <div className="card-elevated p-12 text-center border-dashed border-2 border-surface-200 bg-surface-50/50">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm mx-auto mb-3">📋</div>
          <h3 className="text-base font-bold text-surface-900">{ar() ? "لا توجد طلبات حالياً" : "No pending requests"}</h3>
          <p className="text-sm text-surface-500 mt-1">{ar() ? "ستظهر هنا طلبات الحجز الجديدة." : "New booking requests will appear here."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-surface-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="h-8 w-8 rounded-full bg-brand-pink-100 text-brand-pink-700 flex items-center justify-center text-xs font-black">
                      {(r.customerName || r.userId || "C").charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-surface-900 text-sm font-mono">{r.id.slice(0, 8)}</span>
                    {statusChip(r.status)}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-surface-500 bg-surface-50 border border-surface-100 rounded-xl p-3">
                    <div>{ar() ? "العميل:" : "Customer:"} <span className="font-semibold text-surface-700">{r.customerName ?? r.userId.slice(0, 12) + "…"}</span>{r.customerPhone && <span className="ml-2 text-surface-400 font-mono">{r.customerPhone}</span>}</div>
                    {r.offerId && <div>{ar() ? "الخدمة:" : "Offer:"} <span className="font-semibold text-surface-700">{(r as any).offerName ?? r.offerId.slice(0, 12)}</span></div>}
                    {r.preferredAt && <div>{ar() ? "الوقت المفضل:" : "Preferred:"} <span className="font-semibold text-surface-700">{new Date(r.preferredAt).toLocaleString()}</span></div>}
                    {r.proposedAt && <div>{ar() ? "الوقت المقترح:" : "Proposed:"} <span className="font-semibold text-blue-700">{new Date(r.proposedAt).toLocaleString()}</span></div>}
                    {r.notes && <div>{ar() ? "ملاحظات:" : "Notes:"} <span className="text-surface-700">{r.notes}</span></div>}
                    {(r.sessionPriceKwd || r.membershipType || r.cashbackDeductedKwd) && (
                      <div>
                        {ar() ? "البيانات المالية:" : "Financial:"}{" "}
                        <span className="font-semibold text-surface-700">
                          {r.sessionPriceKwd ? `${r.sessionPriceKwd} KWD` : "0.000 KWD"} · {r.membershipType || "none"} · cashback {r.cashbackDeductedKwd || "0.000"} KWD
                        </span>
                      </div>
                    )}
                    <div>
                      {ar() ? "الدفع في العيادة:" : "Clinic Payment:"}{" "}
                      <span className={`font-semibold ${r.clinicPaymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                        {r.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "قيد الانتظار" : "Pending")}
                      </span>
                    </div>
                    <div className="text-surface-400">{ar() ? "تاريخ الطلب:" : "Requested:"} {new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 flex-wrap items-start">
                  {/* Customer context button */}
                  <button
                    type="button"
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${expandedId === r.id ? "bg-indigo-600 text-white" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"}`}
                    onClick={() => void toggleExpand(r.id)}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    {ar() ? "معلومات العميل" : "Customer Info"}
                  </button>
                  {/* Open chat button — always shown if conversation exists */}
                  {r.conversationId && (
                    <button
                      type="button"
                      className="text-xs font-bold bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      onClick={() => onOpenChat(r.conversationId!)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      {ar() ? "المحادثة" : "Open Chat"}
                    </button>
                  )}
                  {/* Action buttons — only on actionable statuses */}
                  {["under_review", "slot_accepted"].includes(r.status) && (
                    <>
                      <button
                        type="button"
                        className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => openAction(r.id, "confirm")}
                      >{ar() ? "جدولة الموعد" : "Schedule"}</button>
                      <button
                        type="button"
                        className="text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg transition-colors"
                        onClick={() => openAction(r.id, "reject")}
                      >{ar() ? "رفض" : "Decline"}</button>
                    </>
                  )}
                  {r.clinicPaymentStatus !== "paid" && (
                    <button
                      type="button"
                      disabled={payingId === r.id}
                      className="text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors"
                      onClick={() => void markPaid(r.id)}
                    >
                      {payingId === r.id ? "…" : ar() ? "تم الدفع" : "Paid"}
                    </button>
                  )}
                </div>
              </div>

              {/* Customer context panel */}
              {expandedId === r.id && (
                contextMap[r.id] === undefined
                  ? <div className="mt-3 pt-3 border-t border-surface-100"><div className="shimmer h-16 rounded-xl" /></div>
                  : contextMap[r.id] === null
                  ? <div className="mt-3 pt-3 border-t border-surface-100 text-xs text-surface-400">{ar() ? "تعذر تحميل المعلومات" : "Could not load customer info"}</div>
                  : <CustomerContextBadge ctx={contextMap[r.id]!} />
              )}

              {/* Inline confirm form */}
              {actionId === r.id && actionType === "confirm" && (
                <div className="mt-4 pt-4 border-t border-surface-100 space-y-3">
                  <label className="text-xs font-bold text-surface-700 block">{ar() ? "اختر وقت الجلسة" : "Select session time"}</label>
                  <input
                    type="datetime-local"
                    className="input-field bg-surface-50 text-sm w-full sm:w-72"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      onClick={() => submitConfirm(r.id)}
                    >{busy ? "…" : ar() ? "تأكيد الجدولة" : "Confirm Schedule"}</button>
                    <button type="button" className="text-xs font-bold text-surface-500 hover:text-surface-700 px-3 py-2" onClick={closeAction}>{ar() ? "إلغاء" : "Cancel"}</button>
                  </div>
                </div>
              )}

              {/* Inline reject form */}
              {actionId === r.id && actionType === "reject" && (
                <div className="mt-4 pt-4 border-t border-surface-100 space-y-3">
                  <label className="text-xs font-bold text-surface-700 block">{ar() ? "سبب الرفض" : "Reason for declining"}</label>
                  <textarea
                    className="input-field bg-surface-50 text-sm w-full"
                    rows={2}
                    placeholder={ar() ? "مثال: الوقت غير متاح في هذه الفترة" : "e.g. No availability in that window"}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      onClick={() => submitReject(r.id)}
                    >{busy ? "…" : ar() ? "إرسال الرفض" : "Send Decline"}</button>
                    <button type="button" className="text-xs font-bold text-surface-500 hover:text-surface-700 px-3 py-2" onClick={closeAction}>{ar() ? "إلغاء" : "Cancel"}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClinicDashboard() {
  const { t } = useTranslation();
  const { auth, getAuthHeader } = useAuth();
  const [activeNav, setActiveNav] = useState("home");
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [chatConvId, setChatConvId] = useState<string | undefined>(undefined);
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
      refetch();
    } catch (e: any) { alert(e.message); }
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
    { key: "schedule", icon: Icons.calendar, label: t("schedule") },
    { key: "requests", icon: Icons.clipboard, label: ar() ? "طلبات الحجز" : "Booking Requests" },
    { key: "chat", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>, label: ar() ? "محادثات الحجوزات" : "Booking Chat" },
    { key: "performance", icon: Icons.chart, label: ar() ? "الأداء" : "Performance" },
    { key: "profile", icon: Icons.profile, label: ar() ? "الملف الشخصي" : "Profile & Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة العيادة" : "Clinic Dashboard"} subtitle={ar() ? `${clinicData.nameAr} — جدول اليوم` : `${clinicData.nameEn} — Today's Schedule`}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            {/* Stats */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <KpiCard icon={Icons.calendar} label={ar() ? "إجمالي المواعيد" : "Total Sessions"} value={sessions.length} isHighlighted />
              <KpiCard icon={Icons.calendar} label={ar() ? "مجدولة" : "Scheduled"} value={scheduled.length} iconBg="bg-blue-50" iconText="text-blue-600" iconBorder="border-blue-100" />
              <KpiCard icon={Icons.calendar} label={ar() ? "مكتملة" : "Completed"} value={completed.length} iconBg="bg-emerald-50" iconText="text-emerald-600" iconBorder="border-emerald-100" />
              <KpiCard icon={Icons.calendar} label={ar() ? "لم يحضر" : "No Show"} value={noShows.length} iconBg="bg-red-50" iconText="text-red-500" iconBorder="border-red-100" />
            </div>

            {/* Sessions Grid */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-surface-900">{ar() ? "المواعيد" : "Appointments"}</h3>
                <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg" onClick={refetch}>↻ {ar() ? "تحديث السجل" : "Refresh Log"}</button>
              </div>
              {loading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="shimmer h-64 rounded-3xl" />)}</div>
              ) : sessions.length === 0 ? (
                <div className="card-elevated p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-surface-200 bg-surface-50/50 min-h-[300px]">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm mb-4">📅</div>
                  <h3 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "الجدول فارغ" : "Your schedule is clear"}</h3>
                  <div className="text-sm text-surface-500">{ar() ? "لا توجد مواعيد مجدولة لهذه العيادة حالياً." : "No appointments scheduled for this clinic at the moment."}</div>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sessions.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).map(s => (
                    <SessionCard key={s.id} session={s} onMark={markSession} onRefresh={refetch} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeNav === "schedule" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "جدول العيادة" : "Clinic Schedule"}</h3>
              <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg" onClick={refetch}>
                ↻ {ar() ? "تحديث" : "Refresh"}
              </button>
            </div>
            <ScheduleTable sessions={sessions} onMark={markSession} onMarkPaid={markPaidFromSchedule} />
          </div>
        )}

        {activeNav === "requests" && (
          <BookingRequestsPanel
            onOpenChat={(convId) => { setChatConvId(convId); setActiveNav("chat"); }}
          />
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
            <ChatWidget showBookingActions />
          </div>
        )}
        {activeNav === "performance" && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold text-surface-900">{ar() ? "أداء العيادة" : "Clinic Performance"}</h3>
            <ReferralActivityWidget />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
               <KpiCard icon={Icons.calendar} label={ar() ? "جلسات مكتملة" : "Completed"} value={completed.length} iconBg="bg-emerald-50" iconText="text-emerald-600" iconBorder="border-emerald-100" />
               <KpiCard icon={Icons.calendar} label={ar() ? "نسبة عدم الحضور" : "No-Show Rate"} value={`${sessions.length > 0 ? ((noShows.length / sessions.length) * 100).toFixed(1) : "0"}%`} iconBg="bg-red-50" iconText="text-red-500" iconBorder="border-red-100" />
               <KpiCard icon={Icons.chart} label={ar() ? "معدل الإكمال" : "Completion Rate"} value={`${sessions.length > 0 ? ((completed.length / sessions.length) * 100).toFixed(1) : "0"}%`} iconBg="bg-blue-50" iconText="text-blue-600" iconBorder="border-blue-100" />
               <KpiCard icon={Icons.calendar} label={ar() ? "قادمة" : "Upcoming"} value={scheduled.length} />
            </div>
            
            <div className="card-elevated p-8 min-h-[300px] flex flex-col items-center justify-center border border-surface-200">
               <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center text-surface-400 mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               </div>
               <h3 className="text-lg font-bold text-surface-900">{ar() ? "الرسوم البيانية المتقدمة قريباً" : "Advanced Charts Coming Soon"}</h3>
               <p className="text-surface-500 mt-1 max-w-sm text-center">{ar() ? "سنقوم بتوفير تحليلات مفصلة للإيرادات والمواعيد قريباً." : "Detailed analytics for revenue and appointments will be available here soon."}</p>
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
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-surface-900">{ar() ? "إعدادات العيادة" : "Clinic Settings"}</h3>
                {!isEditingSettings ? (
                  <button onClick={() => setIsEditingSettings(true)} className="btn-secondary btn-sm bg-white shadow-sm border border-surface-200">{ar() ? "تعديل البيانات" : "Edit Details"}</button>
                ) : (
                  <button onClick={() => { setIsEditingSettings(false); alert(ar() ? "تم الحفظ بنجاح!" : "Saved successfully!"); }} className="btn-primary btn-sm">{ar() ? "حفظ التعديلات" : "Save Changes"}</button>
                )}
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
                <ShareLinkPage />
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
