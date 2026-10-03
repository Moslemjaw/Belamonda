import { useState, useEffect } from "react";
import { fmtDate } from "../../../lib/dateFormat";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function InvoiceUploader({ getAuthHeader, ar, isPro, onContactCS }: { getAuthHeader: () => Record<string, string> | undefined; ar: boolean; isPro: boolean; onContactCS: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  const fetchHistory = async () => {
    try {
      const res = await apiFetch("/cashback-requests/me", { headers: getAuthHeader() }) as any;
      if (res.items) setHistory(res.items);
    } catch (e) {}
  };
  
  useEffect(() => {
    if (isPro) fetchHistory();
  }, [isPro]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

  const submit = async () => {
    if (!file || !amount) return alert(ar ? "يرجى إرفاق الفاتورة وكتابة القيمة" : "Please attach the invoice and enter the amount");
    setBusy(true);
    try {
      const b64 = await toBase64(file);
      await apiFetch("/cashback-requests/submit", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ invoiceAmountKwd: amount, invoiceImageBase64: b64 })
      });
      setSuccess(true);
      setFile(null);
      setAmount("");
      fetchHistory();
      setTimeout(() => setSuccess(false), 5000);
    } catch (e: any) {
      alert(e.message || (ar ? "حدث خطأ" : "An error occurred"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-surface-900">{ar ? "مسح الفواتير" : "Scan Your Invoices"}</h2>
        <p className="text-sm text-surface-500 mt-1">{ar ? "اربح كاش باك 3 أضعاف قيمة فواتيرك مع بيلاموندو برو." : "Earn 3x cashback on your invoices with Belmondo Pro."}</p>
      </div>

      {isPro ? (
        <>
          <div className="card-elevated p-6 space-y-6">
            <div className="bg-amber-50 text-amber-900 p-4 rounded-xl text-sm border border-amber-100 flex items-start gap-3">
              <span className="text-xl">✨</span>
              <div>
                <strong>{ar ? "ميزة حصرية لـ Belmondo Pro" : "Pro Exclusive Feature"}</strong>
                <p className="opacity-90 mt-1">{ar ? "ارفع فاتورتك وسيقوم فريقنا بمراجعتها لإضافة الكاش باك لمحفظتك!" : "Upload your invoice and our team will review it to add cashback to your wallet!"}</p>
              </div>
            </div>
            
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                {ar ? "تم رفع الفاتورة بنجاح! سيتم مراجعتها قريباً." : "Invoice uploaded successfully! It will be reviewed soon."}
              </div>
            )}

            <div className="space-y-4">
              <label className="block border-2 border-dashed border-surface-200 rounded-2xl p-8 text-center hover:border-amber-400 transition-colors cursor-pointer bg-surface-50">
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFileChange} />
                {file ? (
                  <div className="space-y-3">
                    <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-48 rounded-xl mx-auto shadow-md border border-surface-200" />
                    <h3 className="font-bold text-surface-900 text-sm">{file.name}</h3>
                    <p className="text-xs text-amber-600 font-medium">{ar ? "اضغط لتغيير الصورة" : "Click to change photo"}</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-2xl text-amber-500">📸</div>
                    <h3 className="font-bold text-surface-900 mb-1">{ar ? "اضغط لرفع صورة الفاتورة" : "Click to upload invoice photo"}</h3>
                    <p className="text-xs text-surface-500">{ar ? "JPEG, PNG, الحد الأقصى 5MB" : "JPEG, PNG, Max 5MB"}</p>
                  </>
                )}
              </label>
            </div>
            
            <div className="space-y-4">
               <label className="block text-sm font-bold text-surface-900">{ar ? "قيمة الفاتورة (د.ك)" : "Invoice Amount (KWD)"}</label>
               <input type="number" step="0.001" min="0" className="input-modern" placeholder={ar ? "مثال: 25.500" : "e.g. 25.500"} value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            
            <button onClick={submit} disabled={busy || !file || !amount} className="btn-primary w-full shadow-glow-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50">
              {busy ? (ar ? "جاري الرفع..." : "Uploading...") : (ar ? "إرسال للمراجعة" : "Submit for Review")}
            </button>
          </div>

          {history.length > 0 && (
            <div>
              <h3 className="font-bold text-surface-900 mb-4 px-2">{ar ? "سجل طلبات الكاش باك" : "Cashback Request History"}</h3>
              <div className="space-y-3">
                {history.map(req => (
                  <div key={req.id} className="card-elevated p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <a href={req.invoiceImageRef} target="_blank" rel="noreferrer" className="w-12 h-12 bg-surface-100 rounded-lg overflow-hidden shrink-0 border border-surface-200 block">
                        <img src={req.invoiceImageRef} alt="Invoice" className="w-full h-full object-cover" />
                      </a>
                      <div>
                        <div className="font-bold text-surface-900">{req.invoiceAmountKwd} KWD</div>
                        <div className="text-xs text-surface-500">{fmtDate(req.createdAt)}</div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="text-sm font-bold text-amber-600">{ar ? "+ كاش باك" : "+ Cashback"} {req.cashbackAmountKwd} KWD</div>
                      {req.status === "pending" && <span className="text-xs px-2 py-0.5 mt-1 bg-orange-100 text-orange-700 rounded-full font-medium">{ar ? "قيد المراجعة" : "Pending"}</span>}
                      {req.status === "accepted" && <span className="text-xs px-2 py-0.5 mt-1 bg-green-100 text-green-700 rounded-full font-medium">{ar ? "مقبول" : "Accepted"}</span>}
                      {req.status === "rejected" && <span className="text-xs px-2 py-0.5 mt-1 bg-red-100 text-red-700 rounded-full font-medium">{ar ? "مرفوض" : "Rejected"}</span>}
                      {req.status === "rejected" && req.rejectionReason && <div className="text-[10px] text-red-500 mt-1 max-w-[120px] truncate" title={req.rejectionReason}>{req.rejectionReason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card-elevated p-8 text-center space-y-6 overflow-hidden relative mt-4">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none"></div>
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl mx-auto flex items-center justify-center text-white text-3xl shadow-glow-lg transform -rotate-6">
            💎
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-black text-surface-900 mb-2">{ar ? "خاصية مقفلة" : "Premium Feature"}</h3>
            <p className="text-surface-600 mb-6 max-w-sm mx-auto">{ar ? "هذه الخاصية حصرية لمشتركي بيلاموندو برو. اشترك الآن واربح 3 أضعاف قيمة فواتيرك كاش باك!" : "This feature is exclusive to Belmondo Pro members. Upgrade now to earn 3x cashback on all your invoices!"}</p>
            <button onClick={onContactCS} className="btn-primary bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-glow-lg px-8 py-3 rounded-full text-white font-bold">{ar ? "تواصل معنا للترقية" : "Contact CS to Upgrade"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
