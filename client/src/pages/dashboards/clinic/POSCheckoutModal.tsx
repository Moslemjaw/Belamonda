import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ar } from "./shared";

export function POSCheckoutModal({ isOpen, onClose, baseAmountKwd, walletBalanceKwd, baseCashbackKwd, baseItemName, onSubmit, isBooking, clinicProducts }: {
  isOpen: boolean;
  onClose: () => void;
  baseAmountKwd: string;
  walletBalanceKwd: string;
  baseCashbackKwd: string;
  baseItemName?: string;
  onSubmit: (extraItems: any[], cashbackToDeductKwd: string) => Promise<void>;
  isBooking?: boolean;
  clinicProducts?: {name: string; nameAr?: string; nameEn?: string; priceKwd: string; cashbackDeductionKwd?: string}[];
}) {
  const { t } = useTranslation();
  const [extraItems, setExtraItems] = useState<{name: string, priceKwd: string, cashbackDeductionKwd?: string, qty: number}[]>([]);
  const [useCashback, setUseCashback] = useState(true);
  const [customCb, setCustomCb] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCbDeduction, setNewItemCbDeduction] = useState("");

  const baseAmount = parseFloat(baseAmountKwd || "0");
  const walletBalance = parseFloat(walletBalanceKwd || "0");
  const baseCb = parseFloat(baseCashbackKwd || "0");
  
  const extraSum = extraItems.reduce((sum, item) => sum + parseFloat(item.priceKwd || "0") * item.qty, 0);
  const extraCbSum = extraItems.reduce((sum, item) => sum + parseFloat(item.cashbackDeductionKwd || "0") * item.qty, 0);
  
  const totalBill = baseAmount + extraSum;
  // Cashback = sum of per-session deductions, capped by wallet balance
  const totalCbAllowance = baseCb + extraCbSum;
  const maxCb = Math.min(totalCbAllowance, walletBalance);
  
  let applicableCashback = 0;
  if (useCashback) {
    if (customCb.trim() !== "") {
      applicableCashback = Math.min(Math.max(0, parseFloat(customCb) || 0), maxCb, totalBill);
    } else {
      applicableCashback = Math.min(totalBill, maxCb);
    }
  }
  
  const finalPay = Math.max(0, totalBill - applicableCashback);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <h3 className="font-bold text-surface-900 text-lg">{ar() ? "تأكيد الدفع والسداد" : "POS Checkout"}</h3>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-200 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-6">
          {/* Base Session */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-100">
            <span className="font-bold text-surface-700">{baseItemName || (ar() ? "حجز الجلسة الأساسي" : "Session Booking Base")}</span>
            <span className="font-mono font-bold text-surface-900">{baseAmount.toFixed(3)} KWD</span>
          </div>

          {/* Extra Items */}
          <div className="space-y-3">
            <div className="font-bold text-sm text-surface-900">{ar() ? "الخدمات والمنتجات الإضافية" : "Additional Products / Services"}</div>
            {extraItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-3 bg-surface-50 rounded-xl border border-surface-100">
                <div className="flex-1">
                  <div className="font-bold">{item.name}</div>
                  <div className="text-xs text-surface-500">{item.qty} × {parseFloat(item.priceKwd).toFixed(3)} KWD</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-surface-900">{(item.qty * parseFloat(item.priceKwd)).toFixed(3)}</span>
                  <button onClick={() => setExtraItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            
            <div className="space-y-2">
              {clinicProducts && clinicProducts.length > 0 ? (
                <div className="flex gap-2">
                  <select 
                    className="input-field text-sm flex-1 py-2"
                    onChange={e => {
                      const p = clinicProducts.find(x => x.name === e.target.value);
                      if (p) {
                        setNewItemName(ar() ? (p.nameAr || p.name) : (p.nameEn || p.name));
                        setNewItemPrice(p.priceKwd);
                        setNewItemCbDeduction(p.cashbackDeductionKwd || "0");
                      } else {
                        setNewItemName("");
                        setNewItemPrice("");
                        setNewItemCbDeduction("");
                      }
                    }}
                    value={clinicProducts.find(x => (ar() ? (x.nameAr || x.name) : (x.nameEn || x.name)) === newItemName)?.name || ""}
                  >
                    <option value="">{ar() ? "-- اختر منتج / جلسة --" : "-- Select Product / Session --"}</option>
                    {clinicProducts.map((p, idx) => {
                      const displayName = ar() ? (p.nameAr || p.name) : (p.nameEn || p.name);
                      return <option key={idx} value={p.name}>{displayName} - {parseFloat(p.priceKwd).toFixed(3)} KWD</option>;
                    })}
                  </select>
                  <button onClick={() => {
                    if (!newItemName.trim() || !newItemPrice || isNaN(Number(newItemPrice))) return;
                    setExtraItems(prev => {
                      const existing = prev.find(x => x.name === newItemName);
                      if (existing) {
                        return prev.map(x => x.name === newItemName ? { ...x, qty: x.qty + 1 } : x);
                      }
                      return [...prev, { name: newItemName, priceKwd: Number(newItemPrice).toFixed(3), cashbackDeductionKwd: newItemCbDeduction, qty: 1 }];
                    });
                    setNewItemName("");
                    setNewItemPrice("");
                    setNewItemCbDeduction("");
                  }} className="btn-secondary py-2 px-4 bg-brand-pink-50 text-brand-pink-700 hover:bg-brand-pink-100 border-none font-bold" disabled={!newItemName}>+</button>
                </div>
              ) : (
                <div className="text-xs text-surface-400 bg-surface-50 p-2 rounded-lg text-center">
                  {ar() ? "لا توجد منتجات مسجلة لهذه العيادة" : "No products available for this clinic"}
                </div>
              )}
            </div>
          </div>

          {/* Cashback */}
          {maxCb > 0 && (
            <div className="p-4 bg-brand-pink-50 rounded-xl border border-brand-pink-200">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={useCashback} onChange={e => {
                    setUseCashback(e.target.checked);
                    if (!e.target.checked) setCustomCb("");
                  }} className="rounded text-brand-pink-500 focus:ring-brand-pink-500 w-4 h-4" />
                  <span className="font-bold text-sm text-brand-pink-900">{ar() ? "خصم الكاشباك" : "Apply Cashback"}</span>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-white rounded-lg text-brand-pink-700 shadow-sm border border-brand-pink-100">
                  {ar() ? "الحد الأقصى:" : "Max:"} {maxCb.toFixed(3)}
                </div>
              </label>
              {useCashback && (
                <div className="mt-3 text-sm text-brand-pink-800 flex justify-between border-t border-brand-pink-100/50 pt-3 items-center">
                  <span>{ar() ? "مبلغ الخصم (اختياري جزء):" : "Amount to use (optional):"}</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="0" 
                      max={maxCb} 
                      step="0.001"
                      className="border border-brand-pink-200 rounded-lg py-1 px-2 text-right w-24 text-sm focus:ring-brand-pink-400 focus:border-brand-pink-400 bg-white"
                      placeholder={maxCb.toFixed(3)}
                      value={customCb}
                      onChange={e => setCustomCb(e.target.value)}
                    />
                    <span className="font-bold font-mono">KWD</span>
                  </div>
                </div>
              )}
              {useCashback && applicableCashback > 0 && (
                <div className="mt-2 text-sm text-brand-pink-800 flex justify-end gap-2">
                  <span>{ar() ? "الخصم المطبق:" : "Applied Discount:"}</span>
                  <span className="font-bold font-mono">- {applicableCashback.toFixed(3)} KWD</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-surface-100 bg-surface-50 space-y-4">
          <div className="flex items-end justify-between">
            <div className="text-sm font-bold text-surface-500 uppercase tracking-wider">{ar() ? "الإجمالي المطلوب" : "Total to Pay"}</div>
            <div className="text-3xl font-black text-emerald-600">{finalPay.toFixed(3)} <span className="text-sm">KWD</span></div>
          </div>
          <button 
            onClick={async () => {
              setLoading(true);
              try {
                await onSubmit(extraItems, applicableCashback.toFixed(3));
                onClose();
              } catch(e: any) {
                alert(e.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="btn-primary w-full py-3.5 text-base shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "..." : (ar() ? "تأكيد واستكمال الدفع ✓" : "Confirm & Complete Checkout ✓")}
          </button>
        </div>
      </div>
    </div>
  );
}
