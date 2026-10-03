import { useState, useEffect } from "react";
import { fmtDateTime } from "../../../lib/dateFormat";
import { createPortal } from "react-dom";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function EFormsViewer() {
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
                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العميل:" : "Customer:"} <span className="font-semibold text-surface-700">{s.userName || s.userId}</span> {s.userPhone && `(${s.userPhone})`} • {fmtDateTime(s.createdAt)}</div>
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
                <div className="bg-surface-50 p-3 rounded-xl"><span className="text-surface-400 block text-xs mb-1">{ar() ? "التاريخ" : "Date"}</span><span className="font-bold text-surface-900">{fmtDateTime(selectedSub.createdAt)}</span></div>
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
