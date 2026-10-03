import { useAuth } from "../../../app/AuthContext";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

export function SessionCard({ session, onMarkPaid, onSelectUser, onReschedule }: { session: any; onMark?: (id: string, status: string) => void; onMarkPaid: (id: string) => void; onSelectUser?: (userId: string) => void; onReschedule?: (id: string) => void }) {
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
      <div className={`absolute top-0 left-0 w-1.5 h-full ${session.status === 'completed' && session.clinicPaymentStatus !== 'paid' ? 'bg-amber-500' : session.status === 'completed' ? 'bg-emerald-500' : session.status === 'no_show' ? 'bg-red-500' : session.status === 'cancelled' ? 'bg-surface-300' : 'bg-brand-pink-500'}`} />
      
      <div className="flex flex-col gap-4 mb-5 pl-2">
        <div className="flex items-center gap-3">
           <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-surface-100 to-surface-200 border border-white flex items-center justify-center text-brand-pink-600 font-bold text-xl shadow-sm shrink-0">
             {(session.customerName || session.userId || "?").charAt(0).toUpperCase()}
           </div>
           <div className="flex-1 min-w-0">
             <button type="button" onClick={() => onSelectUser?.(session.userId)} className="text-base font-black text-brand-pink-600 hover:text-brand-pink-700 hover:underline truncate text-left">{session.customerName || (ar() ? "عميل" : "Customer")}</button>
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
          <div className="space-y-2">
            <div className={`text-center py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border bg-blue-50 text-blue-600 border-blue-200`}>
              {session.status.replace("_", " ")}
            </div>
            <button
              onClick={() => onReschedule?.(session.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 hover:from-orange-100 hover:to-amber-100 hover:shadow-sm transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {ar() ? "إعادة جدولة" : "Reschedule"}
            </button>
          </div>
        )}
        {session.status !== "scheduled" && (
          <div className={`text-center py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border ${session.status === 'completed' && session.clinicPaymentStatus !== 'paid' ? 'bg-amber-50 text-amber-700 border-amber-200' : session.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : session.status === 'no_show' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-surface-100 text-surface-600 border-surface-200'}`}>
            {session.status === 'completed' && session.clinicPaymentStatus !== 'paid' ? (ar() ? "بانتظار الدفع" : "Awaiting Session Payment") : session.status === 'slot_accepted' ? (ar() ? "مجدول" : "Scheduled") : session.status.replace("_", " ")}
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
