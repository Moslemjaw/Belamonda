import { useState } from "react";
import { fmtDate, fmtDateTime } from "../../../lib/dateFormat";
import { createPortal } from "react-dom";
import { useAuth } from "../../../app/AuthContext";
import { usePendingPayments, invalidateCache } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function PaymentQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = usePendingPayments();
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [rejectingPayment, setRejectingPayment] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const confirmPayment = async (uo: any) => {
    setProcessing(uo.id);
    try {
      await apiFetch("/payments/cs/confirm", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          userOfferId: uo.id,
          proofRef: "verified_by_cs",
          method: "bank_transfer",
          amountKwd: uo.amount || uo.paymentAmountKwd || "99.000"
        })
      });
    } catch (e: any) {
      // If already confirmed/processed, just silently refresh
      if (!e.message?.includes("NOT_PENDING_PAYMENT")) alert(e.message);
    } finally {
      invalidateCache("/payments");
      refetch(true);
      setProcessing(null);
      setSelectedPayment(null);
    }
  };

  const rejectPayment = async (uo: any, reason: string) => {
    setProcessing(uo.id);
    try {
      await apiFetch("/payments/cs/reject", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          userOfferId: uo.id,
          reason
        })
      });
    } catch (e: any) {
      if (!e.message?.includes("NOT_PENDING_PAYMENT")) alert(e.message);
    } finally {
      invalidateCache("/payments");
      refetch(true);
      setProcessing(null);
      setRejectingPayment(null);
      setRejectReason("");
    }
  };

  const printReceipt = (p: any) => {
    const isAr = ar();
    const logoSvg = `<svg width="52" height="52" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="#F59AB9" opacity="0.9"/><path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="#F59AB9" opacity="0.6"/><path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="#F59AB9" opacity="0.6"/><path d="M12 35C12 35 12 45 20 52C26 57 34 55 40 55C30 55 15 52 12 35Z" fill="#F59AB9" opacity="0.35"/><path d="M68 35C68 35 68 45 60 52C54 57 46 55 40 55C50 55 65 52 68 35Z" fill="#F59AB9" opacity="0.35"/><path d="M10 58C10 58 18 52 28 56C28 56 18 60 10 58Z" fill="#C7CAAB" opacity="0.7"/><path d="M70 58C70 58 62 52 52 56C52 56 62 60 70 58Z" fill="#C7CAAB" opacity="0.7"/><circle cx="40" cy="35" r="8" fill="white" opacity="0.25"/></svg>`;

    const purchaseMode = p.purchaseMode || "full";
    const schedule: any[] = p.installmentSchedule || [];
    const installmentRows = purchaseMode === "installments" && schedule.length > 0
      ? schedule.map((inst: any) => `<tr style="border-bottom:1px solid #f5f5f5"><td style="padding:7px 8px;color:#666;font-size:12px">${isAr ? `القسط ${inst.number}` : `Installment ${inst.number}`}</td><td style="padding:7px 8px;text-align:right;font-weight:700;font-size:12px;color:${inst.paid ? "#059669" : "#1a1a1a"}">${inst.amountKwd} KWD${inst.paid ? (isAr ? " ✓ مدفوع" : " ✓ Paid") : inst.dueDate ? ` · ${fmtDate(inst.dueDate)}` : ""}</td></tr>`).join("")
      : "";

    const modeLabel = purchaseMode === "installments"
      ? (isAr ? "أقساط" : "Installments")
      : purchaseMode === "deposit"
        ? (isAr ? "عربون" : "Deposit")
        : (isAr ? "دفعة كاملة" : "Full Payment");

    const offerDisplay = (isAr && p.offerNameAr) ? p.offerNameAr : (p.offerName || p.offerId);
    const clinicDisplay = (isAr && p.clinicNameAr) ? p.clinicNameAr : (p.clinicNameEn || "");
    const customerName = p.userName || p.userId;
    const amountDue = p.amount || p.paymentAmountKwd || "—";

    const html = `<!DOCTYPE html><html dir="${isAr ? "rtl" : "ltr"}" lang="${isAr ? "ar" : "en"}"><head><meta charset="UTF-8"><title>Belamonda Receipt</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a1a;background:#fff;padding:32px}.receipt{max-width:460px;margin:0 auto;border:1px solid #e8e8e8;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)}.header{background:linear-gradient(135deg,#fdf2f8 0%,#fff 100%);padding:22px 24px;border-bottom:1px solid #f5e6f0;display:flex;align-items:center;gap:14px}.logo-text h1{font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-.5px}.logo-text p{font-size:10px;color:#bbb;text-transform:uppercase;letter-spacing:2px;margin-top:1px}.badge{margin-${isAr ? "right" : "left"}:auto;background:#fce7f3;color:#be185d;font-size:10px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.5px}.section{padding:14px 24px}.section+.section{border-top:1px solid #f5f5f5}.label{font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}.row{display:flex;justify-content:space-between;align-items:center;padding:4px 0}.row .k{font-size:13px;color:#666}.row .v{font-size:13px;font-weight:600;color:#1a1a1a}.amount-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0 4px}.amount-row .k{font-size:13px;color:#666}.amount-row .v{font-size:26px;font-weight:900;color:#db2777}.status{display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px}.ref{font-size:10px;color:#bbb;word-break:break-all}table{width:100%;border-collapse:collapse}.footer{padding:14px 24px;background:#fafafa;text-align:center;border-top:1px solid #f0f0f0}.footer p{font-size:11px;color:#bbb}@media print{body{padding:0}.receipt{border:none;border-radius:0;box-shadow:none}}</style></head><body><div class="receipt"><div class="header">${logoSvg}<div class="logo-text"><h1>Belamonda</h1><p>Beauty &amp; Wellness · Kuwait</p></div><div class="badge">${isAr ? "إيصال" : "Receipt"}</div></div><div class="section"><div class="label">${isAr ? "بيانات العميل" : "Customer"}</div><div class="row"><span class="k">${isAr ? "الاسم" : "Name"}</span><span class="v">${customerName}</span></div>${p.userPhone ? `<div class="row"><span class="k">${isAr ? "الهاتف" : "Phone"}</span><span class="v">${p.userPhone}</span></div>` : ""}${p.userEmail ? `<div class="row"><span class="k">${isAr ? "البريد الإلكتروني" : "Email"}</span><span class="v">${p.userEmail}</span></div>` : ""}</div><div class="section"><div class="label">${isAr ? "تفاصيل الباقة" : "Offer Details"}</div><div class="row"><span class="k">${isAr ? "الباقة" : "Package"}</span><span class="v">${offerDisplay}</span></div>${clinicDisplay ? `<div class="row"><span class="k">${isAr ? "العيادة" : "Clinic"}</span><span class="v">${clinicDisplay}</span></div>` : ""}<div class="row"><span class="k">${isAr ? "طريقة الدفع" : "Payment Mode"}</span><span class="v">${modeLabel}</span></div><div class="amount-row"><span class="k">${isAr ? "المبلغ المطلوب" : "Amount Due"}</span><span class="v">${amountDue} KWD</span></div></div>${installmentRows ? `<div class="section"><div class="label">${isAr ? "جدول الأقساط" : "Installment Schedule"}</div><table>${installmentRows}</table></div>` : ""}<div class="section"><div class="row"><span class="k">${isAr ? "الحالة" : "Status"}</span><span class="v"><span class="status">${isAr ? "في انتظار التأكيد" : "Awaiting Confirmation"}</span></span></div><div class="row" style="margin-top:6px"><span class="k">${isAr ? "التاريخ" : "Date"}</span><span class="v">${fmtDateTime(p.createdAt)}</span></div><div class="row" style="margin-top:6px"><span class="k">${isAr ? "رقم المرجع" : "Reference ID"}</span><span class="v ref">${p.id}</span></div></div><div class="footer"><p>${isAr ? "شكراً لاختيارك بيلاموندو" : "Thank you for choosing Belamonda"}</p><p style="margin-top:3px">www.belamonda.com</p></div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;

    const w = window.open("", "_blank", "width=580,height=720");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const items = data?.items || [];

  const modeLabel = (p: any) => {
    const mode = p.purchaseMode;
    if (mode === "installments") return ar() ? "أقساط" : "Installments";
    if (mode === "deposit") return ar() ? "عربون" : "Deposit";
    return ar() ? "كامل" : "Full";
  };

  const totalPending = items.reduce((sum: number, p: any) => sum + parseFloat(p.amount || p.paymentAmountKwd || "0"), 0);
  return (
    <div className="card-elevated p-3 sm:p-5 flex flex-col h-[400px] overflow-hidden">
      <div className="editorial-header justify-between shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <span className="accent" />
          <div>
            <h3>{ar() ? "مدفوعات بانتظار التأكيد" : "Pending Payments"}</h3>
            <div className="meta">{ar() ? `إجمالي ${totalPending.toFixed(3)} د.ك بانتظار التحقق` : `${totalPending.toFixed(3)} KWD awaiting verification`}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {items.length > 0 && <span className="status-pill-pending"><span className="dot" aria-hidden="true" />{items.length} {ar() ? "معلق" : "pending"}</span>}
        </div>
      </div>
      {loading ? <div className="shimmer h-32 rounded-2xl" /> : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا مدفوعات معلقة" : "No pending payments"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "كل المدفوعات تم تأكيدها" : "All payments have been confirmed"}</div>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto overflow-x-hidden flex-1 pr-2">
          {items.map((p: any) => {
            const modeColors = p.purchaseMode === "installments"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : p.purchaseMode === "deposit"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";
            return (
              <div key={p.id} className="queue-row group flex-wrap">
                <div className="avatar avatar-sm sm:avatar-md bg-amber-100 text-amber-700">{(p.userName || p.userId)?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2 mb-0.5">
                    <div className="text-xs sm:text-sm font-bold text-surface-900 truncate">{p.userName || p.userId}</div>
                    <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1 sm:px-1.5 py-0.5 rounded border shrink-0 ${modeColors}`}>{modeLabel(p)}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-surface-500 truncate">{ar() && p.offerNameAr ? p.offerNameAr : (p.offerName || p.offerId?.slice(0, 30))}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm sm:text-base font-black text-brand-pink-600 leading-none whitespace-nowrap">{p.amount || p.paymentAmountKwd}</div>
                  <div className="text-[9px] sm:text-[10px] text-surface-400 font-bold uppercase tracking-wider mt-0.5 sm:mt-1">KWD</div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button className="icon-btn" onClick={() => setSelectedPayment(p)} aria-label={ar() ? `عرض تفاصيل دفع ${p.userName || p.userId}` : `View payment details for ${p.userName || p.userId}`} title={ar() ? "التفاصيل" : "Details"}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                  <button className="btn-primary btn-sm px-2 sm:px-3.5" disabled={processing === p.id} onClick={() => confirmPayment(p)} aria-label={ar() ? `تأكيد دفع ${p.amount || p.paymentAmountKwd} د.ك من ${p.userName || p.userId}` : `Confirm payment of ${p.amount || p.paymentAmountKwd} KWD from ${p.userName || p.userId}`}>
                    {processing === p.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        <span className="hidden sm:inline">{ar() ? "تأكيد" : "Confirm"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-100 shrink-0">
              <h3 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {ar() ? "تفاصيل الدفع" : "Payment Details"}
              </h3>
              <button className="text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedPayment(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4">

              {/* Customer */}
              <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "بيانات العميل" : "Customer"}</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base shrink-0">
                    {(selectedPayment.userName || selectedPayment.userId)?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-surface-900">{selectedPayment.userName || selectedPayment.userId}</div>
                    <div className="text-xs text-surface-500 mt-0.5 space-x-2 rtl:space-x-reverse">
                      {selectedPayment.userPhone && <span>{selectedPayment.userPhone}</span>}
                      {selectedPayment.userPhone && selectedPayment.userEmail && <span>·</span>}
                      {selectedPayment.userEmail && <span>{selectedPayment.userEmail}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Offer */}
              <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "تفاصيل الباقة" : "Offer"}</h4>
                <div className="flex justify-between items-start gap-3 mb-2">
                  <span className="font-bold text-surface-900 text-sm leading-snug">
                    {ar() && selectedPayment.offerNameAr ? selectedPayment.offerNameAr : (selectedPayment.offerName || selectedPayment.offerId)}
                  </span>
                  <span className="font-black text-brand-pink-600 text-base whitespace-nowrap shrink-0">
                    {selectedPayment.amount || selectedPayment.paymentAmountKwd} KWD
                  </span>
                </div>
                {(selectedPayment.clinicNameEn || selectedPayment.clinicNameAr) && (
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-surface-500">{ar() ? "العيادة" : "Clinic"}</span>
                    <span className="font-semibold text-surface-800">{ar() && selectedPayment.clinicNameAr ? selectedPayment.clinicNameAr : selectedPayment.clinicNameEn}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-500">{ar() ? "نوع الدفع" : "Payment Mode"}</span>
                  <span className={`font-bold text-xs px-2.5 py-1 rounded-lg border ${selectedPayment.purchaseMode === "installments" ? "bg-blue-50 text-blue-700 border-blue-200" : selectedPayment.purchaseMode === "deposit" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                    {modeLabel(selectedPayment)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-surface-500">{ar() ? "تاريخ الطلب" : "Requested"}</span>
                  <span className="font-semibold text-surface-800">{fmtDateTime(selectedPayment.createdAt)}</span>
                </div>
              </div>

              {/* Installment schedule */}
              {selectedPayment.purchaseMode === "installments" && (selectedPayment.installmentSchedule || []).length > 0 && (() => {
                const schedule: any[] = selectedPayment.installmentSchedule;
                const paidCount = schedule.filter((s: any) => s.paid).length;
                const total = schedule.length;
                return (
                  <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">{ar() ? "جدول الأقساط" : "Installment Schedule"}</h4>
                    <div className="space-y-2 mb-3">
                      {schedule.map((inst: any) => (
                        <div key={inst.number} className="flex justify-between items-center text-sm">
                          <span className="text-blue-800">{ar() ? `القسط ${inst.number}` : `Installment ${inst.number}`}{inst.dueDate ? ` · ${fmtDate(inst.dueDate)}` : ""}</span>
                          <span className={`font-bold ${inst.paid ? "text-emerald-600" : "text-blue-900"}`}>
                            {inst.amountKwd} KWD {inst.paid ? "✓" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-0.5 mt-2">
                      {schedule.map((_: any, i: number) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < paidCount ? "bg-emerald-500" : "bg-blue-200"}`} />
                      ))}
                    </div>
                    <div className="text-xs text-blue-600 mt-1 font-medium">{paidCount} / {total} {ar() ? "مدفوعة" : "paid"}</div>
                  </div>
                );
              })()}

              {/* Deposit info */}
              {selectedPayment.purchaseMode === "deposit" && (
                <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100">
                  <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">{ar() ? "معلومات العربون" : "Deposit Info"}</h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-purple-800">{ar() ? "مبلغ العربون" : "Deposit Amount"}</span>
                    <span className="font-bold text-purple-900">{selectedPayment.depositAmountKwd || selectedPayment.amount} KWD</span>
                  </div>
                </div>
              )}

              {/* Cashback applied */}
              {selectedPayment.cashbackAppliedKwd && selectedPayment.cashbackAppliedKwd !== "0.000" && (
                <div className="flex justify-between items-center text-sm bg-emerald-50 rounded-xl px-4 py-2.5 border border-emerald-100">
                  <span className="text-emerald-700 font-medium">{ar() ? "كاش باك مطبق" : "Cashback Applied"}</span>
                  <span className="font-bold text-emerald-700">-{selectedPayment.cashbackAppliedKwd} KWD</span>
                </div>
              )}

              {/* Reference */}
              <div className="text-xs text-surface-300 text-center px-2 break-all">{ar() ? "رقم المرجع: " : "Ref: "}{selectedPayment.id}</div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 pt-4 border-t border-surface-100 shrink-0 flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  className="flex items-center gap-2 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 px-4 rounded-xl transition-colors text-sm"
                  onClick={() => printReceipt(selectedPayment)}
                  title={ar() ? "تحميل الإيصال PDF" : "Download PDF Receipt"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {ar() ? "PDF" : "PDF"}
                </button>
                <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm" onClick={() => setSelectedPayment(null)}>{ar() ? "إغلاق" : "Close"}</button>
                <button
                  className="flex-1 bg-brand-pink-400 hover:bg-brand-pink-500 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
                  disabled={processing === selectedPayment.id}
                  onClick={() => { confirmPayment(selectedPayment); setSelectedPayment(null); }}
                >
                  {processing === selectedPayment.id ? "..." : ar() ? "تأكيد الدفع" : "Confirm Payment"}
                </button>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl transition-colors text-sm border border-red-200"
                disabled={processing === selectedPayment.id}
                onClick={() => { setRejectingPayment(selectedPayment); setSelectedPayment(null); setRejectReason(""); }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                {ar() ? "رفض الطلب" : "Reject Request"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Reject Confirmation Modal */}
      {rejectingPayment && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-slide-up relative flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-surface-100">
              <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {ar() ? "رفض طلب الدفع" : "Reject Payment Request"}
              </h3>
              <p className="text-sm text-surface-500 mt-1">
                {ar()
                  ? `هل أنت متأكد من رفض طلب ${rejectingPayment.userName || rejectingPayment.userId}؟`
                  : `Are you sure you want to reject the request from ${rejectingPayment.userName || rejectingPayment.userId}?`}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-surface-600 mb-1.5">{ar() ? "سبب الرفض (اختياري)" : "Rejection Reason (optional)"}</label>
                <textarea
                  className="input-field w-full resize-none text-sm"
                  rows={3}
                  placeholder={ar() ? "أدخل سبب الرفض..." : "Enter rejection reason..."}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 pb-6 pt-2 flex gap-3">
              <button
                className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm"
                onClick={() => setRejectingPayment(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
                disabled={processing === rejectingPayment.id}
                onClick={() => { rejectPayment(rejectingPayment, rejectReason); setRejectingPayment(null); }}
              >
                {processing === rejectingPayment.id ? "..." : ar() ? "تأكيد الرفض" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
