import { useState } from "react";
import { fmtDateTime } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { createPortal } from "react-dom";
import { useAuth } from "../../../app/AuthContext";
import { useBookingRequests, invalidateCache } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function BookingRequestsQueue({ onTransfer }: { onTransfer?: (id: string, clinicId: string) => void }) {
  const { getAuthHeader } = useAuth();
  const { data, refetch } = useBookingRequests("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState<{ scheduledAt: string; notes: string }>({ scheduledAt: "", notes: "" });

  const schedule = async (requestId: string, forceOverride: boolean = false) => {
    setProcessing(requestId);
    try {
      const iso = scheduleForm.scheduledAt ? new Date(scheduleForm.scheduledAt).toISOString() : undefined;
      await apiFetch(`/scheduling/cs/requests/${encodeURIComponent(requestId)}/propose`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          scheduledAt: iso,
          notes: scheduleForm.notes || undefined,
          forceOverride: forceOverride || undefined
        })
      });
      setScheduleForm({ scheduledAt: "", notes: "" });
      invalidateCache("/scheduling/cs/requests");
      await refetch(true);
      setSelectedBooking(null);
    } catch (e: any) {
      if (e.message === "INTERVAL_WARNING" || e.data?.code === "INTERVAL_WARNING" || e.data?.error === "INTERVAL_WARNING") {
        const warnMsg = (ar() ? e.data?.messageAr : e.data?.message) || e.data?.messageAr || e.data?.message || (ar() ? "الموعد يبعد أقل من 25 يوماً عن آخر جلسة للعميلة." : "The selected date is less than 25 days from the last completed session.");
        const promptMsg = ar()
          ? `⚠️ تنبيه فترة التباعد:\n\n${warnMsg}\n\nهل تريد تأكيد الموعد وتجاوز التحذير؟`
          : `⚠️ Interval Warning:\n\n${warnMsg}\n\nDo you want to proceed and override this warning?`;
        if (window.confirm(promptMsg)) {
          return schedule(requestId, true);
        }
        return;
      }

      const code = e.message || "UNKNOWN_ERROR";
      const friendly: Record<string, string> = {
        OFFER_NOT_ACTIVE: "The customer's membership is not active yet.",
        MEMBERSHIP_EXPIRED: "The customer's membership has expired.",
        SCHEDULED_AFTER_EXPIRY: "That date is after the membership's end date — pick an earlier date.",
        MAX_SESSIONS_REACHED: "All sessions for this membership have been used.",
        INSTALLMENT_NOT_PAID_FOR_NEXT_SESSION: "The next installment hasn't been paid yet.",
        SLOT_TAKEN: "That time slot is already taken at this clinic.",
        VALIDATION_ERROR: "Invalid date/time format.",
        USER_OFFER_NOT_FOUND: "Membership record not found.",
        OFFER_NOT_FOUND: "Offer configuration not found.",
      };
      alert(friendly[code] ?? `Scheduling failed: ${code}`);
    } finally {
      setProcessing(null);
    }
  };

  const cancelRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await apiFetch(`/scheduling/requests/${encodeURIComponent(requestId)}/reject`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ reason: "Cancelled by customer service" })
      });
      if (selectedBooking?.id === requestId) setSelectedBooking(null);
      invalidateCache("/scheduling/cs/requests");
      await refetch(true);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="card-elevated p-3 sm:p-5 relative flex flex-col h-[400px] overflow-hidden">
      <div className="editorial-header justify-between shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <span className="accent" />
          <div>
            <h3>{ar() ? "طلبات الحجز" : "Booking Requests"}</h3>
            <div className="meta">{ar() ? "إدارة وتأكيد مواعيد العملاء" : "Manage and confirm customer appointments"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {(data?.items || []).length > 0 && <span className="status-pill-pending"><span className="dot" aria-hidden="true" />{(data?.items || []).length} {ar() ? "معلق" : "pending"}</span>}
        </div>
      </div>
      <div className="overflow-y-auto flex-1 pr-2">
      {(data?.items || []).length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا توجد طلبات حجز معلقة" : "No pending booking requests"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "كل المواعيد تم تأكيدها" : "All appointments have been confirmed"}</div>
        </div>
      ) : (data?.items || []).map((b: any) => (
        <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 border-b border-surface-100 last:border-0">
          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
            <div className="avatar avatar-sm bg-blue-100 text-blue-700 shrink-0">{(b.customerName || b.userId)?.charAt(0)?.toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start sm:items-center gap-2">
                <div className="text-sm font-medium text-surface-800 truncate">{b.customerName || b.userId}</div>
                <div className="text-[11px] text-surface-400 sm:hidden whitespace-nowrap">{new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div className="text-xs text-surface-400 truncate">{b.offerName || (b.isStandalone ? b.standaloneName : null) || b.userOfferId?.slice(0, 25)}</div>
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">
                  {ar() ? (b.clinicNameAr || b.clinicId) : (b.clinicNameEn || b.clinicId)}
                </span>
                {b.membershipType && b.membershipType !== "none" && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                    {b.membershipType === "cashback" ? "💰 Cashback" : b.membershipType === "free_sessions" ? "🎫 Free" : b.membershipType}
                  </span>
                )}
                {parseFloat(b.cashbackDeductedKwd || "0") > 0 && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                    CB: {b.cashbackDeductedKwd} KWD
                  </span>
                )}
                {parseFloat(b.clinicTakeKwd || "0") === 0 ? (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-100 text-surface-500">
                    {ar() ? "لا يوجد دفع" : "No Payment Required"}
                  </span>
                ) : (
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${b.clinicPaymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {b.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع بالعيادة" : "Clinic Paid") : (ar() ? "دفع العيادة معلّق" : "Clinic Payment Pending")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 mt-1 sm:mt-0 w-full sm:w-auto">
            <div className="text-[11px] text-surface-400 hidden sm:block mr-2 whitespace-nowrap">{new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-0 justify-end w-full sm:w-auto">
              {onTransfer && (
                <button className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 border border-brand-pink-200 hover:bg-brand-pink-100 px-4 py-1.5 rounded-full transition-all" onClick={() => onTransfer(b.id, b.clinicId || "")}>
                  {ar() ? "تغيير العيادة" : "Change Clinic"}
                </button>
              )}
              <button className="text-xs font-bold text-surface-700 bg-surface-100 hover:bg-surface-200 px-4 py-1.5 rounded-full transition-all" onClick={() => setSelectedBooking(b)}>
                {ar() ? "التفاصيل" : "Details"}
              </button>
            </div>
          </div>
        </div>
      ))}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative max-h-[90vh] overflow-y-auto">
             <button className="absolute top-5 right-5 text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedBooking(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
             <h3 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {ar() ? "تفاصيل الحجز" : "Booking Details"}
             </h3>

             <div className="space-y-4">
               {/* Customer Info */}
               <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                  <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "بيانات العميل" : "Customer Information"}</h4>
                  <div className="flex items-center gap-3">
                     <div className="avatar avatar-sm bg-blue-100 text-blue-700">{(selectedBooking.customerName || selectedBooking.userId)?.charAt(0)?.toUpperCase()}</div>
                     <div>
                        <div className="font-bold text-surface-900">{selectedBooking.customerName || selectedBooking.userId}</div>
                        {selectedBooking.customerPhone && <div className="text-xs text-surface-500">{selectedBooking.customerPhone}</div>}
                        <div className="text-xs text-surface-400">{fmtDateTime(selectedBooking.createdAt)}</div>
                     </div>
                  </div>
               </div>

               {/* Request Details */}
               <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                 <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "تفاصيل الطلب" : "Request Details"}</h4>
                  <div className="space-y-2">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "الباقة" : "Offer"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.offerName || (selectedBooking.isStandalone ? "none" : selectedBooking.userOfferId)}</span>
                     </div>
                     {!selectedBooking.isStandalone && (
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-surface-500">{ar() ? "نوع الجلسة" : "Session Type"}</span>
                          <span className="font-bold text-surface-900">{selectedBooking.notes || (ar() ? "غير محدد" : "—")}</span>
                       </div>
                     )}
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "العيادة المطلوبة" : "Requested Clinic"}</span>
                        <span className="font-bold text-brand-pink-600">{ar() ? (selectedBooking.clinicNameAr || selectedBooking.clinicId) : (selectedBooking.clinicNameEn || selectedBooking.clinicId)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "موعد مفضل" : "Preferred time"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.preferredAt ? fmtDateTime(selectedBooking.preferredAt) : (ar() ? "غير محدد" : "—")}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "العضوية/النوع" : "Membership Type"}</span>
                        <span className="font-bold text-surface-900">
                          {selectedBooking.membershipType === "cashback" ? "💰 Cashback" : selectedBooking.membershipType === "free_sessions" ? "🎫 Free Sessions" : selectedBooking.membershipType || "none"}
                        </span>
                     </div>
                  </div>
               </div>

               {/* Membership Details */}
               {!selectedBooking.isStandalone && selectedBooking.userOffer && (
                 <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100">
                    <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3">{ar() ? "تفاصيل العضوية" : "Membership Details"}</h4>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center text-sm">
                          <span className="text-purple-700">{ar() ? "الاستخدام" : "Usage"}</span>
                          <span className="font-bold text-purple-900">
                             {selectedBooking.userOffer.sessionsUsed || 0} 
                             {selectedBooking.userOffer.maxSessions ? ` / ${selectedBooking.userOffer.maxSessions}` : " / ∞"}
                             {ar() ? " جلسات" : " sessions"}
                          </span>
                       </div>
                       {selectedBooking.userOffer.purchaseMode === 'installments' && (() => {
                         const uo = selectedBooking.userOffer;
                         const unpaidInstallments = (uo.installmentSchedule || []).filter((s: any) => !s.paid);
                         const unpaidAmount = unpaidInstallments.reduce((sum: number, s: any) => sum + Number(s.amountKwd || 0), 0);
                         return (
                           <div className="flex justify-between items-center text-sm border-t border-purple-200 pt-2 mt-1">
                              <span className="text-purple-700">{ar() ? "الأقساط غير المدفوعة" : "Unpaid Installments"}</span>
                              <span className="font-bold text-red-600">{unpaidInstallments.length} ({unpaidAmount.toFixed(3)} KWD)</span>
                           </div>
                         );
                       })()}
                    </div>
                 </div>
               )}

               {/* Financial Breakdown */}
               <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">{ar() ? "التفاصيل المالية" : "Financial Breakdown"}</h4>
                  <div className="space-y-2">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-emerald-700">{ar() ? "سعر الجلسة" : "Session Price"}</span>
                        <span className="font-bold text-emerald-900">{selectedBooking.sessionGrossKwd || selectedBooking.sessionPriceKwd || "0.000"} KWD</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-emerald-700">{ar() ? "كاش باك مستخدم" : "Cashback Deducted"}</span>
                        <span className="font-bold text-amber-600">-{selectedBooking.cashbackDeductedKwd || "0.000"} KWD</span>
                     </div>
                     <div className="flex justify-between items-center text-sm border-t border-emerald-200 pt-2 mt-1">
                        <span className="text-emerald-700 font-bold">{ar() ? "المبلغ على العميل" : "Amount Due at Clinic"}</span>
                        <span className="font-black text-emerald-900">{selectedBooking.clinicTakeKwd || "0.000"} KWD</span>
                     </div>
                     <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-surface-500">{ar() ? "الدفع من العيادة" : "Clinic Payment Status"}</span>
                        <span className={`font-bold ${selectedBooking.clinicPaymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                          {selectedBooking.clinicPaymentStatus === "paid" ? (ar() ? "✓ مدفوع" : "✓ Paid") : (ar() ? "⏳ معلّق" : "⏳ Pending")}
                        </span>
                     </div>
                  </div>
               </div>

               {/* Scheduling Form */}
               <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">{ar() ? "جدولة الموعد" : "Schedule Appointment"}</h4>
                  <div className="space-y-3">
                     <div>
                       <label className="block text-[11px] font-bold text-blue-800 mb-1">{ar() ? "وقت وتاريخ الموعد" : "Date & Time"}</label>
                       <DatePicker 
                         showTimeSelect
                         className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                         value={scheduleForm.scheduledAt}
                         onChange={e => setScheduleForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
                       />
                     </div>
                     <div>
                       <label className="block text-[11px] font-bold text-blue-800 mb-1">{ar() ? "ملاحظات إضافية (اختياري)" : "Notes (Optional)"}</label>
                       <input 
                         type="text" 
                         placeholder={ar() ? "أدخل أي ملاحظات للعيادة..." : "Enter notes for clinic..."}
                         className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                         value={scheduleForm.notes}
                         onChange={e => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                       />
                     </div>
                  </div>
               </div>

             </div>

             <div className="mt-6 flex flex-col gap-2">
                <button 
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  disabled={processing === selectedBooking.id}
                  onClick={() => schedule(selectedBooking.id)}
                >
                  {processing === selectedBooking.id ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {scheduleForm.scheduledAt ? (ar() ? "اقتراح الموعد وإرسال للعيادة" : "Suggest Date & Send to Clinic") : (ar() ? "إرسال للعيادة بدون موعد" : "Send to Clinic Without Date")}
                    </>
                  )}
                </button>
                <div className="flex gap-2">
                  <button 
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl transition-colors border border-red-200"
                    disabled={processing === selectedBooking.id}
                    onClick={() => {
                      if (window.confirm(ar() ? "هل أنت متأكد من إلغاء هذا الحجز؟" : "Are you sure you want to cancel this booking?")) {
                        cancelRequest(selectedBooking.id);
                      }
                    }}
                  >
                    {ar() ? "إلغاء الطلب" : "Reject Request"}
                  </button>
                  <button 
                    className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-2.5 rounded-xl transition-colors"
                    disabled={processing === selectedBooking.id}
                    onClick={() => setSelectedBooking(null)}
                  >
                    {ar() ? "إغلاق" : "Close"}
                  </button>
                </div>
             </div>
           </div>
        </div>, document.body
      )}
    </div>
  );
}
