import { fmtDateTime } from "../../../lib/dateFormat";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { API_BASE_URL } from "../../../lib/api";
import { ar } from "./shared";

export function MyFormsSection() {
  const { getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const { data: subsData, loading: lSubs, refetch } = useApi<{ items: any[] }>("/eforms/me/submissions");
  const { data: avail, loading: lAvail } = useApi<{ items: any[] }>("/eforms/me/available");
  const subs = subsData?.items ?? [];
  const available = avail?.items ?? [];

  const downloadPdf = async (sub: any) => {
    try {
      const id = sub.id || sub;
      const token = (getAuthHeader() as any)?.Authorization?.replace("Bearer ", "");
      const langParam = ar() ? "ar" : "en";
      const url = `${API_BASE_URL}/eforms/submissions/${id}/pdf?token=${encodeURIComponent(token || "")}&lang=${langParam}`;
      
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
      const cleanTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, "").trim().replace(/\s+/g, "-");
      const customer = sub.userName || sub.userId || id;
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
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-surface-900">{ar() ? "نماذجي الموقعة" : "My Signed Forms"}</h2>

      {available.length > 0 && (
        <div className="card-elevated p-4">
          <div className="text-sm font-bold text-surface-900 mb-3">{ar() ? "نماذج بانتظار التعبئة" : "Forms awaiting signature"}</div>
          <div className="space-y-2">
            {available.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 border border-amber-200 bg-amber-50 rounded-xl p-3">
                <div>
                  <div className="font-bold text-surface-900 text-sm">{f.title}</div>
                  {f.description && <div className="text-xs text-surface-500">{f.description}</div>}
                </div>
                <button className="btn-primary btn-sm" onClick={() => navigate(`/forms/fill/${f.id}?return=/dashboard`)}>
                  {ar() ? "تعبئة" : "Fill"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <div className="p-4 border-b border-surface-100 text-sm font-bold text-surface-900">
          {ar() ? "السجل" : "History"}
        </div>
        {lSubs && <div className="p-6 text-sm text-surface-400">{ar() ? "جاري التحميل…" : "Loading…"}</div>}
        {!lSubs && subs.length === 0 && (
          <div className="p-8 text-center text-surface-400 text-sm">{ar() ? "لا توجد نماذج موقعة بعد" : "No signed forms yet"}</div>
        )}
        {!lSubs && subs.length > 0 && (
          <div className="divide-y divide-surface-100">
            {subs.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-surface-900 text-sm">{s.formTitle}</div>
                  <div className="text-xs text-surface-400">{s.createdAt ? fmtDateTime(s.createdAt) : ""} • v{s.formVersion}</div>
                </div>
                <button className="btn-secondary btn-sm text-xs" onClick={() => downloadPdf(s)}>{ar() ? "تنزيل PDF" : "Download PDF"}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
