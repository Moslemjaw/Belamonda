import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardPath = path.resolve(__dirname, "../../../client/src/pages/dashboards/ClinicDashboard.tsx");

let content = fs.readFileSync(dashboardPath, "utf-8");

// 1. Add clinicProducts to POSCheckoutModal props
content = content.replace(
  `function POSCheckoutModal({ isOpen, onClose, baseAmountKwd, maxCashbackKwd, onSubmit, isBooking }: {`,
  `function POSCheckoutModal({ isOpen, onClose, baseAmountKwd, maxCashbackKwd, onSubmit, isBooking, clinicProducts }: {`
);

content = content.replace(
  `  isBooking?: boolean;\n}) {`,
  `  isBooking?: boolean;\n  clinicProducts?: {name: string; priceKwd: string}[];\n}) {`
);

// 2. Change the extraItems adding UI to include a dropdown for clinic products
const searchStr = `<div className="flex gap-2">
              <input type="text" placeholder={ar() ? "اسم المنتج..." : "Product name..."} value={newItemName} onChange={e => setNewItemName(e.target.value)} className="input-field text-sm flex-1 py-2" />
              <input type="number" placeholder={ar() ? "السعر" : "Price"} value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="input-field text-sm w-24 py-2" dir="ltr" />
              <button onClick={() => {
                if (!newItemName.trim() || !newItemPrice || isNaN(Number(newItemPrice))) return;
                setExtraItems(prev => [...prev, { name: newItemName, priceKwd: Number(newItemPrice).toFixed(3), qty: 1 }]);
                setNewItemName("");
                setNewItemPrice("");
              }} className="btn-secondary py-2 px-3 bg-surface-100 border-none">+</button>
            </div>`;

const replacementStr = `<div className="space-y-2">
              {clinicProducts && clinicProducts.length > 0 && (
                <div className="flex gap-2">
                  <select 
                    className="input-field text-sm flex-1 py-2"
                    onChange={e => {
                      const p = clinicProducts.find(x => x.name === e.target.value);
                      if (p) {
                        setNewItemName(p.name);
                        setNewItemPrice(p.priceKwd);
                      }
                    }}
                    value={newItemName}
                  >
                    <option value="">{ar() ? "-- اختر منتج من القائمة --" : "-- Select product --"}</option>
                    {clinicProducts.map((p, idx) => (
                      <option key={idx} value={p.name}>{p.name} - {parseFloat(p.priceKwd).toFixed(3)} KWD</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" placeholder={ar() ? "أو اكتب اسم المنتج..." : "Or type product name..."} value={newItemName} onChange={e => setNewItemName(e.target.value)} className="input-field text-sm flex-1 py-2" />
                <input type="number" placeholder={ar() ? "السعر" : "Price"} value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="input-field text-sm w-24 py-2" dir="ltr" />
                <button onClick={() => {
                  if (!newItemName.trim() || !newItemPrice || isNaN(Number(newItemPrice))) return;
                  setExtraItems(prev => {
                    const existing = prev.find(x => x.name === newItemName);
                    if (existing) {
                      return prev.map(x => x.name === newItemName ? { ...x, qty: x.qty + 1 } : x);
                    }
                    return [...prev, { name: newItemName, priceKwd: Number(newItemPrice).toFixed(3), qty: 1 }];
                  });
                  setNewItemName("");
                  setNewItemPrice("");
                }} className="btn-secondary py-2 px-3 bg-surface-100 border-none">+</button>
              </div>
            </div>`;

content = content.replace(searchStr, replacementStr);

// 3. Update ScanTabs props to accept clinicProducts
content = content.replace(
  `  maxCashbackKwd: string;\n}) {`,
  `  maxCashbackKwd: string;\n  clinicProducts?: {name: string; priceKwd: string}[];\n}) {`
);

content = content.replace(
  `function ScanTabs({ tabs, kyc, memberships, payments, clinicSessions, clinicBookings, markingId, onMarkSession, onMarkPaid, maxCashbackKwd }: {`,
  `function ScanTabs({ tabs, kyc, memberships, payments, clinicSessions, clinicBookings, markingId, onMarkSession, onMarkPaid, maxCashbackKwd, clinicProducts }: {`
);

// 4. Pass clinicProducts to POSCheckoutModal
content = content.replace(
  `        maxCashbackKwd={maxCashbackKwd}\n        onSubmit={async (extraItems, cashbackToDeductKwd) => {`,
  `        maxCashbackKwd={maxCashbackKwd}\n        clinicProducts={clinicProducts}\n        onSubmit={async (extraItems, cashbackToDeductKwd) => {`
);

content = content.replace(
  `        maxCashbackKwd={maxCashbackKwd}\n        onSubmit={async (extraItems, cashbackToDeductKwd) => {`, // second instance
  `        maxCashbackKwd={maxCashbackKwd}\n        clinicProducts={clinicProducts}\n        onSubmit={async (extraItems, cashbackToDeductKwd) => {`
);

// 5. Update ScanTabs call in ClinicScannerTab to pass clinicProducts
content = content.replace(
  `          <ScanTabs maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} tabs={SCAN_TABS} kyc={scanKyc} memberships={scanMemberships} payments={scanPayments} clinicSessions={clinicSessions} clinicBookings={scanBookings} markingId={markingId} onMarkSession={handleMarkSession} onMarkPaid={async (id: string, posData?: any) => {`,
  `          <ScanTabs maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} clinicProducts={result?.clinicProducts ?? []} tabs={SCAN_TABS} kyc={scanKyc} memberships={scanMemberships} payments={scanPayments} clinicSessions={clinicSessions} clinicBookings={scanBookings} markingId={markingId} onMarkSession={handleMarkSession} onMarkPaid={async (id: string, posData?: any) => {`
);

fs.writeFileSync(dashboardPath, content, "utf-8");
console.log("Updated ClinicDashboard.tsx with clinicProducts dropdown!");
