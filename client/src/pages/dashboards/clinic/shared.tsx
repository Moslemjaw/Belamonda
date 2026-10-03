// Helpers, constants and small components shared by the ClinicDashboard tabs.
import { useState } from "react";
import { Icons } from "../../../components/DashboardShell";
import i18n from "../../../app/i18n";
import { ReferralActivityWidget } from "../../../components/ReferralActivityWidget";
import { KpiCard } from "../../../components/KpiCard";
import DatePicker from "../../../components/DatePicker";

export const ar = () => i18n.language === "ar";

export const SESSION_STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-indigo-50 text-indigo-700",
  no_show:   "bg-red-50 text-red-700",
  cancelled: "bg-surface-100 text-surface-600",
  request_received: "bg-amber-50 text-amber-700",
  slot_assigned: "bg-brand-pink-50 text-brand-pink-700",
  checked_in: "bg-teal-50 text-teal-700",
  in_progress: "bg-purple-50 text-purple-700",
  rescheduled: "bg-orange-50 text-orange-700",
  // Legacy statuses
  awaiting_session_payment: "bg-amber-50 text-amber-700",
  under_review: "bg-amber-50 text-amber-700",
  slot_proposed: "bg-blue-50 text-blue-700",
  slot_accepted: "bg-indigo-50 text-indigo-700",
  confirmed: "bg-indigo-50 text-indigo-700",
  rejected: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
};

export function RescheduleModal({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (scheduledAt: string) => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!date) return;
    setSubmitting(true);
    try {
      const dt = new Date(`${date}T${time}:00`);
      onSubmit(dt.toISOString());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black text-surface-900">{ar() ? "إعادة جدولة الموعد" : "Reschedule Appointment"}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-surface-600 mb-1">{ar() ? "التاريخ" : "Date"}</label>
            <DatePicker value={date} onChange={e => setDate(e.target.value)} className="w-full border border-surface-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-pink-400 focus:border-brand-pink-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-surface-600 mb-1">{ar() ? "الوقت" : "Time"}</label>
            <DatePicker showTimeSelectOnly value={time} onChange={e => setTime(e.target.value)} className="w-full border border-surface-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-pink-400 focus:border-brand-pink-400 outline-none" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-surface-600 bg-surface-100 hover:bg-surface-200 transition-colors">
            {ar() ? "إلغاء" : "Cancel"}
          </button>
          <button onClick={handleSubmit} disabled={!date || submitting} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 shadow-md">
            {submitting ? "..." : (ar() ? "تأكيد" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClinicPerformanceTab({ sessions, completed, noShows, scheduled }: {
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
// QR CARD SCANNER TAB
// ===========================================================================
export const SESSION_STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  slot_accepted: "bg-blue-50 text-blue-700 border-blue-200",
  no_show: "bg-red-50 text-red-600 border-red-200",
  cancelled: "bg-surface-100 text-surface-500 border-surface-200",
};

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  pending_payment: "bg-amber-50 text-amber-700",
  reserved: "bg-blue-50 text-blue-700",
  expired: "bg-surface-100 text-surface-500",
  cancelled: "bg-red-50 text-red-600",
};

export function AdjustCashbackModal({ isOpen, onClose, maxCashbackKwd, onAdjust }: {
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
