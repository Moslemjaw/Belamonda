import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/AuthContext";
import { invalidateCache } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function PurchaseModal({ pkg, onClose, inviteCode }: { pkg: any; onClose: () => void, inviteCode?: string | null }) {
  const [paymentOption, setPaymentOption] = useState(() => {
    if (pkg.allowFullPayment) return "full";
    if (pkg.allowInstallments) return "installments";
    if (pkg.allowENet) return "enet4";
    if (pkg.allowDeposit) return "deposit";
    return "full";
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  
  const navigate = useNavigate();
  const { getAuthHeader } = useAuth();
  
  const priceNum = parseFloat(pkg.subscriptionPriceKwd || pkg.price || "0");
  const isInstallment = pkg.allowInstallments && pkg.maxInstallments;
  const installmentAmount = isInstallment ? priceNum / pkg.maxInstallments : 0;

  const handlePurchase = async () => {
     setLoading(true);
     setErrorMsg(null);
     try {
       let endpoint = "";
       let body: any = { offerId: pkg.id || pkg._id };
       if (inviteCode || pkg.groupInviteCode) body.groupInviteCode = inviteCode || pkg.groupInviteCode;
       if (pkg.userOfferId) body.userOfferId = pkg.userOfferId;
       if (paymentOption === "full") {
          endpoint = "/checkout/full";
       } else if (paymentOption === "installments") {
          endpoint = "/checkout/installments";
          body.count = parseInt(pkg.maxInstallments) || 2;
       } else if (paymentOption === "enet4") {
          endpoint = "/checkout/enet4";
       } else if (paymentOption === "deposit") {
          endpoint = "/checkout/deposit";
       }
       
       await apiFetch(endpoint, {
         method: "POST",
         headers: getAuthHeader(),
         body: JSON.stringify(body)
       });
       invalidateCache("/commerce/me/offers");
       invalidateCache("/wallet");
       invalidateCache("/checkout");
       alert(ar() ? "تم الاشتراك بنجاح!" : "Subscribed successfully!");
       onClose();
       window.location.reload();
     } catch (e: any) {
       const msg = e instanceof Error ? e.message : "Error";
       const data = (e as any)?.data as { forms?: any[] } | undefined;
       if (msg === "EFORMS_REQUIRED" && data?.forms?.[0]) {
          const first = data.forms[0];
          onClose();
          const uoIdParam = (data as any).userOfferId ? `&userOfferId=${(data as any).userOfferId}` : "";
          navigate(`/forms/fill/${first.id || first.formId}?offerId=${pkg.id || pkg._id}${uoIdParam}&return=/dashboard`);
        } else {
         setErrorMsg(msg);
       }
     } finally {
       setLoading(false);
     }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-md animate-fade-in">
       <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-slide-up">
         <div className="p-6 border-b border-surface-100 flex justify-between items-center bg-surface-50">
            <div>
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "تأكيد العضوية" : "Confirm Membership"}</h3>
              <div className="text-sm font-medium text-brand-pink-500 mt-1">{pkg.name || pkg.title}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors">✕</button>
         </div>
         <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            
            {pkg.isGroupOffer && (
              <div className={`border rounded-2xl p-4 flex gap-3 ${
                pkg.groupRewardType === 'split_bill' ? 'bg-blue-50 border-blue-200' :
                pkg.isGroupOffer ? 'bg-purple-50 border-purple-200' :
                pkg.groupRewardType === 'free_session' ? 'bg-emerald-50 border-emerald-200' :
                pkg.groupRewardType === 'discount' ? 'bg-amber-50 border-amber-200' :
                pkg.groupRewardType === 'cashback_bonus' ? 'bg-teal-50 border-teal-200' :
                'bg-emerald-50 border-emerald-200'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl ${
                  pkg.groupRewardType === 'split_bill' ? 'bg-blue-100' :
                  pkg.isGroupOffer ? 'bg-purple-100' :
                  pkg.groupRewardType === 'free_session' ? 'bg-emerald-100' :
                  pkg.groupRewardType === 'discount' ? 'bg-amber-100' :
                  pkg.groupRewardType === 'cashback_bonus' ? 'bg-teal-100' :
                  'bg-emerald-100'
                }`}>
                  {pkg.groupRewardType === 'split_bill' ? '🧾' :
                   pkg.isGroupOffer ? '🔓' :
                   pkg.groupRewardType === 'free_session' ? '🎁' :
                   pkg.groupRewardType === 'discount' ? '💰' :
                   pkg.groupRewardType === 'cashback_bonus' ? '💎' : '👥'}
                </div>
                <div>
                  {pkg.groupRewardType === 'split_bill' ? (
                    <>
                      <h4 className="font-bold text-blue-800 text-sm mb-1">{ar() ? "تقسيم الفاتورة بين الأصدقاء!" : "Split the Bill with Friends!"}</h4>
                      <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        {(() => {
                          const total = parseFloat(pkg.price ?? pkg.subscriptionPriceKwd ?? '0') || 0;
                          const count = pkg.groupSizeRequired || 1;
                          const perPerson = (total / count).toFixed(3);
                          return ar()
                            ? `ادفع ${perPerson} KWD فقط! شارك مع ${count} أشخاص بالضبط وتقاسموا الفاتورة الكلية (${total.toFixed(3)} KWD). يجب أن يكون العدد ${count} أشخاص لا أقل.`
                            : `Pay only ${perPerson} KWD each! Group up with exactly ${count} people and split the total bill (${total.toFixed(3)} KWD). Minimum ${count} people required — no less accepted.`;
                        })()}
                      </p>
                    </>
                  ) : pkg.isGroupOffer ? (
                    <>
                      <h4 className="font-bold text-purple-800 text-sm mb-1">{ar() ? "عضوية تحتاج أصدقاء لفتحها!" : "Membership Requires Friends to Unlock!"}</h4>
                      <p className="text-xs text-purple-700 leading-relaxed font-medium">
                        {ar()
                          ? `أنشئ مجموعتك وشارك الرابط مع ${(pkg.groupSizeRequired || 2) - 1} صديق. بعد اكتمال المجموعة، ستتمكن من شراء العضوية بسعر ${pkg.subscriptionPriceKwd || pkg.price} KWD.`
                          : `Create your group and share the link with ${(pkg.groupSizeRequired || 2) - 1} friends. Once the group is complete, you can purchase the membership for ${pkg.subscriptionPriceKwd || pkg.price} KWD.`}
                      </p>
                    </>
                  ) : pkg.groupRewardType === 'free_session' ? (
                    <>
                      <h4 className="font-bold text-emerald-800 text-sm mb-1">{ar() ? "احصل على جلسة مجانية!" : "Get a Free Session!"}</h4>
                      <p className="text-xs text-emerald-600 leading-relaxed font-medium">
                        {ar()
                          ? `بعد الاشتراك، ادعُ ${(pkg.groupSizeRequired || 2) - 1} أصدقاء. عندما يشتركون جميعاً، ستحصل على ${pkg.groupRewardValue || '1'} جلسة مجانية كمكافأة!`
                          : `After subscribing, invite ${(pkg.groupSizeRequired || 2) - 1} friends. When they all subscribe, you'll get ${pkg.groupRewardValue || '1'} free session(s) as a reward!`}
                      </p>
                    </>
                  ) : pkg.groupRewardType === 'discount' ? (
                    <>
                      <h4 className="font-bold text-amber-800 text-sm mb-1">{ar() ? "خصم جماعي!" : "Group Discount!"}</h4>
                      <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        {ar()
                          ? `ادعُ ${(pkg.groupSizeRequired || 2) - 1} أصدقاء بعد الاشتراك واحصل على خصم ${pkg.groupRewardValue || ''} على عضويتك!`
                          : `Invite ${(pkg.groupSizeRequired || 2) - 1} friends after subscribing and get a ${pkg.groupRewardValue || ''} discount on your membership!`}
                      </p>
                    </>
                  ) : pkg.groupRewardType === 'cashback_bonus' ? (
                    <>
                      <h4 className="font-bold text-teal-800 text-sm mb-1">{ar() ? "مكافأة كاش باك إضافية!" : "Bonus Cashback Reward!"}</h4>
                      <p className="text-xs text-teal-700 leading-relaxed font-medium">
                        {ar()
                          ? `ادعُ ${(pkg.groupSizeRequired || 2) - 1} أصدقاء بعد الاشتراك واحصل على ${pkg.groupRewardValue || ''} KWD كاش باك إضافي في محفظتك!`
                          : `Invite ${(pkg.groupSizeRequired || 2) - 1} friends after subscribing and get ${pkg.groupRewardValue || ''} KWD bonus cashback added to your wallet!`}
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-emerald-800 text-sm mb-1">{ar() ? "عرض جماعي متاح!" : "Group Offer Available!"}</h4>
                      <p className="text-xs text-emerald-600 leading-relaxed font-medium">
                        {ar() ? `بعد الاشتراك، ادعُ ${(pkg.groupSizeRequired || 2) - 1} أصدقاء للحصول على مكافأة!` : `After subscribing, invite ${(pkg.groupSizeRequired || 2) - 1} friends to unlock a special reward!`}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
               <h4 className="font-bold text-surface-900 mb-4">{ar() ? "اختر طريقة الدفع" : "Select Payment Method"}</h4>
               {errorMsg && <div className="p-3 mb-4 text-xs font-bold text-red-700 bg-red-100 rounded-lg">{errorMsg}</div>}
               <div className="space-y-3">
                 
                 {/* FULL PAYMENT */}
                 {pkg.allowFullPayment && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'full' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="full" checked={paymentOption === 'full'} onChange={() => setPaymentOption('full')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "دفع كامل" : "Full Payment"}</div>
                        <div className="text-sm text-surface-500">{ar() ? "ادفع المبلغ كاملاً الآن" : "Pay the full amount now"}</div>
                      </div>
                      <div className="font-black text-brand-pink-600">{priceNum.toFixed(3)} KWD</div>
                   </label>
                 )}

                 {/* INSTALLMENTS */}
                 {pkg.allowInstallments && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'installments' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="installments" checked={paymentOption === 'installments'} onChange={() => setPaymentOption('installments')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "أقساط العيادة" : "Clinic Installments"}</div>
                        <div className="text-xs text-surface-500 mt-1">{ar() ? `ادفع على ${pkg.maxInstallments} دفعات ميسرة` : `Pay flexibly in ${pkg.maxInstallments} installments`}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{installmentAmount.toFixed(3)} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "للدفعة الواحدة" : "per installment"}</div>
                      </div>
                   </label>
                 )}

                 {/* eNet (4 Installments) */}
                 {pkg.allowENet && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'enet4' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="enet4" checked={paymentOption === 'enet4'} onChange={() => setPaymentOption('enet4')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "الدفع الإلكتروني (4 أقساط eNet)" : "eNet (Pay in 4)"}</div>
                        <div className="text-xs text-surface-500 mt-1">{ar() ? "قسم مشترياتك على 4 أقساط شهرية عبر eNet" : "Split your purchase into 4 monthly payments via eNet"}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{(priceNum / 4).toFixed(3)} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "للدفعة" : "per month"}</div>
                      </div>
                   </label>
                 )}

                 {/* PAY LATER (Deposit) */}
                 {pkg.allowDeposit && (
                   <label className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentOption === 'deposit' ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                      <input type="radio" name="payment" value="deposit" checked={paymentOption === 'deposit'} onChange={() => setPaymentOption('deposit')} className="mt-1" />
                      <div className="flex-1">
                        <div className="font-bold text-surface-900">{ar() ? "عربون (الدفع لاحقاً)" : "Pay Deposit"}</div>
                        <div className="text-sm text-surface-500">{ar() ? "ادفع عربون الآن والباقي في العيادة" : "Pay a deposit now, rest at the clinic"}</div>
                      </div>
                      <div className="text-right">
                         <div className="font-black text-brand-pink-600">{parseFloat(pkg.depositAmountKwd || pkg.depositAmount || "0").toFixed(3)} KWD</div>
                         <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">{ar() ? "عربون" : "Deposit"}</div>
                      </div>
                   </label>
                 )}
               </div>
            </div>

         </div>
         <div className="p-6 border-t border-surface-100 bg-surface-50 flex gap-3">
            <button disabled={loading} className="btn-primary flex-1 py-3.5 text-base font-bold shadow-brand-pink-500/30 shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-70 disabled:hover:scale-100" onClick={handlePurchase}>{loading ? (ar() ? "جاري المعالجة..." : "Processing...") : (ar() ? "تأكيد ودفع" : "Confirm & Pay")}</button>
         </div>
       </div>
    </div>
  )
}
