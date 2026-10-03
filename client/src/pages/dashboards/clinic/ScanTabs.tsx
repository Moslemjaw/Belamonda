import { useState } from "react";
import { fmtDate, fmtDateTime } from "../../../lib/dateFormat";
import { ar, SESSION_STATUS_COLORS, STATUS_COLORS } from "./shared";
import { POSCheckoutModal } from "./POSCheckoutModal";

export function ScanTabs({ tabs, kyc, memberships, payments, clinicSessions, clinicBookings, markingId, onMarkSession, onMarkPaid, onUpdatePrice, maxCashbackKwd, clinicProducts }: {
  tabs: { key: string; label: string }[];
  kyc: any;
  memberships: any[];
  payments: any[];
  clinicSessions: any[];
  clinicBookings: any[];
  markingId: string | null;
  onMarkSession: (id: string, status: string, posData?: any) => Promise<void>;
  onMarkPaid: (id: string, posData?: any) => Promise<void>;
  onUpdatePrice?: (bookingId: string, newPriceKwd: string) => Promise<void>;
  maxCashbackKwd: string;
  clinicProducts?: {name: string; nameAr?: string; nameEn?: string; priceKwd: string; cashbackDeductionKwd?: string}[];
}) {
  const [activeTab, setActiveTab] = useState("sessions");
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<any | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<any | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  return (
    <div className="space-y-4">
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-20 pt-2 pb-2 bg-surface-50/95 backdrop-blur-xl transition-all">
        <div className="flex gap-1.5 bg-surface-200/60 p-1.5 rounded-[16px] shadow-inner border border-surface-200/30 overflow-x-auto hide-scrollbar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`shrink-0 px-4 py-2 rounded-[12px] text-xs font-bold whitespace-nowrap transition-all ${activeTab === t.key ? "bg-white text-brand-pink-700 shadow-sm" : "text-surface-500 hover:text-surface-800 hover:bg-surface-100/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Info Tab ── */}
      {activeTab === "info" && (
        <div className="card-elevated p-6 bg-white/80 backdrop-blur-xl border border-surface-200 rounded-[28px] space-y-6">
          <h4 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {ar() ? "المعلومات الشخصية" : "Personal Information"}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {memberships.length > 0 && (
              <div className="sm:col-span-2 bg-gradient-to-r from-surface-50 to-white rounded-2xl p-5 border border-surface-200 shadow-sm">
                <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-3">{ar() ? "ملخص العضويات" : "Membership Summary"}</div>
                <div className="flex gap-3 flex-wrap">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{memberships.filter(m => m.status === "active").length} {ar() ? "فعالة" : "Active"}</span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{memberships.filter(m => m.status === "pending_payment").length} {ar() ? "معلقة" : "Pending"}</span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-surface-100 text-surface-700 border border-surface-200/50 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-surface-500"></span>{memberships.length} {ar() ? "إجمالي" : "Total"}</span>
                </div>
              </div>
            )}
            <div className="bg-surface-50/50 rounded-2xl p-5 border border-surface-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-0.5">{ar() ? "إجمالي الجلسات بالعيادة" : "Clinic Sessions"}</div>
                  <div className="text-xl font-black text-surface-900">{clinicSessions.length}</div>
                </div>
              </div>
            </div>
            <div className="bg-surface-50/50 rounded-2xl p-5 border border-surface-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-0.5">{ar() ? "إجمالي المدفوعات" : "Total Payments"}</div>
                  <div className="text-xl font-black text-surface-900">{payments.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Memberships Tab ── */}
      {activeTab === "memberships" && (
        <div className="card-elevated p-5 space-y-3">
          <h4 className="font-bold text-surface-900">{ar() ? "جميع العضويات" : "All Memberships"}</h4>
          {memberships.length === 0 ? (
            <div className="text-center py-8 text-sm text-surface-400">{ar() ? "لا توجد عضويات" : "No memberships"}</div>
          ) : memberships.map((m: any) => (
            <div key={m.id} className="p-4 bg-surface-50 rounded-xl border border-surface-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-surface-900">{m.offerName}</div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status] ?? "bg-surface-100 text-surface-600"}`}>{m.status}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><span className="text-surface-500">{ar() ? "طريقة الدفع:" : "Mode:"}</span> <span className="font-bold text-surface-800">{m.purchaseMode}</span></div>
                <div><span className="text-surface-500">{ar() ? "المبلغ:" : "Amount:"}</span> <span className="font-bold text-surface-800">{m.paymentAmountKwd} KWD</span></div>
                <div><span className="text-surface-500">{ar() ? "الجلسات:" : "Sessions:"}</span> <span className="font-bold text-surface-800">{m.sessionsUsed}{m.maxSessions != null ? `/${m.maxSessions}` : ""}</span></div>
                {m.purchaseMode === "installments" && (
                  <div><span className="text-surface-500">{ar() ? "الأقساط:" : "Installments:"}</span> <span className="font-bold text-surface-800">{m.installmentsPaid}/{m.installmentCount}</span></div>
                )}
              </div>
              <div className="text-[10px] text-surface-400 flex gap-3 flex-wrap">
                {m.activatedAt && <span>{ar() ? "مفعلة:" : "Activated:"} {fmtDate(m.activatedAt)}</span>}
                {m.expiresAt && <span>{ar() ? "تنتهي:" : "Expires:"} {fmtDate(m.expiresAt)}</span>}
                {m.createdAt && <span>{ar() ? "أنشئت:" : "Created:"} {fmtDate(m.createdAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* Clinic Bookings - Mark Paid */}
          {clinicBookings.filter((b: any) => b.clinicPaymentStatus !== "paid").length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-200/60 rounded-[28px] p-5 sm:p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-full -z-10" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[14px] bg-orange-100 flex items-center justify-center text-orange-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="font-bold text-orange-900">{ar() ? "بانتظار الدفع" : "Awaiting Payment"}</h4>
                  <p className="text-xs text-orange-700/80 mt-0.5">{ar() ? "يجب تحصيل هذا المبلغ من العميل" : "Please collect this amount from the customer"}</p>
                </div>
              </div>
              <div className="space-y-3">
                {clinicBookings.filter((b: any) => b.clinicPaymentStatus !== "paid").map((b: any) => (
                  <div key={b.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/60 backdrop-blur-md rounded-[20px] border border-orange-100 gap-4">
                    <div>
                      {editingPriceId === b.id ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            className="border border-orange-300 rounded-lg py-1 px-2 text-lg font-black text-orange-900 w-28 focus:ring-orange-400 focus:border-orange-400 bg-white"
                            value={editPriceValue}
                            onChange={e => setEditPriceValue(e.target.value)}
                            onKeyDown={async e => {
                              if (e.key === "Enter" && onUpdatePrice) {
                                await onUpdatePrice(b.id, editPriceValue);
                                setEditingPriceId(null);
                              }
                              if (e.key === "Escape") setEditingPriceId(null);
                            }}
                            autoFocus
                            dir="ltr"
                          />
                          <span className="text-lg font-black text-orange-900">KWD</span>
                          <button
                            onClick={async () => {
                              if (onUpdatePrice) {
                                await onUpdatePrice(b.id, editPriceValue);
                              }
                              setEditingPriceId(null);
                            }}
                            className="text-xs font-bold px-2 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                          >✓</button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            className="text-xs font-bold px-2 py-1 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 transition-colors"
                          >✗</button>
                        </div>
                      ) : (
                        <div
                          className="text-lg font-black text-orange-900 mb-1 cursor-pointer hover:text-orange-700 inline-flex items-center gap-1.5 group"
                          onClick={() => {
                            setEditingPriceId(b.id);
                            setEditPriceValue(b.clinicTakeKwd || b.sessionPriceKwd || "0.000");
                          }}
                          title={ar() ? "انقر لتعديل السعر" : "Click to edit price"}
                        >
                          {b.clinicTakeKwd || b.sessionPriceKwd || "0.000"} KWD
                          <svg className="w-3.5 h-3.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-orange-700/60 uppercase tracking-wider">{ar() ? "الخدمة / الموعد" : "Service / Date"}</div>
                      <div className="text-xs font-semibold text-orange-800 mt-1">
                        {b.standaloneName || b.offerName || "Session"}
                        <span className="mx-2 text-orange-300">•</span>
                        {b.scheduledAt ? fmtDateTime(b.scheduledAt) : "—"}
                      </div>
                    </div>
                    <button
                      className="w-full sm:w-auto btn-primary bg-orange-500 hover:bg-orange-600 border-none shadow-orange-500/20 py-2.5 px-6 rounded-xl font-bold shadow-glow"
                      onClick={() => setCheckoutBooking(b)}
                      disabled={payingBookingId === b.id}
                    >
                      {payingBookingId === b.id ? "…" : ar() ? `ادفع ${b.clinicTakeKwd || b.sessionPriceKwd || "0.000"} د.ك` : `Pay ${b.clinicTakeKwd || b.sessionPriceKwd || "0.000"} KWD`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-elevated p-5 sm:p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-surface-200">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-surface-900">{ar() ? "سجل الجلسات" : "Session History"}</h4>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface-100 text-surface-600">{clinicSessions.length} {ar() ? "جلسة" : "sessions"}</span>
            </div>
            {clinicSessions.length === 0 ? (
              <div className="text-center py-10 text-sm text-surface-400 bg-surface-50/50 rounded-2xl border border-dashed border-surface-200">{ar() ? "لا توجد جلسات" : "No sessions at your clinic"}</div>
            ) : (
              <div className="space-y-3">
                {clinicSessions.map((s: any) => (
                  <div key={s.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-surface-50/80 rounded-[20px] border border-surface-100/80 gap-4 transition-all hover:border-surface-300">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center justify-between sm:justify-start gap-3 mb-2 sm:mb-0">
                        {(() => {
                          const b = clinicBookings.find((bk: any) => bk.scheduledSessionId === s.id);
                          const isPaid = b?.clinicPaymentStatus === "paid";
                          const isCompleted = s.status === "completed";
                          
                          let displayStatus = s.status === 'slot_accepted' ? (ar() ? "مجدول" : "SCHEDULED") : s.status?.replace("_", " ");
                          let colorClass = SESSION_STATUS_COLORS[s.status] ?? "bg-surface-100 text-surface-500 border-surface-200";

                          if (isCompleted) {
                            if (!isPaid) {
                              displayStatus = ar() ? "بانتظار الدفع" : "Await Session Payment";
                              colorClass = "bg-amber-50 text-amber-700 border-amber-200";
                            } else {
                              displayStatus = ar() ? "مكتمل" : "Completed";
                              colorClass = SESSION_STATUS_COLORS.completed;
                            }
                          }

                          return (
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>{displayStatus}</span>
                          );
                        })()}
                        <div className="text-sm font-bold text-surface-900 sm:hidden">
                          {new Date(s.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-surface-900 hidden sm:block mt-2">
                        {fmtDate(s.scheduledAt)}
                        <span className="text-surface-300 mx-2">•</span>
                        {new Date(s.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-surface-500 sm:hidden mt-1">
                        {fmtDate(s.scheduledAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      {s.status === "scheduled" && (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button disabled={markingId === s.id} onClick={() => {
                            void onMarkSession(s.id, "completed");
                          }} className="flex-1 sm:flex-none text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 shadow-sm transition-colors">{markingId === s.id ? "…" : "✓ " + (ar() ? "حضر" : "Came")}</button>
                          <button disabled={markingId === s.id} onClick={() => onMarkSession(s.id, "no_show")} className="flex-1 sm:flex-none text-xs font-bold px-4 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 disabled:opacity-50 transition-colors">{markingId === s.id ? "…" : "✗ " + (ar() ? "لم يحضر" : "No Show")}</button>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payments Tab ── */}
      {activeTab === "payments" && (
        <div className="card-elevated p-5 space-y-3">
          <h4 className="font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payment History"}</h4>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-sm text-surface-400">{ar() ? "لا توجد مدفوعات" : "No payments"}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-200">
              <table className="w-full text-sm min-w-[500px]">
                <thead><tr className="bg-surface-50 text-xs text-surface-500 uppercase tracking-wider">
                  <th className="py-2 px-3 text-left">{ar() ? "التاريخ" : "Date"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "المبلغ" : "Amount"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "الطريقة" : "Method"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "الغرض" : "Purpose"}</th>
                  <th className="py-2 px-3 text-left">{ar() ? "الحالة" : "Status"}</th>
                </tr></thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-t border-surface-100">
                      <td className="py-2 px-3 text-surface-600">{p.createdAt ? fmtDate(p.createdAt) : "—"}</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">{p.amountKwd} KWD</td>
                      <td className="py-2 px-3 text-surface-600">{p.method}</td>
                      <td className="py-2 px-3 text-surface-600">{p.purpose}{p.installmentNumber ? ` #${p.installmentNumber}` : ""}</td>
                      <td className="py-2 px-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── KYC Tab ── */}
      {activeTab === "kyc" && (
        <div className="card-elevated p-5 space-y-4">
          <h4 className="font-bold text-surface-900">{ar() ? "بيانات الهوية" : "KYC / Civil ID"}</h4>
          {!kyc ? (
            <div className="text-center py-8 text-sm text-surface-400">{ar() ? "لم يتم تقديم طلب التحقق" : "No KYC submission"}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                  <div className="text-xs text-surface-500">{ar() ? "الحالة" : "Status"}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${kyc.status === "approved" ? "bg-emerald-50 text-emerald-700" : kyc.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>{kyc.status}</span>
                </div>
                <div className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                  <div className="text-xs text-surface-500">{ar() ? "رقم الهوية" : "Civil ID (masked)"}</div>
                  <div className="font-black text-surface-900 tracking-widest font-mono mt-0.5">{kyc.civilIdNumberMasked}</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: ar() ? "الهوية (أمامية)" : "Civil ID — Front", ref: kyc.civilIdFrontRef },
                  { label: ar() ? "الهوية (خلفية)" : "Civil ID — Back", ref: kyc.civilIdBackRef },
                  { label: ar() ? "التوقيع" : "Signature", ref: kyc.signatureRef },
                ].filter(d => d.ref).map(doc => (
                  <div key={doc.label} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                    <div className="px-3 py-2 border-b border-surface-100 text-xs font-bold text-surface-600">{doc.label}</div>
                    <div className="p-2">
                      <a href={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} target="_blank" rel="noreferrer" className="block w-full">
                        <img src={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} alt={doc.label} className="w-full h-32 object-contain rounded-lg bg-surface-50 hover:opacity-90 transition-opacity" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <POSCheckoutModal 
        isOpen={!!checkoutSession} 
        onClose={() => setCheckoutSession(null)} 
        baseAmountKwd={checkoutSession?.baseAmount || "0.000"} 
        walletBalanceKwd={maxCashbackKwd}
        baseCashbackKwd={"0"} // The base session's cashback (if any) was already handled, only allow cashback on extra items
        clinicProducts={clinicProducts}
        onSubmit={async (extraItems, cashbackToDeductKwd) => {
          if (checkoutSession) {
            await onMarkSession(checkoutSession.id, "completed", { extraItems, cashbackToDeductKwd });
          }
        }} 
      />
      <POSCheckoutModal 
        isOpen={!!checkoutBooking} 
        isBooking={true}
        onClose={() => setCheckoutBooking(null)} 
        baseItemName={checkoutBooking?.offerName ? `${checkoutBooking.offerName} Session Booking` : "Session Booking Base"}
        baseAmountKwd={checkoutBooking?.clinicTakeKwd || checkoutBooking?.sessionPriceKwd || "0"} 
        walletBalanceKwd={maxCashbackKwd}
        baseCashbackKwd={checkoutBooking?.maxSessionCashbackKwd || "0"}
        clinicProducts={clinicProducts}
        onSubmit={async (extraItems, cashbackToDeductKwd) => {
          if (checkoutBooking) {
            await onMarkPaid(checkoutBooking.id, { extraItems, cashbackToDeductKwd });
          }
        }} 
      />
    </div>
  );
}
