import { ar } from "./shared";

export function ScheduleTable({
  sessions,
  onMark,
  onMarkPaid,
  onSelectUser,
  onReschedule,
}: {
  sessions: any[];
  onMark?: (id: string, status: string) => void;
  onMarkPaid: (bookingRequestId: string) => void;
  onSelectUser?: (userId: string) => void;
  onReschedule?: (id: string) => void;
}) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);

  // Only show scheduled appointments on clinic schedule (no requests, suggestions, or cancelled)
  const filteredSessions = sessions.filter((s) => s.status === "scheduled" || s.status === "slot_accepted" || s.status === "confirmed");

  const groups = {
    today: filteredSessions.filter((s) => {
      const t = new Date(s.scheduledAt);
      return t >= today && t < tomorrow;
    }),
    tomorrow: filteredSessions.filter((s) => {
      const t = new Date(s.scheduledAt);
      return t >= tomorrow && t < dayAfterTomorrow;
    }),
    upcoming: filteredSessions.filter((s) => new Date(s.scheduledAt) >= dayAfterTomorrow),
  };

  const formatTimeOnly = (iso: string) => {
    return new Date(iso).toLocaleTimeString(ar() ? "ar-KW" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kuwait",
    });
  };

  const formatDateOnly = (iso: string) => {
    return new Date(iso).toLocaleDateString(ar() ? "ar-KW" : "en-GB", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kuwait",
    });
  };

  const renderRows = (items: any[]) =>
    items.map((s) => {
      const isCompleted = s.status === "completed";
      const isNoShow = s.status === "no_show";
      const isInProgress = s.status === "in_progress";
      const isRescheduled = s.status === "rescheduled";
      const isCheckedIn = s.status === "checked_in";
      const isCancelled = s.status === "cancelled";
      const isReq = s.status === "request_received";
      const isSlot = s.status === "slot_assigned";

      const color = isCompleted ? "emerald" :
                    isNoShow ? "red" :
                    isInProgress ? "purple" :
                    isRescheduled ? "orange" :
                    isCheckedIn ? "teal" :
                    isReq ? "amber" :
                    isSlot ? "brand-pink" :
                    isCancelled ? "surface" :
                    "blue"; // scheduled

      return (
        <div key={s.id} className="relative bg-white rounded-2xl p-4 sm:p-5 border border-surface-200 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl bg-${color}-500 opacity-80 group-hover:opacity-100 transition-opacity`} />
          
          <div className="flex items-center gap-5 flex-1 pl-2">
            <div className="flex flex-col items-center justify-center shrink-0 w-20">
              <span className="text-lg font-black text-surface-900 tracking-tight">{formatTimeOnly(s.scheduledAt)}</span>
              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mt-0.5">{formatDateOnly(s.scheduledAt)}</span>
            </div>

            <div className="w-px h-10 bg-surface-200 hidden sm:block" />

            <div className="flex-1">
              <button 
                type="button" 
                className="text-base font-bold text-surface-900 group-hover:text-brand-pink-600 transition-colors text-left flex items-center gap-2"
                onClick={() => onSelectUser?.(s.userId)}
              >
                {s.customerName || "Customer Name"}
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                <span className="text-xs text-surface-500 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {s.offerName || "Session"}
                </span>
                {s.customerPhone && (
                  <>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-surface-300" />
                    <span className="text-xs text-surface-500 font-mono" dir="ltr">{s.customerPhone}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-2 sm:pl-0">
            <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-${color}-50 text-${color}-700 border border-${color}-100`}>
              {s.status.replace(/_/g, " ")}
            </span>
            
            {s.status === "scheduled" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReschedule?.(s.id); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-sm hover:shadow transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {ar() ? "إعادة جدولة" : "Reschedule"}
              </button>
            )}
            
            <span className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${
              s.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
              "bg-amber-50 text-amber-700 border border-amber-100"
            }`}>
              {s.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
            </span>
          </div>
        </div>
      );
    });

  const Section = ({ title, items }: { title: string; items: any[] }) => (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-4 pl-1">
        <h4 className="text-xl font-black text-surface-900">{title}</h4>
        <span className="px-2.5 py-1 rounded-lg bg-surface-100 text-surface-600 text-xs font-bold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="bg-surface-50/50 rounded-2xl border-2 border-dashed border-surface-200 p-8 text-center">
          <div className="text-surface-400 text-sm font-medium">{ar() ? "لا توجد حجوزات" : "No sessions scheduled"}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {renderRows(items)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-2 mt-6">
      <Section title={ar() ? "اليوم" : "Today"} items={groups.today} />
      <Section title={ar() ? "غداً" : "Tomorrow"} items={groups.tomorrow} />
      <Section title={ar() ? "قادمة" : "Upcoming"} items={groups.upcoming} />
    </div>
  );
}
