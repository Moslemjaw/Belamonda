import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(__dirname, "../../../client/src/pages/dashboards/ClinicDashboard.tsx");

let content = fs.readFileSync(dashboardPath, "utf-8");

// 1. Add POSCheckoutModal component at the top
const posModalCode = `
function POSCheckoutModal({ isOpen, onClose, baseAmountKwd, maxCashbackKwd, onSubmit, isBooking }: {
  isOpen: boolean;
  onClose: () => void;
  baseAmountKwd: string;
  maxCashbackKwd: string;
  onSubmit: (extraItems: any[], cashbackToDeductKwd: string) => Promise<void>;
  isBooking?: boolean;
}) {
  const { t } = useTranslation();
  const [extraItems, setExtraItems] = useState<{name: string, priceKwd: string, qty: number}[]>([]);
  const [useCashback, setUseCashback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");

  const baseAmount = parseFloat(baseAmountKwd || "0");
  const maxCb = parseFloat(maxCashbackKwd || "0");
  const extraSum = extraItems.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0);
  const totalBill = baseAmount + extraSum;
  
  const applicableCashback = useCashback ? Math.min(totalBill, maxCb) : 0;
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
            <span className="font-bold text-surface-700">{isBooking ? (ar() ? "قيمة الحجز / الجلسة" : "Session Booking Base") : (ar() ? "الجلسة الأساسية" : "Base Session")}</span>
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
            
            <div className="flex gap-2">
              <input type="text" placeholder={ar() ? "اسم المنتج..." : "Product name..."} value={newItemName} onChange={e => setNewItemName(e.target.value)} className="input-field text-sm flex-1 py-2" />
              <input type="number" placeholder={ar() ? "السعر" : "Price"} value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="input-field text-sm w-24 py-2" dir="ltr" />
              <button onClick={() => {
                if (!newItemName.trim() || !newItemPrice || isNaN(Number(newItemPrice))) return;
                setExtraItems(prev => [...prev, { name: newItemName, priceKwd: Number(newItemPrice).toFixed(3), qty: 1 }]);
                setNewItemName("");
                setNewItemPrice("");
              }} className="btn-secondary py-2 px-3 bg-surface-100 border-none">+</button>
            </div>
          </div>

          {/* Cashback */}
          {maxCb > 0 && (
            <div className="p-4 bg-brand-pink-50 rounded-xl border border-brand-pink-200">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={useCashback} onChange={e => setUseCashback(e.target.checked)} className="rounded text-brand-pink-500 focus:ring-brand-pink-500 w-4 h-4" />
                  <span className="font-bold text-sm text-brand-pink-900">{ar() ? "خصم الكاشباك التلقائي" : "Apply Cashback Discount"}</span>
                </div>
                <div className="text-xs font-bold px-2 py-1 bg-white rounded-lg text-brand-pink-700 shadow-sm border border-brand-pink-100">
                  {ar() ? "متاح:" : "Max:"} {maxCb.toFixed(3)}
                </div>
              </label>
              {useCashback && applicableCashback > 0 && (
                <div className="mt-3 text-sm text-brand-pink-800 flex justify-between border-t border-brand-pink-100/50 pt-2">
                  <span>{ar() ? "الخصم المطبق:" : "Discount Applied:"}</span>
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

function AdjustCashbackModal({ isOpen, onClose, maxCashbackKwd, onAdjust }: {
  isOpen: boolean; onClose: () => void; maxCashbackKwd: string; onAdjust: (amountKwd: string, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <h3 className="font-bold text-surface-900">{ar() ? "تعديل رصيد الكاشباك" : "Adjust Cashback"}</h3>
          <button onClick={onClose} className="p-1.5 text-surface-400 hover:text-surface-700 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs text-surface-500 bg-surface-50 p-3 rounded-lg border border-surface-100">
            {ar() ? "استخدم أرقام سالبة (مثل -5) لخصم الرصيد، أو موجبة لإضافته. الرصيد الحالي: " : "Use negative values (e.g. -5) to deduct. Current balance: "} 
            <span className="font-bold text-emerald-600">{maxCashbackKwd} KWD</span>
          </div>
          <div>
            <label className="text-xs font-bold text-surface-700 block mb-1">{ar() ? "المبلغ (KWD)" : "Amount (KWD)"}</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="input-field" placeholder="e.g. 5.000 or -5.000" dir="ltr" />
          </div>
          <div>
            <label className="text-xs font-bold text-surface-700 block mb-1">{ar() ? "سبب التعديل" : "Reason for Adjustment"}</label>
            <input type="text" value={reason} onChange={e=>setReason(e.target.value)} className="input-field" placeholder={ar() ? "مثال: تعويض، خطأ، الخ" : "e.g. Compensation, Error, etc."} />
          </div>
          <button disabled={loading || !amount || !reason} onClick={async () => {
            setLoading(true);
            try { await onAdjust(amount, reason); onClose(); } catch(e:any) { alert(e.message); } finally { setLoading(false); }
          }} className="btn-primary w-full mt-2">
            {loading ? "..." : (ar() ? "تأكيد التعديل" : "Confirm Adjustment")}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

// Insert the components before ClinicDashboard
const componentsRegex = /function ScanTabs\(/;
content = content.replace(componentsRegex, posModalCode + "\nfunction ScanTabs(");

// 2. Modify ScanTabs to support the modals
content = content.replace(
  `function ScanTabs({ tabs, kyc, memberships, payments, clinicSessions, clinicBookings, markingId, onMarkSession, onMarkPaid }: {`,
  `function ScanTabs({ tabs, kyc, memberships, payments, clinicSessions, clinicBookings, markingId, onMarkSession, onMarkPaid, maxCashbackKwd }: {`
);

content = content.replace(
  `  onMarkPaid: (id: string) => Promise<void>;\n}) {`,
  `  onMarkPaid: (id: string, posData?: any) => Promise<void>;\n  maxCashbackKwd: string;\n}) {`
);

content = content.replace(
  `  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);`,
  `  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<any | null>(null);
  const [checkoutBooking, setCheckoutBooking] = useState<any | null>(null);`
);

// Add the modals to the end of ScanTabs return statement
const scanTabsEndRegex = /    <\/div>\n  \);\n}/;
content = content.replace(scanTabsEndRegex, `
      <POSCheckoutModal 
        isOpen={!!checkoutSession} 
        onClose={() => setCheckoutSession(null)} 
        baseAmountKwd={"0.000"} 
        maxCashbackKwd={maxCashbackKwd}
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
        baseAmountKwd={checkoutBooking?.clinicTakeKwd || checkoutBooking?.sessionPriceKwd || "0"} 
        maxCashbackKwd={maxCashbackKwd}
        onSubmit={async (extraItems, cashbackToDeductKwd) => {
          if (checkoutBooking) {
            await onMarkPaid(checkoutBooking.id, { extraItems, cashbackToDeductKwd });
          }
        }} 
      />
    </div>
  );
}`);

// Change "✓ Came" button to open the POSCheckoutModal
content = content.replace(
  `<button disabled={markingId === s.id} onClick={() => onMarkSession(s.id, "completed")} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">{markingId === s.id ? "…" : "✓ " + (ar() ? "حضر" : "Came")}</button>`,
  `<button disabled={markingId === s.id} onClick={() => setCheckoutSession(s)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm shadow-emerald-500/20">{markingId === s.id ? "…" : "✓ " + (ar() ? "حضر (الدفع)" : "Came (Checkout)")}</button>`
);

// Change "Mark Paid" button to open POSCheckoutModal
content = content.replace(
  `<button disabled={payingBookingId === b.id} onClick={async () => { setPayingBookingId(b.id); await onMarkPaid(b.id); setPayingBookingId(null); }} className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {payingBookingId === b.id ? "…" : (ar() ? "تأكيد الدفع" : "Mark Paid")}
                    </button>`,
  `<button disabled={payingBookingId === b.id} onClick={() => setCheckoutBooking(b)} className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm shadow-emerald-500/20">
                      {payingBookingId === b.id ? "…" : (ar() ? "الدفع ونقاط البيع" : "POS Checkout")}
                    </button>`
);

// 3. Update ClinicScannerTab to support onMarkSession signature change, Adjust Cashback button
content = content.replace(
  `function ClinicScannerTab({ onMarkSession }: { onMarkSession: (sessionId: string, status: string) => Promise<void> }) {`,
  `function ClinicScannerTab({ onMarkSession }: { onMarkSession: (sessionId: string, status: string, posData?: any) => Promise<void> }) {`
);

content = content.replace(
  `const [markingId, setMarkingId] = useState<string | null>(null);`,
  `const [markingId, setMarkingId] = useState<string | null>(null);
  const [showAdjustCb, setShowAdjustCb] = useState(false);`
);

content = content.replace(
  `  const handleMarkSession = async (sessionId: string, status: string) => {`,
  `  const handleMarkSession = async (sessionId: string, status: string, posData?: any) => {`
);

content = content.replace(
  `await onMarkSession(sessionId, status);`,
  `await onMarkSession(sessionId, status, posData);`
);

// Add Adjust Cashback button next to Cashback in the top header
content = content.replace(
  `              <div className="p-4 text-center">
                <div className="text-lg font-black text-emerald-600">{card.cashbackUnlockedKwd ?? "0.000"}</div>
                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-0.5">{ar() ? "كاشباك متاح" : "Cashback (KWD)"}</div>
              </div>`,
  `              <div className="p-4 text-center relative group">
                <div className="text-lg font-black text-emerald-600">{card.cashbackUnlockedKwd ?? "0.000"}</div>
                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mt-0.5 mb-2">{ar() ? "كاشباك متاح" : "Cashback (KWD)"}</div>
                <button onClick={() => setShowAdjustCb(true)} className="mx-auto flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-600 transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {ar() ? "تعديل" : "Adjust"}
                </button>
              </div>`
);

// Pass maxCashbackKwd to ScanTabs
content = content.replace(
  `          <ScanTabs tabs={SCAN_TABS} kyc={scanKyc} memberships={scanMemberships} payments={scanPayments} clinicSessions={clinicSessions} clinicBookings={scanBookings} markingId={markingId} onMarkSession={handleMarkSession} onMarkPaid={async (id: string) => {`,
  `          <ScanTabs maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} tabs={SCAN_TABS} kyc={scanKyc} memberships={scanMemberships} payments={scanPayments} clinicSessions={clinicSessions} clinicBookings={scanBookings} markingId={markingId} onMarkSession={handleMarkSession} onMarkPaid={async (id: string, posData?: any) => {`
);

// Update onMarkPaid implementation inside ScanTabs instantiation to pass posData
content = content.replace(
  `            try {
              await apiFetch(\`/scheduling/requests/\${id}/mark-paid\`, { method: "POST", headers: getAuthHeader() });
              await handleScan();
            } catch (e: any) { alert(e.message); }
          }} />`,
  `            try {
              await apiFetch(\`/scheduling/requests/\${id}/mark-paid\`, { 
                method: "POST", 
                headers: getAuthHeader(),
                body: JSON.stringify(posData || {})
              });
              await handleScan();
            } catch (e: any) { alert(e.message); }
          }} />
          <AdjustCashbackModal isOpen={showAdjustCb} onClose={() => setShowAdjustCb(false)} maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} onAdjust={async (amountKwd, reason) => {
            await apiFetch("/public/clinic/wallet/adjust", {
              method: "POST", headers: getAuthHeader(), body: JSON.stringify({ userId: result?.card?.userId, amountKwd, reason })
            });
            await handleScan();
          }} />`
);


fs.writeFileSync(dashboardPath, content, "utf-8");
console.log("Successfully updated ClinicDashboard.tsx with POS checkout modals!");
