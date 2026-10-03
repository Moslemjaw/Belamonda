import { useState, useEffect } from "react";
import { fmtDate } from "../../../lib/dateFormat";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function SubscriptionPage({ getAuthHeader, ar, currentPlan, expiresAt, commitmentEndsAt, paymentType, requireKyc }: {
  getAuthHeader: () => Record<string, string> | undefined;
  ar: boolean;
  currentPlan?: string;
  expiresAt?: string | null;
  commitmentEndsAt?: string | null;
  paymentType?: string;
  requireKyc: () => boolean;
}) {
  const { data: plansData } = useApi<any[]>("/subscriptions/plans");
  const plans = (plansData || []).filter(p => p.isActive);
  const [option, setOption] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (plans.length > 0 && !option) {
      setOption(plans[0]._id);
    }
  }, [plans, option]);

  const fetchRequests = async () => {
    try {
      const res = await apiFetch("/users/me/subscription", { headers: getAuthHeader() }) as any;
      if (res.items) setRequests(res.items);
    } catch (e) {}
  };

  useEffect(() => { fetchRequests(); }, []);

  const pendingRequest = requests.find(r => r.status === "pending");

  const subscribe = async () => {
    if (!requireKyc()) return;
    setBusy(true);
    try {
      await apiFetch("/users/me/subscription", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ planId: option })
      });
      setSubmitted(true);
      fetchRequests();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="bg-gradient-to-br from-surface-900 via-amber-800 to-amber-600 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 space-y-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl shadow-inner mb-6">👑</div>
          <h1 className="text-3xl sm:text-4xl font-black">{ar ? "بيلاموندو برو" : "Belmondo Pro"}</h1>
          <p className="text-amber-100 text-lg max-w-xl">{ar ? "اشترك الآن واربح 3 أضعاف قيمة فواتيرك كاش باك، والمزيد من المزايا الحصرية!" : "Subscribe now to earn 3x cashback on all your invoices, plus more exclusive benefits!"}</p>
        </div>
      </div>

      {currentPlan === "pro" ? (
        <div className="card-elevated p-8 space-y-6 border-2 border-amber-400">
          <div className="flex items-center gap-3 text-amber-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h2 className="text-xl font-bold">{ar ? "أنت مشترك حالياً في برو" : "You are currently subscribed to Pro"}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
              <div className="text-sm text-surface-500 mb-1">{ar ? "طريقة الدفع" : "Payment Plan"}</div>
              <div className="font-bold text-surface-900 capitalize">{paymentType}</div>
            </div>
            <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
              <div className="text-sm text-surface-500 mb-1">{ar ? "ينتهي في" : "Expires At"}</div>
              <div className="font-bold text-surface-900">{fmtDate(expiresAt)}</div>
            </div>
          </div>
        </div>
      ) : pendingRequest || submitted ? (
        <div className="card-elevated p-8 text-center space-y-6 border-2 border-orange-300">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl mx-auto flex items-center justify-center text-white text-4xl shadow-glow-lg">⏳</div>
          <h2 className="text-2xl font-black text-surface-900">{ar ? "طلبك قيد المراجعة" : "Your Request is Pending"}</h2>
          <p className="text-surface-600 max-w-md mx-auto">{ar ? "تم إرسال طلب الاشتراك بنجاح. سيقوم فريق خدمة العملاء بمراجعته وتأكيد الدفع قريباً." : "Your subscription request has been submitted successfully. Our CS team will review it and confirm payment soon."}</p>
          {pendingRequest && (
            <div className="inline-flex items-center gap-3 bg-orange-50 border border-orange-200 px-6 py-3 rounded-xl">
              <span className="font-bold text-orange-700">{pendingRequest.amountKwd} KWD</span>
              <span className="text-orange-500">•</span>
              <span className="text-sm text-orange-600 capitalize">{pendingRequest.paymentOption || "Processing..."}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 relative">
          {plans.map(plan => (
            <div key={plan._id} className={`card-elevated p-6 cursor-pointer border-2 transition-all ${option === plan._id ? "border-amber-500 shadow-glow-lg ring-4 ring-amber-500/20" : "border-transparent hover:border-amber-200"}`} onClick={() => setOption(plan._id)}>
              {plan.nameEn?.toLowerCase().includes("advance") && (
                <div className="absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-brand-pink-500 to-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10">
                  {ar ? "مُوصى به" : "Recommended"}
                </div>
              )}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-surface-900">{ar ? plan.nameAr : plan.nameEn}</h3>
                  <p className="text-sm text-surface-500">{ar ? `التزام ${plan.minimumCommitmentMonths} أشهر` : `${plan.minimumCommitmentMonths}-month commitment`}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${option === plan._id ? "border-amber-500 bg-amber-500" : "border-surface-300"}`}>
                  {option === plan._id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                </div>
              </div>
              <div className="text-3xl font-black text-amber-600 mb-4">{plan.price.toFixed(3)} <span className="text-lg font-bold text-amber-700/70">KWD</span></div>
              <ul className="space-y-3 text-sm text-surface-700 font-medium">
                <li className="flex items-center gap-2"><span>✅</span> {ar ? "3 أضعاف كاش باك الفواتير" : "3x Invoice Cashback"}</li>
                <li className="flex items-center gap-2"><span>✅</span> {ar ? "أولوية الدعم الفني" : "Priority Support"}</li>
              </ul>
            </div>
          ))}
        </div>
      )}

      {currentPlan !== "pro" && !pendingRequest && !submitted && (
        <div className="bg-surface-50 border border-surface-200 rounded-2xl p-6 text-center space-y-4">
          <p className="text-sm text-surface-600 font-medium">{ar ? "ملاحظة: الاشتراك يتطلب التزام لمدة 3 أشهر كحد أدنى. بعد تقديم الطلب سيتواصل معك فريقنا لتأكيد الدفع." : "Note: Subscription requires a minimum 3-month commitment. After submitting, our team will contact you to confirm payment."}</p>
          <button disabled={busy || !option} onClick={subscribe} className="btn-primary bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-glow-lg px-12 py-4 rounded-full text-white font-bold text-lg w-full md:w-auto">
            {busy ? (ar ? "جاري الإرسال..." : "Submitting...") : (ar ? `تقديم طلب الاشتراك` : `Submit Subscription Request`)}
          </button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-surface-900">{ar ? "سجل طلبات الاشتراك" : "Subscription Request History"}</h3>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="card-elevated p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-surface-900">{r.amountKwd} KWD <span className="text-sm text-surface-500 capitalize">({r.paymentOption || "Plan"})</span></div>
                  <div className="text-xs text-surface-500">{fmtDate(r.createdAt)}</div>
                </div>
                <div>
                  {r.status === "pending" && <span className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-bold">{ar ? "قيد المراجعة" : "Pending"}</span>}
                  {r.status === "paid" && <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold">{ar ? "مدفوع ✓" : "Paid ✓"}</span>}
                  {r.status === "rejected" && <span className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full font-bold">{ar ? "مرفوض" : "Rejected"}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
