import { useState, useEffect } from "react";
import { fmtDateTime } from "../../../lib/dateFormat";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function InvoiceReviews() {
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

                <div className="text-[11px] text-surface-400">{ar() ? "تاريخ الطلب:" : "Submitted:"} {fmtDateTime(req.createdAt)}</div>
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
