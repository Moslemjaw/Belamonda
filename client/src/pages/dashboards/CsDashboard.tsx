import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useKycQueue, usePendingPayments, useComplaints, useApi, useBookingRequests, useClinicChangeRequestsCs, invalidateCache } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { addFinancialEntry, upsertSubscription, getSubscriptions, getFinancialLedger } from "../../lib/offerSystem";
import { sharedClinics } from "../../lib/clinics";
import { clinics as treatmentClinics, allTreatments, treatmentCategories } from "../../lib/treatments";
import { getCategoryIcon } from "../../components/CategoryIcons";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReferralActivityWidget } from "../../components/ReferralActivityWidget";

const ar = () => i18n.language === "ar";

function KycQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useKycQueue();
  const [processing, setProcessing] = useState<string | null>(null);

  const reviewKyc = async (submissionId: string, decision: "approve" | "reject") => {
    setProcessing(submissionId);
    try {
      if (decision === "approve") {
        await apiFetch(`/kyc/cs/${submissionId}/approve`, { method: "POST", headers: getAuthHeader() });
      } else {
        await apiFetch(`/kyc/cs/${submissionId}/reject`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ reason: "Documents unclear" }) });
      }
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const items = data?.items || [];
  const fmtAge = (iso: string) => {
    const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return ar() ? `${mins} د` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return ar() ? `${hrs} س` : `${hrs}h`;
    return ar() ? `${Math.floor(hrs / 24)} ي` : `${Math.floor(hrs / 24)}d`;
  };
  return (
    <div className="card-elevated p-5">
      <div className="editorial-header justify-between">
        <div className="flex items-center gap-3">
          <span className="accent" />
          <div>
            <h3>{ar() ? "طابور التحققات" : "KYC Verification Queue"}</h3>
            <div className="meta">{ar() ? "مراجعة وثائق الهوية للأعضاء الجدد" : "Review identity documents for new members"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {items.length > 0 && <span className="status-pill-pending"><span className="dot" aria-hidden="true" />{items.length} {ar() ? "معلق" : "pending"}</span>}
          <button className="icon-btn" onClick={refetch} aria-label={ar() ? "تحديث القائمة" : "Refresh queue"} title={ar() ? "تحديث" : "Refresh"}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>
      {loading ? <div className="shimmer h-32 rounded-2xl" /> : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "كل التحققات مكتملة" : "All caught up"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "لا توجد تحققات معلقة حالياً" : "No pending verifications"}</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((k: any) => {
            const ageMins = (Date.now() - new Date(k.createdAt).getTime()) / 60000;
            const priority = ageMins > 240 ? "red" : ageMins > 60 ? "yellow" : "green";
            return (
              <div key={k.id} className="queue-row group">
                <div className={`priority-${priority} shrink-0`} aria-hidden="true" />
                <span className="sr-only">{priority === "red" ? (ar() ? "أولوية عالية" : "High priority") : priority === "yellow" ? (ar() ? "أولوية متوسطة" : "Medium priority") : (ar() ? "أولوية منخفضة" : "Low priority")}</span>
                <div className="avatar avatar-md" aria-hidden="true">{k.userId?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold text-surface-900 truncate">{k.userId}</div>
                    <span className="text-[10px] font-bold text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded" title={new Date(k.createdAt).toLocaleString()}>{fmtAge(k.createdAt)}</span>
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                    <span className="font-mono">{k.civilIdNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="icon-btn-success"
                    disabled={processing === k.id}
                    onClick={() => reviewKyc(k.id, "approve")}
                    aria-label={ar() ? `قبول التحقق لـ ${k.userId}` : `Approve verification for ${k.userId}`}
                    title={ar() ? "قبول" : "Approve"}
                  >
                    {processing === k.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                  <button
                    className="icon-btn-danger"
                    disabled={processing === k.id}
                    onClick={() => reviewKyc(k.id, "reject")}
                    aria-label={ar() ? `رفض التحقق لـ ${k.userId}` : `Reject verification for ${k.userId}`}
                    title={ar() ? "رفض" : "Reject"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



function PaymentQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = usePendingPayments();
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

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
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const printReceipt = (p: any) => {
    const isAr = ar();
    const logoSvg = `<svg width="52" height="52" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="#F59AB9" opacity="0.9"/><path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="#F59AB9" opacity="0.6"/><path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="#F59AB9" opacity="0.6"/><path d="M12 35C12 35 12 45 20 52C26 57 34 55 40 55C30 55 15 52 12 35Z" fill="#F59AB9" opacity="0.35"/><path d="M68 35C68 35 68 45 60 52C54 57 46 55 40 55C50 55 65 52 68 35Z" fill="#F59AB9" opacity="0.35"/><path d="M10 58C10 58 18 52 28 56C28 56 18 60 10 58Z" fill="#C7CAAB" opacity="0.7"/><path d="M70 58C70 58 62 52 52 56C52 56 62 60 70 58Z" fill="#C7CAAB" opacity="0.7"/><circle cx="40" cy="35" r="8" fill="white" opacity="0.25"/></svg>`;

    const purchaseMode = p.purchaseMode || "full";
    const schedule: any[] = p.installmentSchedule || [];
    const installmentRows = purchaseMode === "installments" && schedule.length > 0
      ? schedule.map((inst: any) => `<tr style="border-bottom:1px solid #f5f5f5"><td style="padding:7px 8px;color:#666;font-size:12px">${isAr ? `القسط ${inst.number}` : `Installment ${inst.number}`}</td><td style="padding:7px 8px;text-align:right;font-weight:700;font-size:12px;color:${inst.paid ? "#059669" : "#1a1a1a"}">${inst.amountKwd} KWD${inst.paid ? (isAr ? " ✓ مدفوع" : " ✓ Paid") : inst.dueDate ? ` · ${new Date(inst.dueDate).toLocaleDateString()}` : ""}</td></tr>`).join("")
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

    const html = `<!DOCTYPE html><html dir="${isAr ? "rtl" : "ltr"}" lang="${isAr ? "ar" : "en"}"><head><meta charset="UTF-8"><title>Belamonda Receipt</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a1a;background:#fff;padding:32px}.receipt{max-width:460px;margin:0 auto;border:1px solid #e8e8e8;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)}.header{background:linear-gradient(135deg,#fdf2f8 0%,#fff 100%);padding:22px 24px;border-bottom:1px solid #f5e6f0;display:flex;align-items:center;gap:14px}.logo-text h1{font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-.5px}.logo-text p{font-size:10px;color:#bbb;text-transform:uppercase;letter-spacing:2px;margin-top:1px}.badge{margin-${isAr ? "right" : "left"}:auto;background:#fce7f3;color:#be185d;font-size:10px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.5px}.section{padding:14px 24px}.section+.section{border-top:1px solid #f5f5f5}.label{font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}.row{display:flex;justify-content:space-between;align-items:center;padding:4px 0}.row .k{font-size:13px;color:#666}.row .v{font-size:13px;font-weight:600;color:#1a1a1a}.amount-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0 4px}.amount-row .k{font-size:13px;color:#666}.amount-row .v{font-size:26px;font-weight:900;color:#db2777}.status{display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px}.ref{font-size:10px;color:#bbb;word-break:break-all}table{width:100%;border-collapse:collapse}.footer{padding:14px 24px;background:#fafafa;text-align:center;border-top:1px solid #f0f0f0}.footer p{font-size:11px;color:#bbb}@media print{body{padding:0}.receipt{border:none;border-radius:0;box-shadow:none}}</style></head><body><div class="receipt"><div class="header">${logoSvg}<div class="logo-text"><h1>Belamonda</h1><p>Beauty &amp; Wellness · Kuwait</p></div><div class="badge">${isAr ? "إيصال" : "Receipt"}</div></div><div class="section"><div class="label">${isAr ? "بيانات العميل" : "Customer"}</div><div class="row"><span class="k">${isAr ? "الاسم" : "Name"}</span><span class="v">${customerName}</span></div>${p.userPhone ? `<div class="row"><span class="k">${isAr ? "الهاتف" : "Phone"}</span><span class="v">${p.userPhone}</span></div>` : ""}${p.userEmail ? `<div class="row"><span class="k">${isAr ? "البريد الإلكتروني" : "Email"}</span><span class="v">${p.userEmail}</span></div>` : ""}</div><div class="section"><div class="label">${isAr ? "تفاصيل الباقة" : "Offer Details"}</div><div class="row"><span class="k">${isAr ? "الباقة" : "Package"}</span><span class="v">${offerDisplay}</span></div>${clinicDisplay ? `<div class="row"><span class="k">${isAr ? "العيادة" : "Clinic"}</span><span class="v">${clinicDisplay}</span></div>` : ""}<div class="row"><span class="k">${isAr ? "طريقة الدفع" : "Payment Mode"}</span><span class="v">${modeLabel}</span></div><div class="amount-row"><span class="k">${isAr ? "المبلغ المطلوب" : "Amount Due"}</span><span class="v">${amountDue} KWD</span></div></div>${installmentRows ? `<div class="section"><div class="label">${isAr ? "جدول الأقساط" : "Installment Schedule"}</div><table>${installmentRows}</table></div>` : ""}<div class="section"><div class="row"><span class="k">${isAr ? "الحالة" : "Status"}</span><span class="v"><span class="status">${isAr ? "في انتظار التأكيد" : "Awaiting Confirmation"}</span></span></div><div class="row" style="margin-top:6px"><span class="k">${isAr ? "التاريخ" : "Date"}</span><span class="v">${new Date(p.createdAt).toLocaleString()}</span></div><div class="row" style="margin-top:6px"><span class="k">${isAr ? "رقم المرجع" : "Reference ID"}</span><span class="v ref">${p.id}</span></div></div><div class="footer"><p>${isAr ? "شكراً لاختيارك بيلاموندو" : "Thank you for choosing Belamonda"}</p><p style="margin-top:3px">www.belamonda.com</p></div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;

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
    <div className="card-elevated p-5">
      <div className="editorial-header justify-between">
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
        <div className="space-y-1.5">
          {items.map((p: any) => {
            const modeColors = p.purchaseMode === "installments"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : p.purchaseMode === "deposit"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200";
            return (
              <div key={p.id} className="queue-row group">
                <div className="avatar avatar-md bg-amber-100 text-amber-700">{(p.userName || p.userId)?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <div className="text-sm font-bold text-surface-900 truncate">{p.userName || p.userId}</div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${modeColors}`}>{modeLabel(p)}</span>
                  </div>
                  <div className="text-xs text-surface-500 truncate">{ar() && p.offerNameAr ? p.offerNameAr : (p.offerName || p.offerId?.slice(0, 30))}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-brand-pink-600 leading-none whitespace-nowrap">{p.amount || p.paymentAmountKwd}</div>
                  <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider mt-1">KWD</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="icon-btn" onClick={() => setSelectedPayment(p)} aria-label={ar() ? `عرض تفاصيل دفع ${p.userName || p.userId}` : `View payment details for ${p.userName || p.userId}`} title={ar() ? "التفاصيل" : "Details"}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                  <button className="btn-primary btn-sm px-3.5" disabled={processing === p.id} onClick={() => confirmPayment(p)} aria-label={ar() ? `تأكيد دفع ${p.amount || p.paymentAmountKwd} د.ك من ${p.userName || p.userId}` : `Confirm payment of ${p.amount || p.paymentAmountKwd} KWD from ${p.userName || p.userId}`}>
                    {processing === p.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {ar() ? "تأكيد" : "Confirm"}
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
                  <span className="font-semibold text-surface-800">{new Date(selectedPayment.createdAt).toLocaleString()}</span>
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
                          <span className="text-blue-800">{ar() ? `القسط ${inst.number}` : `Installment ${inst.number}`}{inst.dueDate ? ` · ${new Date(inst.dueDate).toLocaleDateString()}` : ""}</span>
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
            <div className="px-6 pb-6 pt-4 border-t border-surface-100 shrink-0 flex gap-3">
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
          </div>
        </div>, document.body
      )}
    </div>
  );
}

function BookingRequestsQueue() {
  const { getAuthHeader } = useAuth();
  const { data, refetch } = useBookingRequests("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [scheduleForm, setScheduleForm] = useState<{ scheduledAt: string; notes: string }>({ scheduledAt: "", notes: "" });

  const schedule = async (requestId: string) => {
    if (!scheduleForm.scheduledAt) return;
    setProcessing(requestId);
    try {
      // datetime-local -> ISO
      const iso = new Date(scheduleForm.scheduledAt).toISOString();
      await apiFetch(`/scheduling/cs/requests/${encodeURIComponent(requestId)}/schedule`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt: iso, notes: scheduleForm.notes || undefined })
      });
      setScheduleForm({ scheduledAt: "", notes: "" });
      await refetch();
      setSelectedBooking(null);
    } catch (e: any) {
      const code = e.message || "UNKNOWN_ERROR";
      const friendly: Record<string, string> = {
        OFFER_NOT_ACTIVE: "The customer's membership is not active yet.",
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
      await refetch();
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="card-elevated p-5 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "طلبات الحجز" : "Booking Requests"}</h3>
        <div className="flex items-center gap-2">
          <span className="badge-pink">{(data?.items || []).length} {ar() ? "معلق" : "pending"}</span>
        </div>
      </div>
      {(data?.items || []).length === 0 ? (
        <div className="text-center text-sm text-surface-400 py-8">✅ {ar() ? "لا توجد طلبات حجز معلقة" : "No pending booking requests"}</div>
      ) : (data?.items || []).map((b: any) => (
        <div key={b.id} className="flex items-center gap-4 py-3 border-b border-surface-100 last:border-0">
          <div className="avatar avatar-sm bg-blue-100 text-blue-700">{b.userId?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-surface-800">{b.userId}</div>
            <div className="text-xs text-surface-400">{b.userOfferId?.slice(0, 25)}</div>
            <div className="mt-1 flex gap-1.5 flex-wrap">
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">
                {ar() ? (b.clinicNameAr || b.clinicId) : (b.clinicNameEn || b.clinicId)}
              </span>
              {(b.bookingRoute === "clinic" || (b.bookingRoute == null && b.isStandalone)) && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  {ar() ? "العيادة تتولى الحجز" : "Clinic Handles"}
                </span>
              )}
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${b.clinicPaymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {b.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع بالعيادة" : "Clinic Paid") : (ar() ? "دفع العيادة معلّق" : "Clinic Payment Pending")}
              </span>
            </div>
          </div>
          <div className="text-xs text-surface-400 mr-2">{new Date(b.createdAt).toLocaleTimeString()}</div>
          <div className="flex items-center gap-2">
            {!(b.bookingRoute === "clinic" || (b.bookingRoute == null && b.isStandalone)) ? (
              <>
                <button className="btn-primary btn-sm px-4 bg-blue-500 hover:bg-blue-600 border-none" onClick={() => setSelectedBooking(b)}>
                  {ar() ? "جدولة" : "Schedule"}
                </button>
                <button
                  className="btn-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-3 py-1.5 text-xs font-bold border border-red-200"
                  disabled={processing === b.id}
                  onClick={() => void cancelRequest(b.id)}
                >
                  {processing === b.id ? "..." : ar() ? "إلغاء" : "Cancel"}
                </button>
              </>
            ) : (
              <button className="bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium px-3 py-1.5 rounded-xl text-xs transition-colors" onClick={() => setSelectedBooking(b)}>
                {ar() ? "عرض" : "View"}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Booking Details Modal */}
      {selectedBooking && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
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
                     <div className="avatar avatar-sm bg-blue-100 text-blue-700">{selectedBooking.userId?.charAt(0)?.toUpperCase()}</div>
                     <div>
                        <div className="font-bold text-surface-900">{selectedBooking.userId}</div>
                        <div className="text-xs text-surface-500">{new Date(selectedBooking.createdAt).toLocaleString()}</div>
                     </div>
                  </div>
               </div>

               {/* Request Details */}
               <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                 <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "تفاصيل الطلب" : "Request Details"}</h4>
                  <div className="space-y-2">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "العرض/الاشتراك" : "User offer"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.userOfferId}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "العيادة المطلوبة" : "Requested Clinic"}</span>
                        <span className="font-bold text-brand-pink-600">{ar() ? (selectedBooking.clinicNameAr || selectedBooking.clinicId) : (selectedBooking.clinicNameEn || selectedBooking.clinicId)}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "موعد مفضل" : "Preferred time"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.preferredAt ? new Date(selectedBooking.preferredAt).toLocaleString() : (ar() ? "غير محدد" : "—")}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "السعر" : "Price"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.sessionPriceKwd || "0.000"} KWD</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "العضوية/النوع" : "Membership Type"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.membershipType || "none"}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "كاش باك مستخدم" : "Cashback Used"}</span>
                        <span className="font-bold text-surface-900">{selectedBooking.cashbackDeductedKwd || "0.000"} KWD</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-surface-500">{ar() ? "الدفع من العيادة" : "Clinic Payment"}</span>
                        <span className={`font-bold ${selectedBooking.clinicPaymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                          {selectedBooking.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلّق" : "Pending")}
                        </span>
                     </div>
                  </div>
               </div>

              {!(selectedBooking.bookingRoute === "clinic" || (selectedBooking.bookingRoute == null && selectedBooking.isStandalone)) && (
                <div className="bg-white rounded-2xl p-4 border border-surface-200">
                  <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "تحديد الموعد" : "Assign date & time"}</h4>
                  <div className="grid gap-3">
                    <input
                      className="input-field"
                      type="datetime-local"
                      value={scheduleForm.scheduledAt}
                      onChange={(e) => setScheduleForm((s) => ({ ...s, scheduledAt: e.target.value }))}
                    />
                    <input
                      className="input-field"
                      placeholder={ar() ? "ملاحظات (اختياري)" : "Notes (optional)"}
                      value={scheduleForm.notes}
                      onChange={(e) => setScheduleForm((s) => ({ ...s, notes: e.target.value }))}
                    />
                  </div>
                </div>
              )}
             </div>

             <div className="mt-8 flex gap-3">
                <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors" onClick={() => setSelectedBooking(null)}>{ar() ? "إغلاق" : "Close"}</button>
                {!(selectedBooking.bookingRoute === "clinic" || (selectedBooking.bookingRoute == null && selectedBooking.isStandalone)) && (
                  <button
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
                    disabled={processing === selectedBooking.id || !scheduleForm.scheduledAt}
                    onClick={() => void schedule(selectedBooking.id)}
                  >
                    {processing === selectedBooking.id ? "..." : ar() ? "تأكيد الموعد" : "Schedule"}
                  </button>
                )}
             </div>
           </div>
        </div>, document.body
      )}
    </div>
  );
}


function CustomerMemberships() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useApi<{ items: any[] }>("/commerce/admin/user-offers");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending_payment" | "cancelled" | "expired">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const allOffers = (data?.items || []).filter((o: any) => !o.isStandalone);
  const filtered = allOffers
    .filter((o: any) => statusFilter === "all" || o.status === statusFilter)
    .filter((o: any) => !filterUser.trim() || o.userId?.toLowerCase().includes(filterUser.trim().toLowerCase()) || (o.offerName || "").toLowerCase().includes(filterUser.trim().toLowerCase()));

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiFetch(`/commerce/admin/user-offers/${id}`, { method: "DELETE", headers: getAuthHeader() });
      setConfirmId(null);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to cancel membership");
    } finally {
      setCancellingId(null);
    }
  };

  const handleAdjustSessions = async (id: string, delta: number) => {
    setAdjustingId(id + (delta > 0 ? "_inc" : "_dec"));
    try {
      await apiFetch(`/scheduling/admin/user-offers/${id}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta }),
      });
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to adjust sessions");
    } finally {
      setAdjustingId(null);
    }
  };

  const statusCounts = {
    all: allOffers.length,
    active: allOffers.filter((o: any) => o.status === "active").length,
    pending_payment: allOffers.filter((o: any) => o.status === "pending_payment").length,
    cancelled: allOffers.filter((o: any) => o.status === "cancelled").length,
    expired: allOffers.filter((o: any) => o.status === "expired").length,
  };

  if (loading) return <div className="card-elevated p-5"><div className="shimmer h-32 rounded-xl" /></div>;

  const getMembershipTypeBadge = (type?: string) => {
    if (type === "cashback") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">💰 {ar() ? "كاش باك" : "Cashback"}</span>;
    if (type === "free_sessions") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">🎫 {ar() ? "جلسات مجانية" : "Free Sessions"}</span>;
    if (type === "group") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">👥 {ar() ? "جماعي" : "Group"}</span>;
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">—</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          {ar() ? "اشتراكات العملاء" : "Customer Memberships"}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 font-medium">{filtered.length} / {allOffers.length}</span>
          <button className="btn-ghost btn-sm" onClick={refetch}>↻</button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={ar() ? "بحث بالمستخدم أو العرض..." : "Search by user or offer..."}
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="input-field text-xs py-2 pl-9 w-full"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "pending_payment", "cancelled", "expired"] as const).map(s => {
            const labels: Record<string, string> = { all: ar() ? "الكل" : "All", active: ar() ? "نشط" : "Active", pending_payment: ar() ? "معلق" : "Pending", cancelled: ar() ? "ملغي" : "Cancelled", expired: ar() ? "منتهي" : "Expired" };
            const colors: Record<string, string> = { all: "bg-surface-100 text-surface-700", active: "bg-emerald-100 text-emerald-700", pending_payment: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700", expired: "bg-surface-200 text-surface-500" };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${statusFilter === s ? colors[s] + " ring-2 ring-offset-1 ring-brand-pink-300 shadow-sm" : "bg-surface-50 text-surface-400 hover:bg-surface-100"}`}
              >
                {labels[s]} ({statusCounts[s]})
              </button>
            );
          })}
        </div>
      </div>

      {/* Memberships List */}
      {filtered.length === 0 ? (
        <div className="card-elevated text-center text-sm text-surface-400 py-12">✅ {ar() ? "لا توجد اشتراكات مطابقة" : "No matching memberships"}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o: any) => {
            const isAwaiting = o.status === 'pending_payment';
            const isExpired = o.status === 'expired';
            const isCancelled = o.status === 'cancelled';
            const isActive = o.status === 'active';
            const statusColor = isAwaiting ? 'bg-amber-100 text-amber-700' : isExpired ? 'bg-surface-100 text-surface-500' : isCancelled ? 'bg-red-100 text-red-700' : isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600';
            const statusText = isAwaiting ? (ar() ? "بانتظار الدفع" : "Awaiting Payment") : isExpired ? (ar() ? "منتهي" : "Expired") : isCancelled ? (ar() ? "ملغي" : "Cancelled") : isActive ? (ar() ? "نشط" : "Active") : o.status;
            const borderColor = isAwaiting ? 'border-l-amber-400' : isExpired ? 'border-l-surface-300' : isCancelled ? 'border-l-red-400' : isActive ? 'border-l-emerald-500' : 'border-l-surface-300';
            const isConfirming = confirmId === o.id;
            const isCancelling = cancellingId === o.id;
            const canCancel = !isCancelled && !isExpired;
            const isExpanded = expandedId === o.id;

            return (
              <div key={o.id} className={`bg-white rounded-xl border border-surface-200 border-l-4 shadow-sm transition-all hover:shadow-md ${borderColor} ${isCancelled ? 'opacity-60' : ''}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColor}`}>{statusText}</span>
                        {getMembershipTypeBadge(o.membershipType)}
                        {o.purchaseMode && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-surface-50 text-surface-500 border border-surface-200">{o.purchaseMode}</span>}
                      </div>
                      <div className="text-sm font-bold text-surface-900">{o.offerName || (ar() ? "عرض" : "Offer")}</div>
                      <div className="text-xs text-surface-400 mt-0.5 font-mono">{o.userId}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="text-xs font-medium text-surface-500 hover:text-surface-700 bg-surface-50 hover:bg-surface-100 px-2.5 py-1.5 rounded-lg transition-colors border border-surface-200" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        {isExpanded ? "▲" : "▼"}
                      </button>
                      {canCancel && !isConfirming && (
                        <button className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors font-medium" onClick={() => setConfirmId(o.id)}>{ar() ? "إلغاء" : "Cancel"}</button>
                      )}
                      {isConfirming && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-surface-600 whitespace-nowrap">{ar() ? "تأكيد؟" : "Sure?"}</span>
                          <button className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg disabled:opacity-50" disabled={isCancelling} onClick={() => void handleCancel(o.id)}>{isCancelling ? "…" : (ar() ? "نعم" : "Yes")}</button>
                          <button className="text-xs text-surface-600 border border-surface-200 bg-white px-2.5 py-1 rounded-lg" onClick={() => setConfirmId(null)}>{ar() ? "لا" : "No"}</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="text-xs"><span className="text-surface-400">{ar() ? "الدفع:" : "Payment:"}</span> <span className="font-bold text-surface-700">{o.paymentAmountKwd || '0.000'} KWD</span></div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-surface-400">{ar() ? "الجلسات:" : "Sessions:"}</span>
                      <span className="font-bold text-surface-700">{o.sessionsUsed || 0}{o.maxSessions ? ` / ${o.maxSessions}` : ''}</span>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-red-100 hover:text-red-600 text-surface-500 transition-colors disabled:opacity-40"
                        disabled={adjustingId !== null || (o.sessionsUsed || 0) <= 0}
                        onClick={() => handleAdjustSessions(o.id, -1)}
                        title={ar() ? "تقليل الجلسات" : "Decrement sessions"}
                      >−</button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-emerald-100 hover:text-emerald-600 text-surface-500 transition-colors disabled:opacity-40"
                        disabled={adjustingId !== null || (o.maxSessions != null && (o.sessionsUsed || 0) >= o.maxSessions)}
                        onClick={() => handleAdjustSessions(o.id, +1)}
                        title={ar() ? "زيادة الجلسات" : "Increment sessions"}
                      >+</button>
                    </div>
                    {o.membershipType === 'cashback' && o.cashbackBalanceKwd && (
                      <div className="text-xs"><span className="text-surface-400">{ar() ? "رصيد الكاش باك:" : "CB Balance:"}</span> <span className="font-bold text-amber-600">{o.cashbackBalanceKwd} KWD</span></div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-surface-100 p-4 bg-surface-50/50 space-y-2 text-xs animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div><span className="text-surface-400 block">{ar() ? "المعرف" : "ID"}</span><span className="font-mono font-bold text-surface-700">{o.id}</span></div>
                      <div><span className="text-surface-400 block">{ar() ? "العرض" : "Offer ID"}</span><span className="font-mono text-surface-700">{o.offerId}</span></div>
                      <div><span className="text-surface-400 block">{ar() ? "العيادة" : "Clinic"}</span><span className="font-bold text-surface-700">{o.clinicId}</span></div>
                      {o.paymentMethod && <div><span className="text-surface-400 block">{ar() ? "طريقة الدفع" : "Pay Method"}</span><span className="font-bold text-surface-700">{o.paymentMethod}</span></div>}
                      {o.activatedAt && <div><span className="text-surface-400 block">{ar() ? "تم التفعيل" : "Activated"}</span><span className="font-bold text-surface-700">{new Date(o.activatedAt).toLocaleDateString()}</span></div>}
                      {o.expiresAt && <div><span className="text-surface-400 block">{ar() ? "ينتهي" : "Expires"}</span><span className="font-bold text-surface-700">{new Date(o.expiresAt).toLocaleDateString()}</span></div>}
                      {o.groupInviteCode && <div><span className="text-surface-400 block">{ar() ? "كود الدعوة" : "Invite Code"}</span><span className="font-mono font-bold text-purple-600">{o.groupInviteCode}</span></div>}
                      {o.sharedWith?.length > 0 && <div><span className="text-surface-400 block">{ar() ? "مشارك مع" : "Shared With"}</span><span className="font-bold text-purple-600">{o.sharedWith.length} {ar() ? "عضو" : "members"}</span></div>}
                      {o.cashbackAppliedKwd && o.cashbackAppliedKwd !== '0.000' && <div><span className="text-surface-400 block">{ar() ? "كاش باك مطبق" : "CB Applied"}</span><span className="font-bold text-emerald-600">{o.cashbackAppliedKwd} KWD</span></div>}
                    </div>
                    {o.installmentSchedule?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-200">
                        <span className="font-bold text-surface-700 block mb-2">{ar() ? "جدول الأقساط" : "Installment Schedule"}</span>
                        <div className="flex gap-1">
                          {o.installmentSchedule.map((inst: any, i: number) => (
                            <div key={i} className={`flex-1 h-2 rounded-full ${inst.paid ? 'bg-emerald-500' : 'bg-surface-200'}`} title={`#${inst.number}: ${inst.amountKwd} KWD`} />
                          ))}
                        </div>
                        <div className="text-[10px] text-surface-400 mt-1">{o.installmentsPaid || 0} / {o.installmentCount || 0} {ar() ? "مدفوع" : "paid"}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SchedulingTool() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [form, setForm] = useState({
     treatment: "",
     clinicId: "",
     scheduledAt: "",
  });
  const [result, setResult] = useState<string | null>(null);
  const [coolingOffWarning, setCoolingOffWarning] = useState<number | null>(null);

  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  

  const mockTreatments = allTreatments.map(t => ({ id: t.id, name: ar() ? t.nameAr : t.nameEn, category: t.category }));

  useEffect(() => {
     if (!customerQuery || !form.treatment) {
        setCoolingOffWarning(null);
        return;
     }
     try {
       const offers = JSON.parse(localStorage.getItem('demo_offers_v4') || '[]');
       const userOffers = offers.filter((o: any) => o.userId === customerQuery || customerQuery === 'cust1');
       const treatmentCategory = mockTreatments.find(t => t.id === form.treatment)?.category;
       
       let warning = null;
       for (const o of userOffers) {
          if ((!o.category || o.category === treatmentCategory) && o.lastAppointmentDate) {
              const daysSince = Math.floor((new Date().getTime() - new Date(o.lastAppointmentDate).getTime()) / (1000 * 60 * 60 * 24));
              if (daysSince < 25) {
                  warning = 25 - daysSince;
                  break;
              }
          }
       }
       setCoolingOffWarning(warning);
     } catch (e) {
       setCoolingOffWarning(null);
     }
  }, [customerQuery, form.treatment]);

  const scheduleSession = () => {
    if (!customerQuery || !form.treatment || !form.clinicId || !form.scheduledAt) {
       setResult(ar() ? "❌ يرجى تعبئة جميع الحقول" : "❌ Please fill all fields");
       return;
    }

    if (coolingOffWarning !== null) {
       setResult(ar() ? `لا يمكن الحجز. العميل في فترة انتظار.` : `Cannot book. Customer is in cooling-off period.`);
       return;
    }

    setResult(ar() ? `تم الحجز بنجاح!` : `Successfully scheduled!`);
    
    try {
      const offers = JSON.parse(localStorage.getItem('demo_offers_v4') || '[]');
      const treatmentCategory = mockTreatments.find(t => t.id === form.treatment)?.category;
      let updated = false;
      const updatedOffers = offers.map((o: any) => {
         if (!updated && (o.userId === customerQuery || customerQuery === 'cust1') && (!o.category || o.category === treatmentCategory)) {
             updated = true;
             return { ...o, lastAppointmentDate: new Date(form.scheduledAt).toISOString() };
         }
         return o;
      });
      localStorage.setItem('demo_offers_v4', JSON.stringify(updatedOffers));
    } catch(e) {}

    setTimeout(() => setResult(null), 4000);
  };

  return (
    <div className="card-elevated p-6 animate-fade-in">
      <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "جدولة جلسة جديدة" : "Schedule New Session"}</h3>
      <p className="text-sm text-surface-500 mb-6">{ar() ? "قم بإنشاء موعد جديد لعميل محدد مع اختيار نوع العلاج والعيادة." : "Create a new appointment for a specific customer, select treatment and clinic."}</p>
      
      {coolingOffWarning !== null && (
         <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3">
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="font-bold text-sm">{ar() ? `لا يمكن الحجز. يجب الانتظار ${coolingOffWarning} يوم للعميل حسب سياسة الباقة.` : `Cannot book. Must wait ${coolingOffWarning} days for this customer based on package cooling-off policy.`}</span>
         </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="lg:col-span-1">
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "العميل (هاتف، إيميل، هوية)" : "Customer (Phone, Email, ID)"}</label>
           <input 
             className="input-field bg-surface-50 focus:bg-white" 
             value={customerQuery} 
             onChange={e => setCustomerQuery(e.target.value)} 
             placeholder={ar() ? "بحث..." : "Search..."} 
           />
        </div>
        
        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "نوع الجلسة" : "Treatment Type"}</label>
           <select className="select-field bg-surface-50 focus:bg-white" value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })}>
             <option value="" disabled>{ar() ? "اختر الجلسة" : "Select Treatment"}</option>
             {mockTreatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
           </select>
        </div>

        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "العيادة" : "Clinic"}</label>
           <select className="select-field bg-surface-50 focus:bg-white" value={form.clinicId} onChange={e => setForm({ ...form, clinicId: e.target.value })}>
             <option value="" disabled>{ar() ? "اختر العيادة" : "Select Clinic"}</option>
             {(clinicsData?.items || []).map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
           </select>
        </div>

        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "الموعد" : "Date & Time"}</label>
           <input 
             className="input-field bg-surface-50 focus:bg-white" 
             type="datetime-local" 
             value={form.scheduledAt} 
             onChange={e => setForm({ ...form, scheduledAt: e.target.value })} 
           />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-surface-100 pt-5">
         <div className="text-sm font-medium">
            {result?.includes('✅') ? (
               <span className="text-emerald-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {result}
               </span>
            ) : result ? (
               <span className="text-red-500">{result}</span>
            ) : null}
         </div>
         <button className={`btn-primary px-8 shadow-md ${coolingOffWarning !== null ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={coolingOffWarning !== null} onClick={scheduleSession}>{ar() ? "تأكيد الحجز" : "Confirm Booking"}</button>
      </div>
    </div>
  );
}

function CustomerLookup() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const mockUsers = [
    { id: "USR-001", name: "Ahmed Al-Fadhli", username: "ahmedf", email: "ahmed@example.com", phone: "+965 99887766", role: "Customer", status: "Verified", balance: "145.000 KWD", dob: "14 Jan 1990", civilId: "290123456789" },
    { id: "USR-002", name: "Sarah Al-Salem", username: "sarah_s", email: "sarah.s@domain.com", phone: "+965 55443322", role: "Customer", status: "Pending KYC", balance: "0.000 KWD", dob: "22 May 1995", civilId: "295052212345" },
    { id: "USR-003", name: "Fatima Khalid", username: "fatimak", email: "f.khalid@mail.com", phone: "+965 11223344", role: "Customer", status: "Frozen", balance: "20.000 KWD", dob: "05 Dec 1988", civilId: "288120598765" }
  ];

  const handleLookup = () => {
    if (!search.trim()) {
       setResult(null);
       setHasSearched(false);
       return;
    }
    const lowerQuery = search.toLowerCase();
    const found = mockUsers.find(u => 
       u.id.toLowerCase().includes(lowerQuery) ||
       u.name.toLowerCase().includes(lowerQuery) ||
       u.username.toLowerCase().includes(lowerQuery) ||
       u.email.toLowerCase().includes(lowerQuery) ||
       u.phone.toLowerCase().includes(lowerQuery)
    );
    setResult(found || null);
    setHasSearched(true);
  };

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "بحث العملاء الشامل" : "Comprehensive Customer Lookup"}</h3>
        <p className="text-sm text-surface-500 mb-6">{ar() ? "ابحث بواسطة: المعرف، الاسم، اسم المستخدم، البريد، أو الهاتف" : "Search by: ID, Name, Username, Email, or Phone Number"}</p>
        
        <div className="flex gap-3">
          <div className="relative flex-1">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <input 
               className="input-field pl-11 py-3 w-full bg-surface-50 border-surface-200 focus:bg-white" 
               placeholder={ar() ? "أدخل كلمة البحث هنا..." : "Enter search term here..."} 
               value={search} 
               onChange={e => { setSearch(e.target.value); setHasSearched(false); }} 
               onKeyDown={e => e.key === 'Enter' && handleLookup()}
             />
          </div>
          <button className="btn-primary px-8" onClick={handleLookup}>{ar() ? "بحث" : "Search"}</button>
        </div>
      </div>

      {hasSearched && !result && (
         <div className="card-elevated p-12 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-16 h-16 bg-surface-100 text-surface-400 rounded-full flex items-center justify-center mb-4">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h4 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "لم يتم العثور على نتائج" : "No results found"}</h4>
            <p className="text-surface-500 max-w-sm">{ar() ? "يرجى التحقق من صحة البيانات المدخلة والمحاولة مرة أخرى." : "Please check your search term and try again. Ensure there are no typos."}</p>
         </div>
      )}

      {result && (
        <div className="card-elevated p-6 animate-slide-up relative bg-surface-50">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-2xl shadow-sm">
              {result.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-surface-900">{result.name} <span className="text-base text-surface-400 font-normal">(@{result.username})</span></h2>
              <div className="text-sm text-surface-500 mt-1">{result.id} • {result.phone}</div>
              <div className="mt-2 flex gap-2">
                 <span className={result.status === 'Frozen' ? 'badge-red' : result.status === 'Verified' ? 'badge-green' : 'badge-yellow'}>{result.status}</span>
                 <span className="badge-sage">{result.role}</span>
              </div>
            </div>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-3 mb-4">
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "نظرة عامة" : "Overview"}</h4>
                  <div className="space-y-4">
                    <div><div className="text-xs text-surface-500">{ar() ? "الرصيد المتاح" : "Available Balance"}</div><div className="text-xl font-black text-brand-pink-600">{result.balance}</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "الرقم المدني" : "Civil ID"}</div><div className="font-mono text-sm text-surface-900">{result.civilId}</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "تاريخ الميلاد" : "Date of Birth"}</div><div className="text-sm text-surface-900">{result.dob}</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "البريد الإلكتروني" : "Email"}</div><div className="text-sm text-surface-900">{result.email}</div></div>
                  </div>
               </div>
            </div>
            
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 flex items-center justify-between pb-2 border-b border-surface-100">
                     {ar() ? "الاشتراكات والعروض" : "Memberships & Offers"}
                  </h4>
                  {(() => {
                     const userOffers = (() => { try { return JSON.parse(localStorage.getItem('demo_offers_v4') || '[]'); } catch { return []; } })();
                     const activeOffers = userOffers.filter((o: any) => !(o.maxSessions && o.sessionsUsed >= o.maxSessions));
                     return activeOffers.length === 0 ? (
                        <div className="text-center text-sm text-surface-400 py-6">{ar() ? "لا توجد اشتراكات" : "No memberships"}</div>
                     ) : (
                     <div className="grid gap-3 sm:grid-cols-2">
                        {activeOffers.map((o: any) => (
                           <div key={o.id} className="bg-surface-50 p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                              <div className="text-sm font-bold text-surface-900">{o.offerName || o.offerId}</div>
                              <div className="text-xs text-surface-500 mt-1 mb-3">{o.amount} • {o.method || "N/A"}</div>
                              <div className="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center">
                                 <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${o.status === 'active' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
                                    {o.method === 'Installments' ? `${o.paidInstallments || 0}/${o.totalInstallments} Paid` : o.status}
                                 </span>
                                 {o.maxSessions && <span className="text-[10px] font-bold text-surface-400">{o.maxSessions - (o.sessionsUsed || 0)} Left</span>}
                              </div>
                           </div>
                        ))}
                     </div>
                     );
                  })()}
               </div>

               <div className="grid gap-6 md:grid-cols-2">
                  {(() => {
                     const bookings = (() => { try { return JSON.parse(localStorage.getItem('demo_pending_bookings_v4') || '[]'); } catch { return []; } })();
                     return (
                     <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                        <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المواعيد" : "Appointments"}</h4>
                        {bookings.length === 0 ? (
                           <div className="text-center text-sm text-surface-400 py-6">{ar() ? "لا مواعيد" : "No appointments"}</div>
                        ) : (
                        <div className="space-y-3">
                           {bookings.slice(0, 3).map((b: any) => (
                              <div key={b.id} className="bg-surface-50 p-3 rounded-lg border-l-4 border-l-blue-500 border border-surface-200 shadow-sm">
                                 <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">{b.userId} • {new Date(b.createdAt).toLocaleDateString()}</div>
                                 <div className="text-sm font-bold text-surface-900">{b.offerName || b.offerId}</div>
                                 {b.clinic && <div className="text-xs text-surface-500">📍 {b.clinic}</div>}
                              </div>
                           ))}
                        </div>
                        )}
                     </div>
                     );
                  })()}

                  {(() => {
                     const ledger = getFinancialLedger().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                     return (
                     <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                        <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المدفوعات" : "Payments"}</h4>
                        {ledger.length === 0 ? (
                           <div className="text-center text-sm text-surface-400 py-6">{ar() ? "لا مدفوعات" : "No payments"}</div>
                        ) : (
                        <div className="space-y-3">
                           {ledger.slice(0, 3).map((e: any) => (
                              <div key={e.id} className="flex items-center justify-between bg-surface-50 p-3 rounded-lg border border-surface-200 shadow-sm">
                                 <div>
                                    <div className="text-sm font-bold text-surface-900">{e.description?.slice(0, 25)}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{e.type?.replace(/_/g, ' ')}</div>
                                 </div>
                                 <div className={`text-sm font-black ${e.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{e.amount >= 0 ? '+' : ''}{e.amount.toFixed(3)} KWD</div>
                              </div>
                           ))}
                        </div>
                        )}
                     </div>
                     );
                  })()}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function CustomersManager() {
  const { getAuthHeader } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantType, setGrantType] = useState<"offer" | "session">("session");
  const [grantItem, setGrantItem] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantSessions, setGrantSessions] = useState("");
  const [freezing, setFreezing] = useState(false);

  const loadUsers = () => {
    setUsersLoading(true);
    apiFetch("/users/admin?role=customer", { headers: getAuthHeader() })
      .then((res: any) => setUsers(res.items ?? []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleManage = async (u: any) => {
    setSelectedUser(u);
    setProfile(null);
    setProfileLoading(true);
    try {
      const data: any = await apiFetch(`/users/admin/${u.id}/profile`, { headers: getAuthHeader() });
      setProfile(data);
    } catch {}
    finally { setProfileLoading(false); }
  };

  const handleFreeze = async () => {
    if (!selectedUser) return;
    setFreezing(true);
    try {
      await apiFetch(`/users/admin/${selectedUser.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selectedUser.isActive }),
      });
      const updated = { ...selectedUser, isActive: !selectedUser.isActive };
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
    } catch (e: any) { alert(e.message); }
    finally { setFreezing(false); }
  };

  const getDisplayName = (u: any) => u.fullName || u.username || "—";
  const getStatus = (u: any, p?: any) => {
    if (!u.isActive) return "Frozen";
    const kycStatus = p?.kyc?.status;
    if (kycStatus === "approved") return "Verified";
    if (kycStatus === "pending") return "Pending KYC";
    if (kycStatus === "rejected") return "KYC Rejected";
    return "Active";
  };
  const getStatusBadge = (status: string) => {
    if (status === "Verified") return "badge-green";
    if (status === "Frozen") return "badge-red";
    if (status === "Pending KYC") return "badge-yellow";
    return "badge-sage";
  };

  const filtered = users.filter(u =>
    getDisplayName(u).toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || "").includes(search) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const userStatus = selectedUser ? getStatus(selectedUser, profile) : "";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "العملاء (المرضى)" : "Customers (Patients)"}</h3>
        <div className="w-64">
          <input className="input-field" placeholder={ar() ? "بحث بالاسم أو الهاتف..." : "Search name or phone..."} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {selectedUser ? (
        <div className="card-elevated p-6 animate-slide-up relative bg-surface-50">
          <button className="absolute top-6 right-6 text-surface-400 hover:text-surface-900 bg-white hover:bg-surface-200 border border-surface-200 p-2 rounded-full transition-colors shadow-sm"
            onClick={() => { setSelectedUser(null); setProfile(null); }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="flex items-start gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-2xl shadow-sm">
              {getDisplayName(selectedUser).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-surface-900">{getDisplayName(selectedUser)}</h2>
              <div className="text-sm text-surface-500 mt-1">@{selectedUser.username} • {selectedUser.phone || "—"}</div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className={getStatusBadge(userStatus)}>{userStatus}</span>
                <span className="badge-sage">Customer</span>
                {selectedUser.email && <span className="text-xs text-surface-400">{selectedUser.email}</span>}
              </div>
            </div>
          </div>

          {profileLoading ? (
            <div className="py-12 text-center text-sm text-surface-400 animate-pulse">{ar() ? "جاري تحميل الملف الشخصي..." : "Loading profile..."}</div>
          ) : (
          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "نظرة عامة" : "Overview"}</h4>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-surface-500">{ar() ? "الرصيد المتاح" : "Available Balance"}</div>
                    <div className="text-xl font-black text-brand-pink-600">
                      {profile?.wallet ? `${Number(profile.wallet.unlockedKwd ?? 0).toFixed(3)} KWD` : "—"}
                    </div>
                    {profile?.wallet?.lockedKwd > 0 && (
                      <div className="text-xs text-surface-400 mt-0.5">{Number(profile.wallet.lockedKwd).toFixed(3)} KWD {ar() ? "مقفل" : "locked"}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">{ar() ? "الرقم المدني" : "Civil ID"}</div>
                    <div className="font-mono text-sm text-surface-900">{profile?.kyc?.civilIdNumberMasked || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">{ar() ? "حالة KYC" : "KYC Status"}</div>
                    <div className="text-sm text-surface-900 capitalize">{profile?.kyc?.status ?? "Not submitted"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-surface-500">{ar() ? "البريد الإلكتروني" : "Email"}</div>
                    <div className="text-sm text-surface-900">{selectedUser.email || "—"}</div>
                  </div>
                  <div className="pt-2 border-t border-surface-100">
                    <div className="text-xs text-surface-500">{ar() ? "تاريخ التسجيل" : "Registered"}</div>
                    <div className="text-sm text-surface-900">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : "—"}</div>
                  </div>
                  {profile?.wallet?.txns?.length > 0 && (
                    <div className="pt-2 border-t border-surface-100">
                      <div className="text-xs text-surface-500 mb-2">{ar() ? "آخر حركات المحفظة" : "Recent Wallet Txns"}</div>
                      <div className="space-y-1.5">
                        {profile.wallet.txns.slice(0, 4).map((t: any) => (
                          <div key={t.id} className="flex justify-between items-center text-xs">
                            <span className="text-surface-500 capitalize">{t.type?.replace(/_/g, ' ')}</span>
                            <span className={`font-bold ${t.amountKwd >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {t.amountKwd >= 0 ? '+' : ''}{Number(t.amountKwd).toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {/* Memberships */}
              <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                <h4 className="font-bold text-surface-900 mb-4 flex items-center justify-between pb-2 border-b border-surface-100">
                  {ar() ? "الاشتراكات والعروض" : "Memberships & Offers"}
                  <span className="badge-pink text-xs">{(profile?.memberships ?? []).length}</span>
                </h4>
                {!(profile?.memberships?.length) ? (
                  <div className="text-center text-sm text-surface-400 py-6">{ar() ? "لا توجد اشتراكات" : "No memberships"}</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {profile.memberships.map((m: any) => {
                      const sessionsLeft = m.maxSessions != null ? m.maxSessions - (m.sessionsUsed ?? 0) : null;
                      return (
                        <div key={m.id} className="bg-surface-50 p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                          <div className="text-sm font-bold text-surface-900">{m.offerName}</div>
                          <div className="text-xs text-surface-500 mt-1 mb-1">
                            {m.paymentAmountKwd != null ? `${Number(m.paymentAmountKwd).toFixed(3)} KWD` : "—"} • {m.purchaseMode || "—"}
                          </div>
                          <div className="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${
                              m.status === 'active' ? 'text-emerald-600 bg-emerald-50' :
                              m.status === 'pending_payment' ? 'text-amber-600 bg-amber-50' :
                              'text-surface-600 bg-surface-100'
                            }`}>
                              {m.purchaseMode === 'installments' ? `${m.installmentsPaid ?? 0}/${m.installmentCount ?? 0} Paid` : m.status}
                            </span>
                            {sessionsLeft !== null && (
                              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                                {sessionsLeft} {ar() ? "متبقية" : "left"}
                              </span>
                            )}
                          </div>
                          {m.purchaseMode === 'installments' && m.installmentCount > 0 && (
                            <div className="mt-1.5 flex gap-0.5">
                              {[...Array(m.installmentCount)].map((_: any, i: number) => (
                                <div key={i} className={`h-1 w-6 rounded-full ${i < (m.installmentsPaid ?? 0) ? 'bg-emerald-500' : 'bg-surface-200'}`} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sessions & Payments */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "الجلسات" : "Sessions"}</h4>
                  {!(profile?.sessions?.length) ? (
                    <div className="text-center text-sm text-surface-400 py-6">{ar() ? "لا توجد جلسات" : "No sessions yet"}</div>
                  ) : (
                    <div className="space-y-2">
                      {profile.sessions.slice(0, 6).map((s: any) => (
                        <div key={s.id} className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                          s.status === 'completed' ? 'border-emerald-100 bg-emerald-50' :
                          s.status === 'scheduled' ? 'border-blue-100 bg-blue-50' :
                          'border-surface-100 bg-surface-50'
                        }`}>
                          <span className="font-medium text-surface-700 capitalize">{s.status?.replace(/_/g, ' ')}</span>
                          <span className="text-surface-400">{s.requestedAt ? new Date(s.requestedAt).toLocaleDateString() : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المدفوعات الأخيرة" : "Recent Payments"}</h4>
                  {!(profile?.payments?.length) ? (
                    <div className="text-center text-sm text-surface-400 py-6">{ar() ? "لا توجد مدفوعات" : "No payments yet"}</div>
                  ) : (
                    <div className="space-y-2">
                      {profile.payments.slice(0, 6).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-surface-100 bg-white text-xs">
                          <div>
                            <div className="font-bold text-surface-900">{p.offerName}</div>
                            <div className="text-surface-400 capitalize">{p.method} • {p.status}</div>
                          </div>
                          <div className="font-black text-surface-900">{Number(p.amountKwd).toFixed(3)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="border-t border-surface-200 pt-6 flex gap-3 flex-wrap">
            <button className="btn-primary flex items-center gap-2 bg-purple-500 hover:bg-purple-600 border-none shadow-sm" onClick={() => setShowGrantModal(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {ar() ? "منح عرض / جلسة" : "Grant Offer / Session"}
            </button>
            <button className="btn-secondary text-red-500 hover:bg-red-50 hover:border-red-200 border-surface-200 flex items-center gap-2"
              onClick={handleFreeze} disabled={freezing}>
              {freezing ? "..." : selectedUser.isActive
                ? (ar() ? "تجميد الحساب" : "Freeze Account")
                : (ar() ? "إلغاء التجميد" : "Unfreeze Account")}
            </button>
          </div>

          {/* Grant Modal */}
          {showGrantModal && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
                <button className="absolute top-5 right-5 text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setShowGrantModal(false)}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h3 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
                  <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4M12 20V4" /></svg>
                  {ar() ? "منح عرض أو جلسة" : "Grant Offer / Session"}
                </h3>
                <p className="text-sm text-surface-500 -mt-3 mb-5">{getDisplayName(selectedUser)}</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "نوع المنحة" : "Grant Type"}</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={grantType === "session"} onChange={() => setGrantType("session")} className="text-purple-500 focus:ring-purple-400" />
                        <span className="text-sm font-medium">{ar() ? "جلسة مجانية" : "Free Session"}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={grantType === "offer"} onChange={() => setGrantType("offer")} className="text-purple-500 focus:ring-purple-400" />
                        <span className="text-sm font-medium">{ar() ? "باقة / عرض" : "Package / Offer"}</span>
                      </label>
                    </div>
                  </div>
                  {grantType === "session" ? (
                    <div>
                      <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "اختر الجلسة" : "Select Session"}</label>
                      <select className="select-field w-full" value={grantItem} onChange={e => setGrantItem(e.target.value)}>
                        <option value="">-- {ar() ? "اختر الجلسة" : "Select"} --</option>
                        {allTreatments.map(t => <option key={t.id} value={t.nameEn}>{ar() ? t.nameAr : t.nameEn}</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "اسم الباقة / العرض" : "Offer / Package Name"}</label>
                        <input type="text" className="input-field" placeholder={ar() ? "مثال: باقة الليزر الذهبية" : "e.g. Golden Laser Package"} value={grantItem} onChange={e => setGrantItem(e.target.value)} />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "عدد الجلسات" : "No. of Sessions"}</label>
                          <input type="number" className="input-field" placeholder="0" value={grantSessions} onChange={e => setGrantSessions(e.target.value)} />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "القيمة (اختياري)" : "Value (Optional)"}</label>
                          <input type="text" className="input-field" placeholder="0.000" value={grantAmount} onChange={e => setGrantAmount(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-8 flex gap-3">
                  <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors" onClick={() => setShowGrantModal(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
                  <button className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm" disabled={!grantItem}
                    onClick={() => {
                      setShowGrantModal(false);
                      setGrantItem(""); setGrantSessions(""); setGrantAmount("");
                    }}>
                    {ar() ? "منح وتأكيد" : "Grant & Confirm"}
                  </button>
                </div>
              </div>
            </div>, document.body
          )}
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{ar() ? "الاسم" : "Name"}</th>
                <th>{ar() ? "الرقم" : "Phone/Contact"}</th>
                <th>{ar() ? "الصلاحية" : "Role"}</th>
                <th>{ar() ? "الحالة" : "Status"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</td></tr>
              ) : filtered.map((u: any) => {
                const name = getDisplayName(u);
                const status = getStatus(u);
                return (
                  <tr key={u.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-pink-50 flex items-center justify-center text-xs font-bold text-brand-pink-600 flex-shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{name}</div>
                          {u.email && <div className="text-xs text-surface-400">{u.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{u.phone || "—"}</td>
                    <td><span className="badge-sage">Customer</span></td>
                    <td><span className={getStatusBadge(status)}>{status}</span></td>
                    <td className="text-right">
                      <button className="text-brand-pink-600 hover:text-brand-pink-800 font-medium text-sm px-4 py-1.5 bg-brand-pink-50 rounded-lg transition-colors hover:bg-brand-pink-100"
                        onClick={() => handleManage(u)}>
                        {ar() ? "إدارة" : "Manage"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!usersLoading && filtered.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">
                  <div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
                  <div className="empty-state-title">{ar() ? "لا يوجد عملاء" : "No customers found"}</div>
                  <div className="empty-state-sub">{ar() ? "جربي تعديل الفلاتر أو البحث." : "Try adjusting your filters or search."}</div>
                </div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CsSettings() {
  const { getAuthHeader } = useAuth();
  const { data: meData, loading: meLoading, refetch: refetchMe } = useApi<{ user: { fullName?: string; email?: string; phone?: string; username?: string } }>("/users/me");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", username: "", newPassword: "" });

  useEffect(() => {
    const u = meData?.user;
    if (u) {
      setForm(f => ({
        ...f,
        fullName: u.fullName || "",
        email: u.email || "",
        phone: u.phone || "",
        username: u.username || "",
      }));
    }
  }, [meData]);

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        username: form.username,
      };
      if (form.newPassword.trim()) body.newPassword = form.newPassword.trim();
      await apiFetch("/users/me", { method: "PATCH", headers: getAuthHeader(), body: JSON.stringify(body) });
      setForm(f => ({ ...f, newPassword: "" }));
      setSaveMsg({ type: "ok", text: ar() ? "تم حفظ الملف الشخصي" : "Profile saved successfully" });
      refetchMe();
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e.message || (ar() ? "فشل الحفظ" : "Save failed") });
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.fullName || form.username || "CS").charAt(0).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h4 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {ar() ? "الملف الشخصي للموظف" : "Agent Profile"}
          </h4>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${saveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {saveMsg.text}
              </span>
            )}
            <button onClick={saveProfile} disabled={saving || meLoading} className="btn-primary btn-sm">
              {saving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التغييرات" : "Save Changes")}
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm">
              {initials}
            </div>
            <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Customer Service</div>
          </div>
          <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
              <input type="text" className="input-field bg-white" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder={meLoading ? (ar() ? "جاري التحميل..." : "Loading...") : ""} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
              <input type="email" className="input-field bg-white" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
              <input type="text" className="input-field bg-white" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور الجديدة" : "New Password"}</label>
              <input type="password" className="input-field bg-white" placeholder={ar() ? "اتركه فارغاً للإبقاء على الحالي" : "Leave blank to keep current"} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {ar() ? "إعدادات عامة" : "General Configuration"}
          </h4>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
              <select className="select-field"><option>English (EN)</option><option>Arabic (AR)</option></select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "تلقي إشعارات الحجوزات" : "Receive Booking Alerts"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            {ar() ? "الأمان والوصول" : "Security & Access"}
          </h4>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "صلاحية الجلسة (ساعات)" : "Session Timeout (Hours)"}</label>
              <input type="number" className="input-field" defaultValue={24} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية (2FA)" : "Enable 2FA Authentication"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClinicChangeRequestsQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useClinicChangeRequestsCs();
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);

  const clinicLabel = (r: any, dir: "from" | "to") => {
    if (dir === "from") return ar() ? (r.fromClinicNameAr || r.fromClinicNameEn || r.fromClinicId) : (r.fromClinicNameEn || r.fromClinicNameAr || r.fromClinicId);
    return ar() ? (r.toClinicNameAr || r.toClinicNameEn || r.toClinicId) : (r.toClinicNameEn || r.toClinicNameAr || r.toClinicId);
  };

  const approveChange = async (id: string) => {
    setProcessing(id);
    try {
      await apiFetch(`/commerce/cs/clinic-change-requests/${id}/approve`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      invalidateCache("/commerce/cs/clinic-change-requests");
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const rejectChange = async (id: string, reason?: string) => {
    setProcessing(id);
    try {
      await apiFetch(`/commerce/cs/clinic-change-requests/${id}/reject`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ reason: reason || undefined }),
      });
      invalidateCache("/commerce/cs/clinic-change-requests");
      refetch();
      setRejectModal(null);
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const items = data?.items || [];
  const pending = items.filter(r => r.status === "pending");

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "طلبات تغيير العيادة" : "Clinic Change Requests"}</h3>
        <div className="flex items-center gap-2">
          <span className="badge-pink">{pending.length} {ar() ? "معلق" : "pending"}</span>
          <button className="btn-ghost btn-sm" onClick={refetch}>↻</button>
        </div>
      </div>

      {loading ? <div className="shimmer h-32 rounded-xl" /> : pending.length === 0 ? (
        <div className="text-center text-sm text-surface-400 py-8">✅ {ar() ? "لا توجد طلبات تغيير عيادة" : "No pending clinic change requests"}</div>
      ) : pending.map(r => (
        <div key={r.id} className="py-4 border-b border-surface-100 last:border-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
              {(r.userName || r.userId)?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-bold text-surface-900">{r.userName || r.userId}</span>
                {r.userPhone && <span className="text-xs text-surface-400">{r.userPhone}</span>}
              </div>
              {r.offerName && <div className="text-xs text-surface-500 mb-1">{ar() && r.offerNameAr ? r.offerNameAr : r.offerName}</div>}
              <div className="flex items-center gap-1.5 text-xs text-surface-700 font-medium">
                <span className="bg-surface-100 px-2 py-0.5 rounded-lg">{clinicLabel(r, "from")}</span>
                <span className="text-surface-400">→</span>
                <span className="bg-brand-pink-50 text-brand-pink-700 px-2 py-0.5 rounded-lg">{clinicLabel(r, "to")}</span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  {ar() ? `الطلب ${r.changeNumber}` : `Request #${r.changeNumber}`}
                </span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  {r.feeKwd} KWD
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                className="btn-primary btn-sm px-3 bg-emerald-500 hover:bg-emerald-600 border-none text-xs"
                disabled={processing === r.id}
                onClick={() => approveChange(r.id)}
              >
                {processing === r.id ? "..." : ar() ? "موافقة" : "Approve"}
              </button>
              <button
                className="btn-sm bg-red-50 text-red-500 hover:bg-red-100 rounded-lg px-3 py-1 text-xs font-medium"
                disabled={processing === r.id}
                onClick={() => setRejectModal({ id: r.id, reason: "" })}
              >
                {ar() ? "رفض" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Reject reason modal */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-surface-900 mb-3">{ar() ? "سبب الرفض" : "Rejection Reason"}</h3>
            <textarea
              className="input-field w-full h-24 text-sm resize-none mb-4"
              placeholder={ar() ? "اختياري..." : "Optional..."}
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => m ? { ...m, reason: e.target.value } : null)}
            />
            <div className="flex gap-3">
              <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-2.5 rounded-xl text-sm" onClick={() => setRejectModal(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
              <button className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm" disabled={processing === rejectModal.id} onClick={() => rejectChange(rejectModal.id, rejectModal.reason)}>{ar() ? "تأكيد الرفض" : "Confirm Reject"}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

export default function CsDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue();
  const { data: paymentsData } = usePendingPayments();
  const { data: complaintsData } = useComplaints();
  const { data: bookingRequestsData } = useBookingRequests("pending");

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "kyc", icon: Icons.shield, label: t("kyc") },
    { key: "payments", icon: Icons.cash, label: t("payments") },
    { key: "customers", icon: Icons.users, label: ar() ? "العملاء" : "Customers" },
    { key: "memberships", icon: Icons.offers, label: ar() ? "الاشتراكات" : "Memberships" },
    { key: "clinic_changes", icon: Icons.clinic, label: ar() ? "تغيير العيادة" : "Clinic Changes" },
    { key: "scheduling", icon: Icons.calendar, label: t("schedule") },
    { key: "chat", icon: Icons.clipboard, label: ar() ? "محادثات الحجوزات" : "Booking Chat" },
    { key: "lookup", icon: Icons.search, label: ar() ? "بحث العملاء" : "Customer Lookup" },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "profile", icon: Icons.profile, label: ar() ? "الملف الشخصي" : "Profile & Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "خدمة العملاء" : "Customer Service"} subtitle={ar() ? "إدارة التحققات والمدفوعات" : "Manage verifications, payments & bookings"}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            {/* ── KPI Summary Row ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="kpi-tile group" onClick={() => setActiveNav("kyc")}>
                <div className="kpi-tile-icon amber">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                </div>
                <div className="kpi-tile-label">{ar() ? "تحققات معلقة" : "Pending KYC"}</div>
                <div className="kpi-tile-value">{(kycData?.items || []).length}</div>
                <div className="kpi-tile-sub"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{ar() ? "تتطلب مراجعة" : "needs review"}</div>
              </div>
              <div className="kpi-tile group" onClick={() => setActiveNav("payments")}>
                <div className="kpi-tile-icon pink">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div className="kpi-tile-label">{ar() ? "مدفوعات معلقة" : "Pending Payments"}</div>
                <div className="kpi-tile-value">{(paymentsData?.items || []).length}</div>
                <div className="kpi-tile-sub"><span className="w-1.5 h-1.5 rounded-full bg-brand-pink-500" />{ar() ? "بانتظار المراجعة" : "awaiting confirm"}</div>
              </div>
              <div className="kpi-tile group" onClick={() => setActiveNav("scheduling")}>
                <div className="kpi-tile-icon blue">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div className="kpi-tile-label">{ar() ? "طلبات حجز" : "Booking Requests"}</div>
                <div className="kpi-tile-value">{(bookingRequestsData?.items || []).length}</div>
                <div className="kpi-tile-sub"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{ar() ? "تنتظر الجدولة" : "to schedule"}</div>
              </div>
              <div className="kpi-tile group" onClick={() => setActiveNav("complaints")}>
                <div className="kpi-tile-icon rose">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 13a3 3 0 11-6 0 3 3 0 016 0zM2 18.5a8.5 8.5 0 0117 0M12 6a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="kpi-tile-label">{ar() ? "إجمالي الشكاوى" : "Total Complaints"}</div>
                <div className="kpi-tile-value">{complaintsData?.total || 0}</div>
                <div className="kpi-tile-sub"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{ar() ? "خلال الفترة" : "in period"}</div>
              </div>
            </div>

            {/* ── Action Queues ── */}
            <div className="grid gap-6 lg:grid-cols-3">
              <KycQueue />
              <PaymentQueue />
              <BookingRequestsQueue />
            </div>

            {/* ── Customer Memberships (Full Width) ── */}
            <CustomerMemberships />

            {/* ── Referral Activity ── */}
            <ReferralActivityWidget />
          </>
        )}
        {activeNav === "kyc" && <KycQueue />}
        {activeNav === "payments" && <PaymentQueue />}
        {activeNav === "memberships" && <CustomerMemberships />}
        {activeNav === "customers" && <CustomersManager />}
        {activeNav === "clinic_changes" && <ClinicChangeRequestsQueue />}
        {activeNav === "scheduling" && (
           <div className="space-y-6">
              <BookingRequestsQueue />
              <SchedulingTool />
           </div>
        )}
        {activeNav === "chat" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "محادثات الحجوزات" : "Booking Conversations"}</h2>
              <p className="text-sm text-surface-500 mt-1">
                {ar() ? "تواصل مع العملاء والعيادات وقم بإدارة طلبات الحجز." : "Coordinate with customers and clinics to manage booking requests."}
              </p>
            </div>
            <ChatWidget showBookingActions />
          </div>
        )}
        {activeNav === "lookup" && <CustomerLookup />}
        {activeNav === "complaints" && (
          <div className="card-elevated overflow-hidden">
            <div className="p-5"><h3 className="text-base font-bold text-surface-900">{ar() ? "الشكاوى" : "Complaints"}</h3></div>
            <table className="data-table">
              <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
              <tbody>
                {(complaintsData?.items || []).map((c: any) => (
                  <tr key={c.id}><td className="font-medium">{c.subject}</td><td><span className="badge-sage">{c.category}</span></td><td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{c.status}</span></td><td className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</td></tr>
                ))}
                {(complaintsData?.items || []).length === 0 && <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div className="empty-state-title">{ar() ? "لا شكاوى" : "No complaints"}</div><div className="empty-state-sub">{ar() ? "لم يتم تسجيل شكاوى ضمن هذه الفترة." : "No complaints logged in this period."}</div></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {activeNav === "profile" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "الملف الشخصي والإعدادات" : "Profile & Settings"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "إدارة حسابك ورابط الإحالة في مكان واحد." : "Manage your account and referral link in one place."}</p>
            </div>
            <CsSettings />
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
