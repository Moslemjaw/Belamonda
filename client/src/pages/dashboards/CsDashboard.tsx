import { useState, useEffect } from "react";
import { fmtDate } from "../../lib/dateFormat";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useKycQueue, usePendingPayments, useComplaints, useApi, useBookingRequests, useClinicChangeRequestsCs, invalidateCache, useAdminUserOffers } from "../../hooks/useApi";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import i18n from "../../app/i18n";
import { addFinancialEntry, upsertSubscription, getSubscriptions, getFinancialLedger } from "../../lib/offerSystem";
import { sharedClinics } from "../../lib/clinics";
import { clinics as treatmentClinics, allTreatments, treatmentCategories } from "../../lib/treatments";
import { getCategoryIcon } from "../../components/CategoryIcons";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReferralActivityWidget, ReferralLeaderboardWidget } from "../../components/ReferralActivityWidget";
import { EFormsAdminPanel } from "../../features/admin/EFormsAdminPanel";
import { UserProfilePanel } from "./AdminDashboard";

const ar = () => i18n.language === "ar";

export function KycQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useKycQueue();
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewingKyc, setViewingKyc] = useState<any>(null);
  const [kycExpiryDate, setKycExpiryDate] = useState("");

  const reviewKyc = async (submissionId: string, decision: "approve" | "reject") => {
    setProcessing(submissionId);
    try {
      if (decision === "approve") {
        await apiFetch(`/kyc/cs/${submissionId}/approve`, { 
          method: "POST", 
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(kycExpiryDate ? { expiryDate: kycExpiryDate } : {})
        });
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
          <button className="icon-btn" onClick={() => refetch()} aria-label={ar() ? "تحديث القائمة" : "Refresh queue"} title={ar() ? "تحديث" : "Refresh"}>
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
                <div className="avatar avatar-md" aria-hidden="true">{(k.userName || k.userId)?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold text-surface-900 truncate">{k.userName || k.userId}</div>
                    <span className="text-[10px] font-bold text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded" title={new Date(k.createdAt).toLocaleString()}>{fmtAge(k.createdAt)}</span>
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                    <span className="font-mono">{k.civilIdNumberMasked || k.civilIdNumber || "—"}</span>
                    {k.userPhone && (
                      <>
                        <span>·</span>
                        <span className="font-mono">{k.userPhone}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="icon-btn"
                    onClick={() => setViewingKyc(k)}
                    aria-label={ar() ? `عرض وثائق ${k.userId}` : `View documents for ${k.userId}`}
                    title={ar() ? "عرض الوثائق" : "View Documents"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
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

      {viewingKyc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-100 shrink-0">
              <h3 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                {ar() ? "وثائق الهوية" : "Identity Documents"} - {viewingKyc.userName || viewingKyc.userId}
              </h3>
              <button className="text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setViewingKyc(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-100">
                  <h4 className="text-sm font-bold text-surface-700 mb-3 text-center">{ar() ? "البطاقة المدنية (الجهة الأمامية)" : "Civil ID (Front)"}</h4>
                  <img src={viewingKyc.civilIdFrontRef?.startsWith('http') || viewingKyc.civilIdFrontRef?.startsWith('data:') ? viewingKyc.civilIdFrontRef : `/uploads/${viewingKyc.civilIdFrontRef}`} alt="Civil ID Front" className="w-full h-auto rounded-lg shadow-sm" />
                </div>
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-100">
                  <h4 className="text-sm font-bold text-surface-700 mb-3 text-center">{ar() ? "البطاقة المدنية (الجهة الخلفية)" : "Civil ID (Back)"}</h4>
                  <img src={viewingKyc.civilIdBackRef?.startsWith('http') || viewingKyc.civilIdBackRef?.startsWith('data:') ? viewingKyc.civilIdBackRef : `/uploads/${viewingKyc.civilIdBackRef}`} alt="Civil ID Back" className="w-full h-auto rounded-lg shadow-sm" />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1">{ar() ? "تاريخ انتهاء البطاقة (اختياري)" : "Expiry Date (Optional)"}</label>
                <input 
                  type="date" 
                  className="input-field max-w-[200px]" 
                  value={kycExpiryDate}
                  onChange={e => setKycExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-surface-100 shrink-0 flex gap-3">
              <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm" onClick={() => { setViewingKyc(null); setKycExpiryDate(""); }}>{ar() ? "إغلاق" : "Close"}</button>
              <button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
                disabled={processing === viewingKyc.id}
                onClick={() => { reviewKyc(viewingKyc.id, "approve"); setViewingKyc(null); setKycExpiryDate(""); }}
              >
                {processing === viewingKyc.id ? "..." : ar() ? "قبول وتوثيق" : "Approve & Verify"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}



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

function PaymentsManager() {
  const { data, loading } = useAdminUserOffers();
  const [filterUser, setFilterUser] = useState("");
  const [tab, setTab] = useState<"pending" | "overdue" | "upcoming" | "deposits">("pending");

  const items = data?.items || [];
  
  const overdueItems = items.filter((uo: any) => {
    if (uo.status !== "active" || uo.purchaseMode !== "installments") return false;
    if (!uo.nextInstallmentDueAt) return false;
    return new Date(uo.nextInstallmentDueAt).getTime() < Date.now();
  });

  const activeInstallments = items.filter((uo: any) => {
    if (uo.status !== "active" || uo.purchaseMode !== "installments") return false;
    if (!uo.nextInstallmentDueAt) return false;
    return new Date(uo.nextInstallmentDueAt).getTime() >= Date.now();
  });

  const depositItems = items.filter((uo: any) => uo.purchaseMode === "deposit" && (uo.status === "reserved" || uo.status === "pending_payment"));

  const filterFn = (uo: any) => {
    if (!filterUser) return true;
    const s = filterUser.toLowerCase();
    return (uo.userName?.toLowerCase() || "").includes(s) || (uo.offerName?.toLowerCase() || "").includes(s) || (uo.userPhone || "").includes(s);
  };

  if (loading) return <div className="card-elevated p-5"><div className="shimmer h-64 rounded-2xl" /></div>;

  const tabs = [
    { id: "pending", label: ar() ? "معلقة للاعتماد" : "Pending Verifications", count: undefined },
    { id: "overdue", label: ar() ? "متأخرة" : "Overdue", count: overdueItems.filter(filterFn).length },
    { id: "upcoming", label: ar() ? "قادمة" : "Upcoming", count: activeInstallments.filter(filterFn).length },
    { id: "deposits", label: ar() ? "عربونات" : "Deposits", count: depositItems.filter(filterFn).length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{ar() ? "المدفوعات والمستحقات" : "Payments & Ledgers"}</h2>
          <p className="text-sm text-surface-500 mt-1">{ar() ? "تتبع المدفوعات المعلقة، المتأخرات، والعربونات." : "Track pending payments, overdue installments, and deposits."}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={ar() ? "بحث باسم العميل أو الباقة..." : "Search customer or package..."}
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="input-field py-2.5 pl-10 w-full bg-white shadow-sm border-surface-200"
          />
        </div>
      </div>

      <div className="flex border-b border-surface-200 overflow-x-auto hide-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`whitespace-nowrap py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${tab === t.id ? 'border-brand-pink-500 text-brand-pink-600' : 'border-transparent text-surface-500 hover:text-surface-900 hover:border-surface-300'}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${tab === t.id ? 'bg-brand-pink-100 text-brand-pink-700' : 'bg-surface-100 text-surface-600'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "pending" && <PaymentQueue />}

        {tab === "overdue" && overdueItems.filter(filterFn).length > 0 && (
        <div className="card-elevated border border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50/50 p-5 border-b border-red-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-red-900">{ar() ? "دفعات متأخرة" : "Overdue Installments"}</h3>
                <div className="text-sm text-red-700">{overdueItems.filter(filterFn).length} {ar() ? "عميل متأخر عن السداد" : "customers behind on payments"}</div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            {overdueItems.filter(filterFn).map((uo: any) => {
              const overdueDays = Math.floor((Date.now() - new Date(uo.nextInstallmentDueAt).getTime()) / (1000 * 60 * 60 * 24));
              const firstUnpaid = (uo.installmentSchedule || []).find((s: any) => !s.paid);
              return (
                <div key={uo.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between hover:bg-surface-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="avatar avatar-md bg-surface-200 text-surface-600 font-bold">{uo.userName?.charAt(0)?.toUpperCase() || "U"}</div>
                    <div>
                      <div className="font-bold text-surface-900">{uo.userName || uo.userId}</div>
                      <div className="text-sm text-surface-500 mt-0.5">{uo.userPhone || "—"} • {ar() && uo.offerNameAr ? uo.offerNameAr : (uo.offerName || uo.offerId)}</div>
                      <div className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg inline-flex items-center gap-1 mt-2 border border-red-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {ar() ? `متأخر ${overdueDays} يوم` : `${overdueDays} days overdue`} ({fmtDate(uo.nextInstallmentDueAt)})
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1 pl-14 sm:pl-0">
                    <div className="text-sm text-surface-500">{ar() ? "المبلغ المستحق:" : "Amount Due:"}</div>
                    <div className="text-xl font-black text-surface-900">{Number(firstUnpaid?.amountKwd || 0).toFixed(3)} KWD</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "upcoming" && (
        <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex justify-between items-center">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            {ar() ? "الأقساط القادمة" : "Upcoming Installments"}
          </h3>
        </div>
        {activeInstallments.filter(filterFn).length === 0 ? (
           <div className="p-8 text-center text-sm text-surface-500">{ar() ? "لا توجد أقساط قادمة" : "No upcoming installments"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-surface-50 text-xs uppercase text-surface-500 font-bold">
                <tr>
                  <th className="px-6 py-3">{ar() ? "العميل" : "Customer"}</th>
                  <th className="px-6 py-3">{ar() ? "الباقة" : "Package"}</th>
                  <th className="px-6 py-3">{ar() ? "القسط القادم" : "Next Due Date"}</th>
                  <th className="px-6 py-3 text-right">{ar() ? "المبلغ المستحق" : "Amount Due"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {activeInstallments.filter(filterFn).map((uo: any) => {
                  const firstUnpaid = (uo.installmentSchedule || []).find((s: any) => !s.paid);
                  return (
                    <tr key={uo.id} className="hover:bg-surface-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-surface-900">{uo.userName || uo.userId}</div>
                        <div className="text-xs text-surface-500">{uo.userPhone || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-surface-900">{ar() && uo.offerNameAr ? uo.offerNameAr : (uo.offerName || uo.offerId)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg border border-blue-100 text-xs">
                          {fmtDate(uo.nextInstallmentDueAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-surface-900">
                        {Number(firstUnpaid?.amountKwd || 0).toFixed(3)} KWD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {tab === "deposits" && depositItems.filter(filterFn).length > 0 && (
        <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-surface-100 flex justify-between items-center">
            <h3 className="font-bold text-surface-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              {ar() ? "العربونات المحجوزة" : "Reserved Deposits"}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-surface-50 text-xs uppercase text-surface-500 font-bold">
                <tr>
                  <th className="px-6 py-3">{ar() ? "العميل" : "Customer"}</th>
                  <th className="px-6 py-3">{ar() ? "الباقة" : "Package"}</th>
                  <th className="px-6 py-3">{ar() ? "انتهاء الحجز" : "Reservation Expiry"}</th>
                  <th className="px-6 py-3">{ar() ? "الحالة" : "Status"}</th>
                  <th className="px-6 py-3 text-right">{ar() ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {depositItems.filter(filterFn).map((uo: any) => {
                  const isExpired = uo.reservationExpiresAt && new Date(uo.reservationExpiresAt).getTime() < Date.now();
                  return (
                    <tr key={uo.id} className={`hover:bg-surface-50 ${isExpired ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-surface-900">{uo.userName || uo.userId}</div>
                        <div className="text-xs text-surface-500">{uo.userPhone || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-surface-900">{ar() && uo.offerNameAr ? uo.offerNameAr : (uo.offerName || uo.offerId)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {uo.reservationExpiresAt ? (
                          <span className={`font-semibold px-2.5 py-1 rounded-lg border text-xs ${isExpired ? 'bg-red-50 text-red-700 border-red-100' : 'bg-surface-100 text-surface-700 border-surface-200'}`}>
                            {new Date(uo.reservationExpiresAt).toLocaleString()}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase ${uo.status === 'reserved' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                           {uo.status}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-surface-900">
                        {Number(uo.depositAmountKwd || 0).toFixed(3)} KWD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      </div>
      </div>
    </div>
  );
}

export function BookingRequestsQueue({ onTransfer }: { onTransfer?: (id: string, clinicId: string) => void }) {
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
    <div className="card-elevated p-5 relative flex flex-col max-h-[600px]">
      <div className="editorial-header justify-between mb-4 shrink-0">
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
        <div key={b.id} className="flex items-center gap-4 py-3 border-b border-surface-100 last:border-0">
          <div className="avatar avatar-sm bg-blue-100 text-blue-700">{(b.customerName || b.userId)?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-surface-800">{b.customerName || b.userId}</div>
            <div className="text-xs text-surface-400">{b.offerName || (b.isStandalone ? b.standaloneName : null) || b.userOfferId?.slice(0, 25)}</div>
            <div className="mt-1 flex gap-1.5 flex-wrap">
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
          <div className="text-xs text-surface-400 mr-2">{new Date(b.createdAt).toLocaleTimeString()}</div>
          <div className="flex items-center gap-2">
            <button className="text-[11px] font-bold text-brand-pink-600 bg-brand-pink-50 border border-brand-pink-200 hover:bg-brand-pink-100 px-3 py-1.5 rounded-xl transition-colors" onClick={() => onTransfer && onTransfer(b.id, b.clinicId || "")}>
              {ar() ? "تغيير العيادة" : "Change Clinic"}
            </button>
            <button className="bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium px-3 py-1.5 rounded-xl text-xs transition-colors" onClick={() => setSelectedBooking(b)}>
              {ar() ? "عرض التفاصيل" : "View Details"}
            </button>
          </div>
        </div>
      ))}

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
                        <div className="text-xs text-surface-400">{new Date(selectedBooking.createdAt).toLocaleString()}</div>
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
                        <span className="font-bold text-surface-900">{selectedBooking.preferredAt ? new Date(selectedBooking.preferredAt).toLocaleString() : (ar() ? "غير محدد" : "—")}</span>
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
                       <input 
                         type="datetime-local" 
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
                  disabled={!scheduleForm.scheduledAt || processing === selectedBooking.id}
                  onClick={() => schedule(selectedBooking.id)}
                >
                  {processing === selectedBooking.id ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {ar() ? "تأكيد الموعد وإرسال للعيادة" : "Confirm Schedule & Notify Clinic"}
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


function CustomerMemberships({ onTransfer }: { onTransfer?: (id: string, clinicId: string) => void }) {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useApi<{ items: any[] }>("/commerce/admin/user-offers");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending_payment" | "cancelled" | "expired">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [sessionDateModal, setSessionDateModal] = useState<{ id: string } | null>(null);
  const [sessionDateValue, setSessionDateValue] = useState(new Date().toISOString().split("T")[0]);

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
    if (delta > 0) {
      setSessionDateModal({ id });
      setSessionDateValue(new Date().toISOString().split("T")[0]);
      return;
    }

    setAdjustingId(id + "_dec");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${id}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, date: null }),
      });
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to adjust sessions");
    } finally {
      setAdjustingId(null);
    }
  };

  const submitSessionDate = async () => {
    if (!sessionDateModal) return;
    const id = sessionDateModal.id;
    setSessionDateModal(null);
    setAdjustingId(id + "_inc");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${id}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta: 1, date: sessionDateValue }),
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
          <button className="btn-ghost btn-sm" onClick={() => refetch()}>↻</button>
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
                      <div className="text-sm font-bold text-surface-900">{o.offerName ? Array.from(new Set(o.offerName.split(" - "))).join(" - ") : (ar() ? "عرض" : "Offer")}</div>
                      <div className="text-xs text-surface-400 mt-0.5 font-mono">{o.userName || o.userId}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="text-xs font-medium text-surface-500 hover:text-surface-700 bg-surface-50 hover:bg-surface-100 px-2.5 py-1.5 rounded-lg transition-colors border border-surface-200" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        {isExpanded ? "▲" : "▼"}
                      </button>
                      {canCancel && !isConfirming && (
                        <>
                          <button 
                            className="text-[11px] font-bold text-brand-pink-600 bg-brand-pink-50 border border-brand-pink-200 hover:bg-brand-pink-100 px-2.5 py-1 rounded-lg transition-colors" 
                            onClick={() => onTransfer && onTransfer(o.id, o.clinicId || "")}
                          >
                            {ar() ? "تغيير العيادة" : "Change Clinic"}
                          </button>
                          <button className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors font-medium" onClick={() => setConfirmId(o.id)}>{ar() ? "إلغاء" : "Cancel"}</button>
                        </>
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
                    {o.installmentSchedule?.length > 0 && (
                      <div className="text-xs">
                        <span className="text-surface-400">{ar() ? "المتبقي:" : "Unpaid:"}</span>{' '}
                        <span className="font-bold text-red-600">
                          {Math.max(0, (parseFloat(o.paymentAmountKwd || '0') - o.installmentSchedule.filter((i: any) => i.paid).reduce((sum: number, i: any) => sum + parseFloat(i.amountKwd || '0'), 0))).toFixed(3)} KWD
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-surface-400">{ar() ? "الجلسات:" : "Sessions:"}</span>
                      <span className="font-bold text-surface-700">{o.sessionsUsed || 0}{o.maxSessions ? ` / ${o.maxSessions}` : ' / ∞'}</span>
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
                      {o.activatedAt && <div><span className="text-surface-400 block">{ar() ? "تم التفعيل" : "Activated"}</span><span className="font-bold text-surface-700">{fmtDate(o.activatedAt)}</span></div>}
                      {o.expiresAt && <div><span className="text-surface-400 block">{ar() ? "ينتهي" : "Expires"}</span><span className="font-bold text-surface-700">{fmtDate(o.expiresAt)}</span></div>}
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

      {sessionDateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative">
            <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "تاريخ الجلسة" : "Session Date"}</h3>
            <p className="text-sm text-surface-500 mb-4">{ar() ? "الرجاء إدخال تاريخ الجلسة" : "Please enter the session date"}</p>
            <input
              type="date"
              className="input-field w-full mb-4"
              value={sessionDateValue}
              onChange={(e) => setSessionDateValue(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                onClick={() => setSessionDateModal(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all"
                onClick={submitSessionDate}
                disabled={!sessionDateValue}
              >
                {ar() ? "تأكيد" : "Confirm"}
              </button>
            </div>
          </div>
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

function CustomersManager() {
  const { getAuthHeader, impersonateUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Add Customer Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  
  type CustomInstallment = { dueDate: string; amountKwd: string; isPaid: boolean; method: string; };
  type EnrollmentRow = { 
    offerId: string; 
    clinicId: string; 
    purchaseMode: string; 
    amountPaidKwd: string; 
    method: string; 
    isVerified: boolean; 
    installmentCount: number;
    customInstallments?: CustomInstallment[];
  };
  
  const emptyRow: EnrollmentRow = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "cash", isVerified: true, installmentCount: 2 };
  
  const [addForm, setAddForm] = useState({
    phone: "", fullName: "", email: "", password: "",
    enrollments: [{ ...emptyRow }] as EnrollmentRow[],
  });
  const [addingUser, setAddingUser] = useState(false);

  // Dynamic public data
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const { data: offersData } = useApi<{ items: any[] }>("/offers/admin");
  const { data: plansData } = useApi<any[]>("/subscriptions/plans");

  const generateInstallments = (count: number, offerId: string): CustomInstallment[] => {
    const offer = offersData?.items?.find((o: any) => o.id === offerId || o._id === offerId);
    const total = offer ? parseFloat(offer.subscriptionPriceKwd || "0") : 0;
    const baseEach = Math.floor((total * 1000) / count) / 1000;
    const remainder = total - (baseEach * count);
    
    const arr: CustomInstallment[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + (i * 30));
      const amt = baseEach + (i === 0 ? remainder : 0);
      arr.push({
        dueDate: d.toISOString().split("T")[0],
        amountKwd: amt.toFixed(3),
        isPaid: i === 0,
        method: "cash"
      });
    }
    return arr;
  };

  const updateEnrollment = (idx: number, patch: Partial<EnrollmentRow>) => {
    setAddForm(p => {
      const newList = [...p.enrollments];
      const current = newList[idx];
      
      // Auto-generate installments if mode switched to installments or count changes
      if (patch.purchaseMode === "installments" || (patch.installmentCount && current.purchaseMode === "installments")) {
        const count = patch.installmentCount || current.installmentCount || 2;
        patch.customInstallments = generateInstallments(count, patch.offerId || current.offerId);
      }
      
      newList[idx] = { ...current, ...patch };
      return { ...p, enrollments: newList };
    });
  };
  const addEnrollmentRow = () => {
    setAddForm(p => ({ ...p, enrollments: [...p.enrollments, { ...emptyRow }] }));
  };
  const removeEnrollmentRow = (idx: number) => {
    setAddForm(p => ({ ...p, enrollments: p.enrollments.filter((_, i) => i !== idx) }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const body: any = {
        phone: addForm.phone, fullName: addForm.fullName, email: addForm.email, password: addForm.password,
        enrollments: addForm.enrollments.filter(en => en.offerId),
      };
      await apiFetch("/users/admin/manual-enroll", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowAddModal(false);
      loadUsers();
      setAddForm({ phone: "", fullName: "", email: "", password: "", enrollments: [{ ...emptyRow }] });
    } catch (err: any) {
      alert(ar() ? "حدث خطأ: " + err.message : "An error occurred: " + err.message);
    } finally {
      setAddingUser(false);
    }
  };

  // Grant modal states
  const defaultGrantEnrollment = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "bank_transfer", isVerified: true, installmentCount: 2, customInstallments: [] };
  const [grantEnrollments, setGrantEnrollments] = useState<any[]>([{ ...defaultGrantEnrollment }]);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState(false);

  const addGrantEnrollmentRow = () => setGrantEnrollments(p => [...p, { ...defaultGrantEnrollment }]);
  const removeGrantEnrollmentRow = (idx: number) => setGrantEnrollments(p => p.filter((_, i) => i !== idx));
  const updateGrantEnrollment = (idx: number, updates: any) => setGrantEnrollments(p => p.map((x, i) => {
    if (i !== idx) return x;
    const next = { ...x, ...updates };
    if (updates.purchaseMode === "installments" || (updates.installmentCount && next.purchaseMode === "installments")) {
      const count = next.installmentCount || 2;
      const arr = [];
      const now = new Date();
      for (let j = 0; j < count; j++) {
        const d = new Date(now.getTime() + j * 30 * 24 * 60 * 60 * 1000);
        arr.push({ dueDate: d.toISOString().split("T")[0], amountKwd: "", isPaid: false, method: "cash" });
      }
      next.customInstallments = arr;
    }
    return next;
  }));

  const handleGrantMembership = async () => {
    if (grantEnrollments.some(e => !e.offerId)) { setGrantError(ar() ? "الرجاء اختيار العرض" : "Select an offer for all rows"); return; }
    setGrantSaving(true);
    setGrantError(null);
    setGrantSuccess(false);
    try {
      await apiFetch("/users/admin/manual-enroll", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ 
          phone: selectedUser.phone || selectedUser.username || `phone_${selectedUser.id}`, 
          fullName: selectedUser.fullName || "Customer", 
          email: selectedUser.email,
          enrollments: grantEnrollments 
        }),
      });
      setGrantSuccess(true);
      setGrantEnrollments([{ ...defaultGrantEnrollment }]);
      await refetchProfile();
    } catch (e: any) {
      setGrantError(e.message);
    } finally {
      setGrantSaving(false);
    }
  };

  // Clinic Transfer modal states
  const [clinicChangeModal, setClinicChangeModal] = useState<{ type: "membership" | "session" | "request"; id: string; currentClinicId: string; defaultFee: string } | null>(null);
  const [newClinicId, setNewClinicId] = useState("");
  const [isPaidTransfer, setIsPaidTransfer] = useState(false);
  const [transferFee, setTransferFee] = useState("10.000");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [freezing, setFreezing] = useState(false);
  const [cashAmt, setCashAmt] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);
  const [sessionAdjustingId, setSessionAdjustingId] = useState<string | null>(null);
  const [sessionDateModal, setSessionDateModal] = useState<{ membershipId: string } | null>(null);
  const [sessionDateValue, setSessionDateValue] = useState(new Date().toISOString().split("T")[0]);

  const refetchProfile = async () => {
    if (!selectedUser) return;
    try {
      const data: any = await apiFetch(`/users/admin/${selectedUser.id}/profile`, { headers: getAuthHeader() });
      setProfile(data);
    } catch (err) {
      console.error("Refetch profile error:", err);
    }
  };

  const handleCashbackAdjust = async (sign: 1 | -1) => {
    if (!selectedUser) return;
    const amt = parseFloat(cashAmt);
    if (!amt || amt <= 0) { setCashError(ar() ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    if (!cashReason.trim()) { setCashError(ar() ? "السبب مطلوب" : "Reason is required"); return; }
    setCashSaving(true);
    setCashError(null);
    try {
      const kwd = `${Math.floor(amt)}.${String(Math.round((amt % 1) * 1000)).padStart(3, "0")}`;
      const signedKwd = sign === -1 ? `-${kwd}` : kwd;
      await apiFetch("/wallet/admin/adjust", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ userId: selectedUser.id, amountKwd: signedKwd, reason: cashReason })
      });
      setCashAmt("");
      setCashReason("");
      await refetchProfile();
    } catch (e: any) {
      setCashError(e.message);
    } finally {
      setCashSaving(false);
    }
  };

  const [belmondoSaving, setBelmondoSaving] = useState(false);
  const [belmondoPlanId, setBelmondoPlanId] = useState<string>("");
  const [belmondoPaymentMethod, setBelmondoPaymentMethod] = useState<string>("pos");

  const handleUpdateSubscription = async (downgrade = false) => {
    if (!selectedUser) return;
    setBelmondoSaving(true);
    try {
      const body = downgrade ? { plan: "basic" } : {
        plan: "pro",
        planId: belmondoPlanId || plansData?.[0]?._id,
        method: belmondoPaymentMethod
      };
      await apiFetch(`/users/admin/${selectedUser.id}/subscription`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      await handleManage(selectedUser);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBelmondoSaving(false);
    }
  };

  const handleAdjustSessions = async (membershipId: string, delta: number) => {
    if (!selectedUser) return;
    if (delta > 0) {
      setSessionDateModal({ membershipId });
      setSessionDateValue(new Date().toISOString().split("T")[0]);
      return;
    }

    setSessionAdjustingId(membershipId + "_dec");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, date: null }),
      });
      await refetchProfile();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const submitSessionDate = async () => {
    if (!sessionDateModal || !selectedUser) return;
    const membershipId = sessionDateModal.membershipId;
    setSessionDateModal(null);
    setSessionAdjustingId(membershipId + "_inc");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta: 1, date: sessionDateValue }),
      });
      await refetchProfile();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

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

  const toggleConfirmationCall = async (id: string, currentVal: boolean) => {
    try {
      await apiFetch(`/users/admin/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isConfirmationCallDone: !currentVal }),
      });
      setUsers(users.map(u => u.id === id ? { ...u, isConfirmationCallDone: !currentVal } : u));
    } catch (e: any) {
      alert(ar() ? "فشل التحديث: " + e.message : "Update failed: " + e.message);
    }
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
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.civilIdNumberMasked || "").includes(search)
  );

  const userStatus = selectedUser ? getStatus(selectedUser, profile) : "";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "العملاء (المرضى)" : "Customers (Patients)"}</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-64 relative flex-1">
            <input className="input-field w-full pl-9" placeholder={ar() ? "بحث بالاسم أو الهاتف أو المدني..." : "Search name, phone or Civil ID..."} value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button
            className="btn-primary flex items-center justify-center gap-1.5 whitespace-nowrap"
            onClick={() => setShowAddModal(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {ar() ? "إضافة عميل" : "Add Customer"}
          </button>
        </div>
      </div>

      {selectedUser ? (
        <div className="mt-6 rounded-3xl overflow-hidden border border-surface-200 shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
          <UserProfilePanel 
            user={selectedUser} 
            onClose={() => { setSelectedUser(null); }} 
            onRoleChange={(role) => {
              const updated = { ...selectedUser, role };
              setSelectedUser(updated);
              setUsers(users.map(u => u.id === updated.id ? updated : u));
            }}
            onStatusChange={(active) => {
              const updated = { ...selectedUser, isActive: active };
              setSelectedUser(updated);
              setUsers(users.map(u => u.id === updated.id ? updated : u));
            }}
            onLoginAs={() => void impersonateUser(selectedUser.id).catch((e: any) => alert(e.message))}
          />
        </div>
      ) : (
        <div className="card-elevated overflow-hidden bg-white">
          {/* Mobile view (Cards) */}
          <div className="md:hidden divide-y divide-surface-100">
            {usersLoading ? (
              <div className="p-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
            ) : filtered.map((u: any) => {
              const name = getDisplayName(u);
              const status = getStatus(u);
              return (
                <div key={u.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-pink-50 flex items-center justify-center text-sm font-bold text-brand-pink-600 flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-surface-900">{name}</div>
                        <div className="text-xs text-surface-500">{u.phone || "—"}</div>
                      </div>
                    </div>
                    <button
                      className="text-surface-700 font-bold text-xs px-3 py-1.5 bg-surface-50 border border-surface-200 rounded-lg shrink-0"
                      onClick={() => handleManage(u)}
                    >
                      {ar() ? "إدارة" : "Manage"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-sage !text-[10px] !px-2 !py-0.5">Customer</span>
                    <span className={`${getStatusBadge(status)} !text-[10px] !px-2 !py-0.5`}>{status}</span>
                    <div className="flex items-center gap-1 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-surface-600 cursor-pointer" onClick={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)}>
                      <input type="checkbox" checked={u.isConfirmationCallDone ?? false} readOnly className="w-3 h-3 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                      <span>{ar() ? "تأكيد اتصال" : "Confirmed"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!usersLoading && filtered.length === 0 && (
              <div className="p-8 text-center text-surface-500 text-sm">{ar() ? "لا يوجد عملاء" : "No customers found"}</div>
            )}
          </div>

          {/* Desktop view (Table) */}
          <div className="overflow-x-auto hidden md:block">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{ar() ? "الاسم" : "Name"}</th>
                  <th>{ar() ? "الرقم" : "Phone/Contact"}</th>
                  <th>{ar() ? "الصلاحية" : "Role"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                  <th>{ar() ? "تأكيد الاتصال" : "Confirmation"}</th>
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
                            <div className="flex flex-col gap-0.5 text-xs text-surface-400">
                              {u.email && <span>{u.email}</span>}
                              {u.civilIdNumberMasked && (
                                <span className="font-mono text-[11px] text-surface-500">
                                  {ar() ? "المدني: " : "Civil ID: "}{u.civilIdNumberMasked}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{u.phone || "—"}</td>
                      <td><span className="badge-sage">Customer</span></td>
                      <td><span className={getStatusBadge(status)}>{status}</span></td>
                      <td>
                        <label className="flex items-center gap-1.5 bg-surface-50 border border-surface-200 px-2 py-1 w-max rounded text-xs font-bold text-surface-600 cursor-pointer hover:bg-surface-100 transition-colors" title={ar() ? "تم الاتصال لتأكيد العميل" : "Customer confirmation call done"}>
                          <input type="checkbox" checked={u.isConfirmationCallDone ?? false} onChange={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)} className="w-4 h-4 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                          <span>{ar() ? "تم الاتصال" : "Done"}</span>
                        </label>
                      </td>
                      <td className="text-right">
                        <button className="btn-secondary btn-sm bg-white hover:bg-surface-50 text-surface-700 shadow-sm border border-surface-200 px-4"
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
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
              <h3 className="font-bold text-surface-900">{ar() ? "إضافة مستخدم جديد وتسجيل باقات" : "Add User & Enroll Memberships"}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="addUserForm" onSubmit={handleAddSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"} *</label>
                    <input required type="text" className="input-field" value={addForm.fullName} onChange={e => setAddForm(p => ({ ...p, fullName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone"} *</label>
                    <input required type="text" className="input-field" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 965..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني (اختياري)" : "Email (Optional)"}</label>
                    <input type="email" className="input-field" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور" : "Password"}</label>
                    <input type="text" className="input-field" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder={ar() ? "اتركه فارغ = رقم الهاتف" : "Leave empty = phone number"} />
                  </div>
                </div>

                <div className="border-t border-surface-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-surface-900">{ar() ? "الاشتراكات والدفع" : "Memberships & Payment"}</h4>
                    <button type="button" onClick={addEnrollmentRow} className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      {ar() ? "إضافة باقة" : "Add Membership"}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {addForm.enrollments.map((en, idx) => (
                      <div key={idx} className="relative bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden transition-all hover:border-brand-pink-200">
                        {addForm.enrollments.length > 1 && (
                          <button type="button" onClick={() => removeEnrollmentRow(idx)} className="absolute top-3 rtl:left-3 ltr:right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors z-10" title={ar() ? "إزالة" : "Remove"}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                        <div className="px-5 py-3 border-b border-surface-100 bg-surface-50 flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-pink-100 text-brand-pink-700 text-xs font-black">{idx + 1}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-surface-600">{ar() ? "تفاصيل الباقة" : "Membership Details"}</span>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "اختيار باقة/جلسة" : "Select Offer/Session"}</label>
                              <select className="select-field w-full bg-surface-50" value={en.offerId} onChange={e => updateEnrollment(idx, { offerId: e.target.value })}>
                                <option value="">{ar() ? "-- بدون اشتراك --" : "-- No Membership --"}</option>
                                {(offersData?.items || []).map((o: any) => <option key={o.id || o._id} value={o.id || o._id}>{ar() ? o.nameAr || o.name : o.name}</option>)}
                              </select>
                            </div>
                            {en.offerId && (
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العيادة (إن وجدت)" : "Clinic (if applicable)"}</label>
                                <select className="select-field w-full bg-surface-50" value={en.clinicId} onChange={e => updateEnrollment(idx, { clinicId: e.target.value })}>
                                  <option value="">{ar() ? "غير محدد" : "None"}</option>
                                  {(clinicsData?.items || []).map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          
                          {en.offerId && (
                            <div className="pt-4 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "نوع الدفع" : "Purchase Mode"}</label>
                                <select className="select-field w-full" value={en.purchaseMode} onChange={e => updateEnrollment(idx, { purchaseMode: e.target.value })}>
                                  <option value="full">{ar() ? "دفع كامل" : "Full Payment"}</option>
                                  <option value="installments">{ar() ? "أقساط" : "Installments"}</option>
                                  <option value="deposit">{ar() ? "عربون" : "Deposit"}</option>
                                  <option value="free">{ar() ? "عضوية مجانية" : "Free Membership"}</option>
                                  <option value="discount">{ar() ? "خصم خاص" : "Discount"}</option>
                                </select>
                              </div>
                              {en.purchaseMode === "installments" && (
                                <div>
                                  <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "عدد الأقساط" : "Installment Count"}</label>
                                  <select className="select-field w-full" value={en.installmentCount} onChange={e => updateEnrollment(idx, { installmentCount: Number(e.target.value) })}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </div>
                              )}
                              {en.purchaseMode !== "installments" ? (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "المبلغ المدفوع اليوم (KWD)" : "Amount Paid Today (KWD)"}</label>
                                    <input type="number" step="0.001" min="0" className="input-field w-full font-mono text-brand-pink-700 font-bold" value={en.amountPaidKwd} onChange={e => updateEnrollment(idx, { amountPaidKwd: e.target.value })} disabled={en.purchaseMode === "free"} placeholder="0.000" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"}</label>
                                    <select className="select-field w-full" value={en.method} onChange={e => updateEnrollment(idx, { method: e.target.value })}>
                                      <option value="cash">{ar() ? "الدفع في العيادة" : "Paid in Clinic"}</option>
                                      <option value="pos">POS</option>
                                      <option value="bank_transfer">{ar() ? "رابط دفع خارجي" : "External Payment Link"}</option>
                                      <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
                                      <option value="enet">ENET</option>
                                      <option value="wallet">{ar() ? "محفظة كاش باك" : "Cashback Wallet"}</option>
                                      <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                    </select>
                                  </div>
                                </>
                              ) : (
                                <div className="sm:col-span-2 mt-2 space-y-3">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جدول الأقساط" : "Installment Schedule"}</label>
                                  <div className="bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                      <thead className="bg-surface-50 border-b border-surface-200 text-xs text-surface-500 uppercase">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold">#</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "المبلغ" : "Amount (KWD)"}</th>
                                          <th className="px-3 py-2 font-semibold text-center">{ar() ? "مدفوع؟" : "Paid?"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "الطريقة" : "Method"}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-surface-100">
                                        {(en.customInstallments || []).map((inst, iIdx) => (
                                          <tr key={iIdx}>
                                            <td className="px-3 py-2 font-bold text-surface-500">{iIdx + 1}</td>
                                            <td className="px-3 py-2">
                                              <input type="date" className="input-field text-xs py-1 px-2 w-full min-w-[110px]" value={inst.dueDate} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].dueDate = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <input type="number" step="0.001" className="input-field text-xs py-1 px-2 w-full min-w-[80px]" value={inst.amountKwd} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].amountKwd = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <input type="checkbox" className="w-4 h-4 text-brand-pink-600 rounded" checked={inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].isPaid = e.target.checked;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <select className="select-field text-xs py-1 px-2 w-full min-w-[100px]" value={inst.method} disabled={!inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].method = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }}>
                                                <option value="cash">{ar() ? "في العيادة" : "In Clinic"}</option>
                                                <option value="pos">POS</option>
                                                <option value="bank_transfer">{ar() ? "رابط دفع" : "Pay Link"}</option>
                                                <option value="enet">ENET</option>
                                                <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                              </select>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <div className="px-4 py-2 bg-surface-50 border-t border-surface-200 flex justify-between text-xs font-bold text-surface-600">
                                      <span>{ar() ? "المتبقي:" : "Amount Left:"}</span>
                                      <span>
                                        {Math.max(0, (offersData?.items?.find((o: any) => o.id === en.offerId || o._id === en.offerId)?.subscriptionPriceKwd || 0) - (en.customInstallments || []).reduce((sum, inst) => sum + (parseFloat(inst.amountKwd) || 0), 0)).toFixed(3)} KWD
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="sm:col-span-2 mt-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-3">
                                <div className="flex items-center h-5">
                                  <input type="checkbox" id={`verifyPay-${idx}`} checked={en.isVerified} onChange={e => updateEnrollment(idx, { isVerified: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-emerald-300" />
                                </div>
                                <div>
                                  <label htmlFor={`verifyPay-${idx}`} className="text-sm text-emerald-800 font-bold cursor-pointer block leading-none">{ar() ? "الدفع مؤكد وموثق؟ (تفعيل فوري)" : "Payment is verified? (Instant Activation)"}</label>
                                  <p className="text-xs text-emerald-600 mt-1">{ar() ? "عند التفعيل سيتم إرسال إشعار للمستخدم وإتاحة الباقة في حسابه." : "When checked, the membership will be instantly available to the user."}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-surface-100 bg-surface-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">{ar() ? "إلغاء" : "Cancel"}</button>
              <button type="submit" form="addUserForm" disabled={addingUser} className="btn-primary">
                {addingUser ? (ar() ? "جاري الإضافة..." : "Adding...") : (ar() ? "إضافة وحفظ" : "Add & Save")}
              </button>
            </div>
          </div>
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
          <button className="btn-ghost btn-sm" onClick={() => refetch()}>↻</button>
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


function EFormsViewer() {
  const { getAuthHeader } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any>(null);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/eforms/admin/submissions", { headers: getAuthHeader() }) as any;
      setSubmissions(res.items || []);
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const downloadPdf = async (sub: any) => {
    try {
      const subId = sub.id || sub;
      const headers = getAuthHeader();
      let token = "";
      if (headers?.Authorization?.startsWith("Bearer ")) {
        token = headers.Authorization.slice(7);
      }
      const baseUrl = (import.meta as any).env.VITE_API_URL || "";
      const langParam = ar() ? "ar" : "en";
      const url = `${baseUrl}/eforms/submissions/${subId}/pdf?token=${encodeURIComponent(token)}&lang=${langParam}`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load PDF data");
      const htmlText = await res.text();
      
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.width = "800px";
      iframe.style.height = "1200px";
      iframe.style.left = "-9999px";
      document.body.appendChild(iframe);

      iframe.contentWindow?.document.open();
      iframe.contentWindow?.document.write(htmlText);
      iframe.contentWindow?.document.close();

      await new Promise((resolve) => setTimeout(resolve, 800));

      const title = sub.formTitle || "Form";
      const customer = sub.userName || sub.userId || subId;
      const cleanTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").trim().replace(/\s+/g, "-");
      const cleanCustomer = customer.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").trim().replace(/\s+/g, "-");
      const finalName = `Belamonda-${cleanTitle}-${cleanCustomer}`;

      if (iframe.contentDocument) {
        iframe.contentDocument.title = finalName;
      }
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => iframe.remove(), 2000);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="card-elevated p-5">
      <div className="editorial-header justify-between">
        <div className="flex items-center gap-3">
          <span className="accent" />
          <div>
            <h3>{ar() ? "النماذج الإلكترونية الموقّعة" : "Signed eForms"}</h3>
            <div className="meta">{ar() ? "عرض جميع النماذج الموقّعة من العملاء" : "View all signed forms from customers"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {submissions.length > 0 && <span className="status-pill-pending"><span className="dot" aria-hidden="true" />{submissions.length} {ar() ? "نموذج" : "submissions"}</span>}
          <button className="icon-btn" onClick={fetchSubmissions} aria-label={ar() ? "تحديث" : "Refresh"} title={ar() ? "تحديث" : "Refresh"}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>
      {loading ? <div className="shimmer h-32 rounded-2xl" /> : submissions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا توجد نماذج موقّعة" : "No signed forms"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "لم يتم تقديم أي نماذج بعد" : "No form submissions yet"}</div>
        </div>
      ) : (
        <div className="space-y-1.5 mt-4">
          {submissions.map((s: any) => (
            <div key={s.id} className="queue-row group cursor-pointer" onClick={() => setSelectedSub(s)}>
              <div className="avatar avatar-md bg-indigo-50 text-indigo-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-surface-900 truncate">{s.formTitle || "Untitled Form"}</div>
                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العميل:" : "Customer:"} <span className="font-semibold text-surface-700">{s.userName || s.userId}</span> {s.userPhone && `(${s.userPhone})`} • {new Date(s.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {s.signatureRef && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{ar() ? "موقّع" : "Signed"}</span>}
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); downloadPdf(s); }} title={ar() ? "تحميل PDF" : "Download PDF"}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSub && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-100 shrink-0">
              <h3 className="text-xl font-bold text-surface-900">{selectedSub.formTitle || "Form Submission"}</h3>
              <button className="text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedSub(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "العميل" : "Customer"}</span><span className="font-bold text-surface-900">{selectedSub.userName || selectedSub.userId}<br/><span className="text-xs font-normal text-surface-500">{selectedSub.userPhone}</span></span></div>
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "التاريخ" : "Date"}</span><span className="font-bold text-surface-900">{new Date(selectedSub.createdAt).toLocaleString()}</span></div>
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "إصدار النموذج" : "Form Version"}</span><span className="font-bold text-surface-900">v{selectedSub.formVersion}</span></div>
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "الحالة" : "Status"}</span><span className="font-bold text-emerald-600">{selectedSub.signatureRef ? (ar() ? "موقّع" : "Signed") : (ar() ? "مقدم" : "Submitted")}</span></div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-surface-700 mb-3">{ar() ? "الإجابات" : "Answers"}</h4>
                <div className="space-y-2">
                  {(selectedSub.formSnapshot || []).map((field: any) => {
                    const answer = (selectedSub.answers || []).find((a: any) => a.key === field.key);
                    if (field.type === "static_text") return null;
                    return (
                      <div key={field.key} className="bg-surface-50 p-3 rounded-xl">
                        <span className="text-xs text-surface-400 block mb-0.5">{field.labelEn}{field.required ? " *" : ""}</span>
                        <span className="text-sm font-medium text-surface-900">
                          {field.type === "signature" ? (selectedSub.signatureRef ? (ar() ? "(موقّع)" : "(signed)") : "—")
                            : field.type === "file_upload" ? (ar() ? "(ملف مرفق)" : "(file attached)")
                            : answer?.value != null ? (Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value))
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 pt-4 border-t border-surface-100 shrink-0 flex gap-3">
              <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm" onClick={() => setSelectedSub(null)}>{ar() ? "إغلاق" : "Close"}</button>
              <button className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm" onClick={() => downloadPdf(selectedSub)}>{ar() ? "تحميل PDF" : "Download PDF"}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

function InvoiceReviews() {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingCashback, setEditingCashback] = useState<Record<string, string>>({});

  const fetchItems = async () => {
    try {
      const res = await apiFetch("/cashback-requests/legal/queue", { headers: getAuthHeader() }) as any;
      setItems(res.items || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && !rejectReason) return alert(ar() ? "يرجى كتابة سبب الرفض" : "Rejection reason required");
    try {
      const body: any = {};
      if (action === "reject") body.reason = rejectReason;
      if (action === "approve" && editingCashback[id]) body.finalCashbackKwd = editingCashback[id];
      await apiFetch(`/cashback-requests/legal/${id}/${action}`, {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
      });
      setSelectedId(null);
      setRejectReason("");
      setEditingCashback(prev => { const n = {...prev}; delete n[id]; return n; });
      fetchItems();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) return <div className="text-center py-12">Loading queue...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "مراجعة فواتير الكاش باك" : "Invoice Cashback Reviews"}</h3>
        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full whitespace-nowrap shrink-0">{items.length} {ar() ? "معلق" : "pending"}</span>
      </div>
      
      {items.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا توجد طلبات فواتير معلقة" : "No pending invoice requests"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "جميع الطلبات تمت مراجعتها" : "All requests have been reviewed"}</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(req => (
            <div key={req.id} className="card-elevated overflow-hidden flex flex-col">
              {/* ── Card Header: User Info + Wallet ── */}
              <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-pink-400 to-brand-pink-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                  {(req.userName || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-surface-900 text-sm truncate">{req.userName}</div>
                  <div className="text-xs text-surface-500">{req.userPhone}</div>
                </div>
                {req.userCashbackBalance != null && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 border border-emerald-100">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    {Number(req.userCashbackBalance).toFixed(3)} KWD
                  </div>
                )}
              </div>

              {/* ── Invoice Image ── */}
              <a href={req.invoiceImageRef} target="_blank" rel="noreferrer" className="relative w-full h-44 bg-surface-100 overflow-hidden block group">
                <img src={req.invoiceImageRef} alt="Invoice" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  {ar() ? "اضغط للتكبير" : "Click to enlarge"}
                </div>
              </a>

              {/* ── Amount Details ── */}
              <div className="px-4 pt-3 pb-2 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-surface-500">{ar() ? "قيمة الفاتورة" : "Invoice Amount"}</span>
                  <span className="font-bold text-surface-900 text-sm">{req.invoiceAmountKwd} KWD</span>
                </div>

                {/* Editable Cashback Amount */}
                <div className="flex items-center justify-between bg-amber-50 px-3 py-2.5 rounded-xl border border-amber-100">
                  <span className="text-xs font-bold text-amber-800">{ar() ? "مكافأة الكاش باك" : "Cashback Reward"}</span>
                  <div className="flex items-center gap-1.5">
                    {editingCashback[req.id] !== undefined ? (
                      <input
                        type="number"
                        step="0.001"
                        className="input-field text-sm w-24 py-1 px-2 text-right font-bold text-amber-700"
                        value={editingCashback[req.id]}
                        onChange={e => setEditingCashback(prev => ({ ...prev, [req.id]: e.target.value }))}
                        onBlur={() => {
                          if (!editingCashback[req.id] || editingCashback[req.id] === String(req.cashbackAmountKwd)) {
                            setEditingCashback(prev => { const n = {...prev}; delete n[req.id]; return n; });
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="font-black text-amber-600 text-base">{req.cashbackAmountKwd}</span>
                    )}
                    <span className="text-xs font-bold text-amber-600">KWD</span>
                    {editingCashback[req.id] === undefined && (
                      <button
                        onClick={() => setEditingCashback(prev => ({ ...prev, [req.id]: String(req.cashbackAmountKwd) }))}
                        className="p-1 rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
                        title={ar() ? "تعديل المبلغ" : "Edit amount"}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    )}
                  </div>
                </div>

                {editingCashback[req.id] !== undefined && editingCashback[req.id] !== String(req.cashbackAmountKwd) && (
                  <div className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {ar() ? `سيتم اعتماد ${editingCashback[req.id]} KWD بدلاً من ${req.cashbackAmountKwd} KWD` : `Will approve ${editingCashback[req.id]} KWD instead of ${req.cashbackAmountKwd} KWD`}
                  </div>
                )}

                <div className="text-[11px] text-surface-400">{ar() ? "تاريخ الطلب:" : "Submitted:"} {new Date(req.createdAt).toLocaleString()}</div>
              </div>
              
              {/* ── Action Buttons ── */}
              <div className="px-4 pb-4 pt-2 border-t border-surface-100 space-y-2.5 mt-auto">
                {selectedId === req.id ? (
                  <div className="space-y-2 animate-fade-in">
                    <input type="text" className="input-field text-sm" placeholder={ar() ? "سبب الرفض..." : "Rejection Reason..."} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(req.id, "reject")} className="btn-primary flex-1 btn-sm bg-red-500 hover:bg-red-600 border-none shadow-sm">{ar() ? "تأكيد الرفض" : "Confirm Reject"}</button>
                      <button onClick={() => { setSelectedId(null); setRejectReason(""); }} className="btn-secondary flex-1 btn-sm text-surface-500">{ar() ? "إلغاء" : "Cancel"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleAction(req.id, "approve")} className="btn-primary flex-1 btn-sm bg-emerald-500 hover:bg-emerald-600 border-none shadow-sm">{ar() ? "موافقة" : "Approve"}</button>
                    <button onClick={() => setSelectedId(req.id)} className="btn-secondary flex-1 btn-sm text-red-500 hover:bg-red-50 border border-red-200">{ar() ? "رفض" : "Reject"}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionRequests() {
  const { data, refetch: mutate } = useApi<{ items: any[] }>("/users/subscription-requests?status=pending");
  const { getAuthHeader } = useAuth();
  const [busy, setBusy] = useState<string|null>(null);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    let reason = "";
    if (action === "reject") {
      reason = prompt(ar() ? "سبب الرفض:" : "Rejection Reason:") || "";
      if (!reason) return;
    }
    setBusy(id);
    try {
      await apiFetch(`/users/subscription-requests/${id}/${action}`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const reqs = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-surface-900">{ar() ? "طلبات الاشتراك (بيلاموندو برو)" : "Belmondo Pro Requests"}</h2>
          <p className="text-surface-500">{ar() ? "مراجعة وتأكيد مدفوعات اشتراكات العملاء" : "Review and confirm customer subscription payments"}</p>
        </div>
        <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full font-bold whitespace-nowrap shrink-0 self-start sm:self-auto text-sm sm:text-base">
          {reqs.length} {ar() ? "طلبات معلقة" : "Pending"}
        </div>
      </div>

      {reqs.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا توجد طلبات اشتراك معلقة حالياً" : "No pending subscription requests"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "جميع الطلبات تم معالجتها" : "All requests have been processed"}</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reqs.map(req => (
            <div key={req.id} className="card-elevated overflow-hidden flex flex-col border-t-4 border-amber-400">
              {/* Header with user info */}
              <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                  {(req.userName || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-surface-900 text-sm truncate">{req.userName}</div>
                  <div className="text-xs text-surface-500">{req.userPhone}</div>
                  {req.userEmail && <div className="text-xs text-surface-400 truncate">{req.userEmail}</div>}
                </div>
              </div>

              {/* Details */}
              <div className="px-5 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-500">{ar() ? "خطة الدفع" : "Payment Plan"}</span>
                  <span className="bg-surface-100 text-surface-700 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize">{req.paymentOption}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-500">{ar() ? "المبلغ" : "Amount"}</span>
                  <span className="text-amber-600 font-black text-base">{req.amountKwd} KWD</span>
                </div>
                <div className="text-[11px] text-surface-400">{ar() ? "تاريخ الطلب:" : "Submitted:"} {new Date(req.createdAt).toLocaleString()}</div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-4 pt-2 border-t border-surface-100 flex gap-2 mt-auto">
                <button
                  disabled={busy === req.id}
                  onClick={() => handleAction(req.id, "reject")}
                  className="btn-secondary flex-1 btn-sm text-red-500 hover:bg-red-50 border border-red-200"
                >
                  {busy === req.id ? "..." : (ar() ? "رفض" : "Reject")}
                </button>
                <button
                  disabled={busy === req.id}
                  onClick={() => handleAction(req.id, "approve")}
                  className="btn-primary flex-1 btn-sm bg-amber-500 hover:bg-amber-600 border-none shadow-sm"
                >
                  {busy === req.id ? "..." : (ar() ? "تأكيد وتفعيل" : "Approve & Activate")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const translateComplaintStatus = (status: string) => {
  if (!ar()) return status;
  switch (status) {
    case "open": return "مفتوح";
    case "in_progress": return "قيد المعالجة";
    case "escalated": return "تم التصعيد";
    case "resolved": return "محلول";
    case "closed": return "مغلق";
    default: return status;
  }
};

function ComplaintModal({ id, onClose, onUpdated }: { id: string, onClose: () => void, onUpdated: () => void }) {
  const { getAuthHeader } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/complaints/${id}`, { headers: getAuthHeader() })
      .then(res => {
        setData((res as any).complaint);
        setStatus((res as any).complaint.status);
      })
      .finally(() => setLoading(false));
  }, [id, getAuthHeader]);

  const handleUpdate = async () => {
    if (!note && status === data?.status) return;
    setSaving(true);
    try {
      await apiFetch(`/complaints/${id}/update`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ status, note: note || "Status updated" })
      });
      onUpdated();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-pink-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!data) return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="bg-white p-6 rounded-2xl">Error loading complaint<button onClick={onClose} className="block mt-4 btn-secondary">Close</button></div></div>;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
        <div className="p-6 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-lg font-bold text-surface-900">{ar() ? "تفاصيل الشكوى" : "Complaint Details"}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors"><svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-surface-500 block text-xs">{ar() ? "المرسل" : "From"}</span><span className="font-bold">{data.userName || data.userId}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "التاريخ" : "Date"}</span><span className="font-bold">{new Date(data.createdAt).toLocaleString()}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "الفئة" : "Category"}</span><span className="badge-sage">{data.category}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "الحالة الحالية" : "Current Status"}</span><span className="font-bold">{translateComplaintStatus(data.status)}</span></div>
          </div>
          <div>
            <span className="text-surface-500 block text-xs mb-1">{ar() ? "الموضوع" : "Subject"}</span>
            <div className="font-bold text-surface-900 text-lg">{data.subject}</div>
          </div>
          <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
            <span className="text-surface-500 block text-xs mb-2">{ar() ? "التفاصيل" : "Description"}</span>
            <div className="text-surface-800 whitespace-pre-wrap">{data.description || "—"}</div>
          </div>
          
          {data.updates?.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-surface-900">{ar() ? "سجل التحديثات" : "Update History"}</h4>
              <div className="space-y-2">
                {data.updates.map((u: any) => (
                  <div key={u.id} className="bg-surface-50 p-3 rounded-lg border border-surface-100 text-sm">
                    <div className="flex justify-between items-start mb-1 text-xs text-surface-500">
                      <span className="font-bold font-mono text-surface-700">{u.by}</span>
                      <span>{new Date(u.createdAt).toLocaleString()}</span>
                    </div>
                    <div><span className="font-bold mr-2">[{translateComplaintStatus(u.status)}]</span>{u.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-surface-100 pt-6 space-y-4">
            <h4 className="font-bold text-surface-900">{ar() ? "إضافة ملاحظة وتحديث" : "Add Note & Update"}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold block mb-1">{ar() ? "تغيير الحالة" : "Change Status"}</label>
                <select className="select-field w-full" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="open">{ar() ? "مفتوح" : "Open"}</option>
                  <option value="in_progress">{ar() ? "قيد المعالجة" : "In Progress"}</option>
                  <option value="escalated">{ar() ? "تم التصعيد" : "Escalated"}</option>
                  <option value="resolved">{ar() ? "محلول" : "Resolved"}</option>
                  <option value="closed">{ar() ? "مغلق" : "Closed"}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">{ar() ? "ملاحظة (إلزامية عند التحديث)" : "Note (Required)"}</label>
              <textarea className="input-field w-full h-20 resize-none" placeholder="Enter resolution notes or updates..." value={note} onChange={e => setNote(e.target.value)}></textarea>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={onClose}>{ar() ? "إلغاء" : "Cancel"}</button>
              <button className="btn-primary" disabled={saving || (!note.trim() && status === data.status)} onClick={handleUpdate}>{saving ? "..." : (ar() ? "تحديث" : "Update")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CsDashboard() {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isLegalOrAdmin = auth?.role === "legal" || auth?.role === "admin" || auth?.role === "cs_director";
  const isCsDirector = auth?.role === "cs_director";
  const isElevated = isLegalOrAdmin || isCsDirector;
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue();
  const { data: paymentsData } = usePendingPayments();
  const { data: complaintsData, refetch: refetchComplaints } = useComplaints();
  const { data: bookingRequestsData } = useBookingRequests("pending");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string|null>(null);

  const [clinicChangeModal, setClinicChangeModal] = useState<{ type: "membership" | "session" | "request"; id: string; currentClinicId: string; defaultFee: string } | null>(null);
  const [newClinicId, setNewClinicId] = useState("");
  const [isPaidTransfer, setIsPaidTransfer] = useState(false);
  const [transferFee, setTransferFee] = useState("10.000");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const { getAuthHeader } = useAuth();
  
  // Complaints Filters
  const [complaintSearch, setComplaintSearch] = useState("");
  const [complaintStatus, setComplaintStatus] = useState("all");
  const [complaintCategory, setComplaintCategory] = useState("all");

  const filteredComplaints = (complaintsData?.items || []).filter((c: any) => {
    if (complaintStatus !== "all" && c.status !== complaintStatus) return false;
    if (complaintCategory !== "all" && c.category !== complaintCategory) return false;
    if (complaintSearch.trim()) {
      const q = complaintSearch.toLowerCase();
      const subject = c.subject || "";
      const userName = c.userName || c.userId || "";
      if (!subject.toLowerCase().includes(q) && !userName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    ...(isCsDirector ? [{ key: "share_link_performance", icon: Icons.chart, label: ar() ? "أداء روابط المشاركة" : "Share Link Performance" }] : []),
    ...(isLegalOrAdmin ? [{ key: "kyc", icon: Icons.shield, label: t("kyc") }] : []),
    ...(isLegalOrAdmin ? [{ key: "invoice_reviews", icon: Icons.cash, label: ar() ? "مراجعة الفواتير" : "Invoice Reviews" }] : []),
    ...(isLegalOrAdmin ? [{ key: "eforms", icon: Icons.clipboard, label: ar() ? "النماذج الإلكترونية" : "eForms" }] : []),
    { key: "payments", icon: Icons.cash, label: t("payments") },
    { key: "sub_requests", icon: <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.4-6.3-4.8-6.3 4.8 2.3-7.4-6-4.6h7.6z"/></svg>, label: ar() ? "طلبات برو" : "Pro Requests" },
    { key: "customers", icon: Icons.users, label: ar() ? "العملاء" : "Customers" },
    { key: "memberships", icon: Icons.offers, label: ar() ? "الاشتراكات" : "Memberships" },
    { key: "clinic_changes", icon: Icons.clinic, label: ar() ? "تغيير العيادة" : "Clinic Changes" },
    { key: "scheduling", icon: Icons.calendar, label: t("schedule") },
    { key: "chat", icon: Icons.clipboard, label: ar() ? "محادثات الحجوزات" : "Booking Chat" },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "profile", icon: Icons.profile, label: ar() ? "الملف الشخصي" : "Profile & Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={isCsDirector ? (ar() ? "مدير خدمة العملاء" : "CS Director") : isLegalOrAdmin ? (ar() ? "موظف قانوني" : "Legal Officer") : (ar() ? "خدمة العملاء" : "Customer Service")} subtitle={isElevated ? (ar() ? "إدارة التحققات والنماذج والمدفوعات" : "Manage KYC, eForms, payments & bookings") : (ar() ? "إدارة المدفوعات والحجوزات" : "Manage payments, memberships & bookings")}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            {/* ── KPI Summary Row ── */}
            <div className={`grid gap-3 grid-cols-2 sm:gap-4 ${isLegalOrAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {isLegalOrAdmin && (
              <div className="kpi-tile group" onClick={() => setActiveNav("kyc")}>
                <div className="kpi-tile-icon amber">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                </div>
                <div className="kpi-tile-label">{ar() ? "تحققات معلقة" : "Pending KYC"}</div>
                <div className="kpi-tile-value">{(kycData?.items || []).length}</div>
                <div className="kpi-tile-sub"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{ar() ? "تتطلب مراجعة" : "needs review"}</div>
              </div>
              )}
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
            <div className={`grid gap-6 ${isLegalOrAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
              {isLegalOrAdmin && <KycQueue />}
              <PaymentQueue />
              <BookingRequestsQueue onTransfer={(id, clinicId) => {
                setClinicChangeModal({ type: 'request', id, currentClinicId: clinicId, defaultFee: '5.000' });
                setNewClinicId(clinicId);
                setIsPaidTransfer(false);
                setTransferFee("5.000");
                setTransferError(null);
              }} />
            </div>

            {/* ── Referral Activity ── */}
            <ReferralActivityWidget />

            {/* ── Customer Memberships (Full Width) ── */}
            <CustomerMemberships onTransfer={(id, clinicId) => {
              setClinicChangeModal({ type: 'membership', id, currentClinicId: clinicId, defaultFee: '10.000' });
              setNewClinicId(clinicId);
              setIsPaidTransfer(false);
              setTransferFee("10.000");
              setTransferError(null);
            }} />
          </>
        )}
        {activeNav === "share_link_performance" && isCsDirector && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "أداء روابط المشاركة" : "Share Link Performance"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "تقارير أداء ومبيعات الإحالة لموظفي خدمة العملاء." : "Referral sales and performance reports for customer service staff."}</p>
            </div>
            <ReferralLeaderboardWidget allowedRoles={["cs", "cs_director", "legal"]} />
          </div>
        )}
        {activeNav === "kyc" && isLegalOrAdmin && <KycQueue />}
        {activeNav === "invoice_reviews" && isLegalOrAdmin && <InvoiceReviews />}
        {activeNav === "eforms" && isLegalOrAdmin && <EFormsAdminPanel />}
        {activeNav === "sub_requests" && <SubscriptionRequests />}
        {activeNav === "payments" && <PaymentsManager />}
        {activeNav === "memberships" && <CustomerMemberships onTransfer={(id, clinicId) => {
          setClinicChangeModal({ type: 'membership', id, currentClinicId: clinicId, defaultFee: '10.000' });
          setNewClinicId(clinicId);
          setIsPaidTransfer(false);
          setTransferFee("10.000");
          setTransferError(null);
        }} />}
        {activeNav === "customers" && <CustomersManager />}
        {activeNav === "clinic_changes" && <ClinicChangeRequestsQueue />}
        {activeNav === "scheduling" && (
           <div className="space-y-6">
              <BookingRequestsQueue onTransfer={(id, clinicId) => {
                setClinicChangeModal({ type: 'request', id, currentClinicId: clinicId, defaultFee: '5.000' });
                setNewClinicId(clinicId);
                setIsPaidTransfer(false);
                setTransferFee("5.000");
                setTransferError(null);
              }} />
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
        {activeNav === "complaints" && (
          <div className="card-elevated overflow-hidden">
            <div className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <h3 className="text-base font-bold text-surface-900">{ar() ? "الشكاوى" : "Complaints"}</h3>
              <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto bg-surface-50/50 p-2 rounded-2xl border border-surface-100">
                <div className="relative w-full sm:w-64">
                  <svg className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input 
                    type="text" 
                    placeholder={ar() ? "بحث بالاسم أو الموضوع..." : "Search name or subject..."}
                    className={`input-field text-sm py-1.5 w-full ${ar() ? 'pr-9' : 'pl-9'}`}
                    value={complaintSearch}
                    onChange={e => setComplaintSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
                    value={complaintStatus}
                    onChange={e => setComplaintStatus(e.target.value)}
                  >
                    <option value="all">{ar() ? "جميع الحالات" : "All Statuses"}</option>
                    <option value="open">{ar() ? "مفتوح" : "Open"}</option>
                    <option value="in_progress">{ar() ? "قيد المعالجة" : "In Progress"}</option>
                    <option value="escalated">{ar() ? "تم التصعيد" : "Escalated"}</option>
                    <option value="resolved">{ar() ? "محلول" : "Resolved"}</option>
                    <option value="closed">{ar() ? "مغلق" : "Closed"}</option>
                  </select>
                  <select 
                    className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
                    value={complaintCategory}
                    onChange={e => setComplaintCategory(e.target.value)}
                  >
                    <option value="all">{ar() ? "جميع الفئات" : "All Categories"}</option>
                    <option value="clinic">{ar() ? "عيادة" : "Clinic"}</option>
                    <option value="booking">{ar() ? "حجز" : "Booking"}</option>
                    <option value="payment">{ar() ? "دفع" : "Payment"}</option>
                    <option value="technical">{ar() ? "تقني" : "Technical"}</option>
                    <option value="other">{ar() ? "أخرى" : "Other"}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "المرسل" : "From"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
                <tbody>
                  {filteredComplaints.map((c: any) => (
                    <tr key={c.id} onClick={() => setSelectedComplaintId(c.id)} className="cursor-pointer hover:bg-surface-50 transition-colors">
                      <td className="font-medium">{c.subject}</td>
                      <td className="text-sm font-bold text-surface-700">{c.userName || c.userId}</td>
                      <td><span className="badge-sage">{c.category}</span></td>
                      <td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{translateComplaintStatus(c.status)}</span></td>
                      <td className="text-xs">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredComplaints.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div className="empty-state-title">{ar() ? "لا شكاوى" : "No complaints"}</div><div className="empty-state-sub">{ar() ? "لم يتم العثور على نتائج للفلتر الحالي." : "No results found for current filters."}</div></div></td></tr>}
                </tbody>
              </table>
            </div>
            {selectedComplaintId && <ComplaintModal id={selectedComplaintId} onClose={() => setSelectedComplaintId(null)} onUpdated={refetchComplaints} />}
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

      {clinicChangeModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
            <button
              className="absolute top-5 right-5 text-surface-400 hover:text-surface-900 transition-colors"
              onClick={() => setClinicChangeModal(null)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              {ar() ? "تغيير عيادة الاشتراك / الجلسة" : "Change Clinic"}
            </h3>
            <p className="text-xs text-surface-500 -mt-3 mb-5">
              {ar() ? "تغيير عيادة تقديم الخدمة للمريض." : "Transfer the service clinic for the patient."}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "العيادة الجديدة" : "New Clinic"}</label>
                <select
                  className="select-field w-full"
                  value={newClinicId}
                  onChange={e => setNewClinicId(e.target.value)}
                >
                  <option value="">-- {ar() ? "اختر العيادة" : "Select Clinic"} --</option>
                  {(clinicsData?.items || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "رسوم تغيير العيادة" : "Transfer Fee"}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="csDashPaidTransfer"
                      checked={!isPaidTransfer}
                      onChange={() => {
                        setIsPaidTransfer(false);
                        setTransferFee("0.000");
                        setTransferError(null);
                      }}
                      className="text-brand-pink-500 focus:ring-brand-pink-400"
                    />
                    <span className="text-sm font-medium">{ar() ? "مجاني (إعفاء)" : "Free (Waive)"}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="csDashPaidTransfer"
                      checked={isPaidTransfer}
                      onChange={() => {
                        setIsPaidTransfer(true);
                        setTransferFee(clinicChangeModal.defaultFee);
                        setTransferError(null);
                      }}
                      className="text-brand-pink-500 focus:ring-brand-pink-400"
                    />
                    <span className="text-sm font-medium">{ar() ? "مدفوع (خصم رسوم)" : "Paid (Charge Fee)"}</span>
                  </label>
                </div>
              </div>

              {isPaidTransfer && (
                <div className="animate-slide-down">
                  <label className="text-xs font-bold text-surface-700 block mb-1.5">{ar() ? "مبلغ الرسوم (د.ك)" : "Fee Amount (KWD)"}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    className="input-field w-full text-sm bg-surface-50"
                    value={transferFee}
                    onChange={e => {
                      setTransferFee(e.target.value);
                      setTransferError(null);
                    }}
                  />
                </div>
              )}

              {transferError && (
                <div className="text-xs text-red-500 font-semibold bg-red-50 p-3 rounded-xl border border-red-200 animate-pulse">
                  {transferError}
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm"
                onClick={() => setClinicChangeModal(null)}
                disabled={transferSaving}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="flex-1 bg-brand-pink-500 hover:bg-brand-pink-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
                disabled={transferSaving || !newClinicId}
                onClick={async () => {
                  setTransferSaving(true);
                  setTransferError(null);

                  try {
                    const path = clinicChangeModal.type === "membership"
                      ? `/commerce/admin/user-offers/${clinicChangeModal.id}/change-clinic`
                      : clinicChangeModal.type === "request"
                      ? `/scheduling/admin/requests/${clinicChangeModal.id}/change-clinic`
                      : `/scheduling/admin/sessions/${clinicChangeModal.id}/change-clinic`;

                    await apiFetch(path, {
                      method: "POST",
                      headers: getAuthHeader(),
                      body: JSON.stringify({
                        clinicId: newClinicId,
                        isPaid: isPaidTransfer,
                        feeAmount: isPaidTransfer ? Number(transferFee).toFixed(3) : "0.000"
                      })
                    });

                    setClinicChangeModal(null);
                    window.location.reload();
                  } catch (e: any) {
                    setTransferError(e.message || "Failed to transfer clinic");
                  } finally {
                    setTransferSaving(false);
                  }
                }}
              >
                {transferSaving ? "…" : (ar() ? "تأكيد ونقل" : "Confirm & Transfer")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </DashboardShell>
  );
}
