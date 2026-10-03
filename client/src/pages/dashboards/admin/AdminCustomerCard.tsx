import { useState } from "react";
import { useApi } from "../../../hooks/useApi";
import { SITE_BASE_URL } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import QRCodeCanvas from "../../../components/QRCodeCanvas";
import { ar } from "./shared";
import type { AdminCardData } from "./shared";

export function AdminCustomerCard({ userId }: { userId: string }) {
  const { data, loading } = useApi<AdminCardData>(`/public/admin/customer/${userId}/card`, { deps: [userId] });
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-surface-900 hover:bg-surface-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
          {ar() ? "بطاقة العضوية الرقمية" : "Digital Membership Card"}
        </span>
        <svg className={`w-4 h-4 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-surface-100">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && data && (
            <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <div className="flex-1">
                <div className="bg-gradient-to-r from-brand-pink-500 to-brand-pink-700 rounded-2xl px-5 py-5 text-white mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brand-pink-200 mb-1">{ar() ? "بطاقة العضوية" : "Membership Card"}</div>
                  <h3 className="text-lg font-black">{data.card.displayName}</h3>
                  {data.card.memberSince && (
                    <div className="text-xs text-brand-pink-200 mt-0.5">
                      {ar() ? "عضو منذ" : "Member since"} {fmtDate(data.card.memberSince)}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-1.5">
                    {data.card.kycVerified ? (
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        {ar() ? "هوية موثقة" : "Verified"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-black/20 text-brand-pink-100 text-[10px] font-bold px-2.5 py-1 rounded-full">
                        {ar() ? "غير موثق" : "Unverified"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-brand-pink-600">{data.card.activeOffers.length}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{ar() ? "عضويات" : "Offers"}</div>
                  </div>
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-emerald-600">{data.card.activeSessionCount}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{ar() ? "جلسات" : "Sessions"}</div>
                  </div>
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-amber-500">{parseFloat(data.card.cashbackUnlockedKwd || "0").toFixed(3)}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{ar() ? "كاش" : "Cashback"}</div>
                  </div>
                </div>
              </div>

              {data.card.publicToken && (
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="text-xs font-bold text-surface-600">{ar() ? "رمز التحقق" : "Verify QR"}</div>
                  <QRCodeCanvas
                    value={`${SITE_BASE_URL}/verify/${data.card.publicToken}`}
                    size={140}
                    className="rounded-lg"
                  />
                  <a
                    href={`${SITE_BASE_URL}/verify/${data.card.publicToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-pink-500 font-medium hover:underline"
                  >
                    {ar() ? "فتح صفحة التحقق" : "Open verify page"} →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
