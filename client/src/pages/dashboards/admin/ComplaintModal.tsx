import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { fmtDateTime } from "../../../lib/dateFormat";
import { ar, translateComplaintStatus } from "./shared";

export function ComplaintModal({ id, onClose, onUpdated }: { id: string, onClose: () => void, onUpdated: () => void }) {
  const { getAuthHeader } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/complaints/${id}`, { headers: getAuthHeader() })
      .then(res => {
        setData((res as any).complaint);
        setStatus((res as any).complaint.status);
      })
      .finally(() => setLoading(false));
  }, [id, getAuthHeader]);

  const handleUpdate = async () => {
    if (!note && status === data?.status) return;
    setSaving(true);
    try {
      await apiFetch(`/complaints/${id}/update`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ status, note: note || "Status updated" })
      });
      onUpdated();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-pink-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!data) return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="bg-white p-6 rounded-2xl">Error loading complaint<button onClick={onClose} className="block mt-4 btn-secondary">Close</button></div></div>;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
        <div className="p-6 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-lg font-bold text-surface-900">{ar() ? "تفاصيل الشكوى" : "Complaint Details"}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors"><svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-surface-500 block text-xs">{ar() ? "المرسل" : "From"}</span><span className="font-bold">{data.userName || data.userId}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "التاريخ" : "Date"}</span><span className="font-bold">{fmtDateTime(data.createdAt)}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "الفئة" : "Category"}</span><span className="badge-sage">{data.category}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "الحالة الحالية" : "Current Status"}</span><span className="font-bold">{translateComplaintStatus(data.status)}</span></div>
          </div>
          <div>
            <span className="text-surface-500 block text-xs mb-1">{ar() ? "الموضوع" : "Subject"}</span>
            <div className="font-bold text-surface-900 text-lg">{data.subject}</div>
          </div>
          <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
            <span className="text-surface-500 block text-xs mb-2">{ar() ? "التفاصيل" : "Description"}</span>
            <div className="text-surface-800 whitespace-pre-wrap">{data.description || "—"}</div>
          </div>
          
          {data.updates?.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-surface-900">{ar() ? "سجل التحديثات" : "Update History"}</h4>
              <div className="space-y-2">
                {data.updates.map((u: any) => (
                  <div key={u.id} className="bg-surface-50 p-3 rounded-lg border border-surface-100 text-sm">
                    <div className="flex justify-between items-start mb-1 text-xs text-surface-500">
                      <span className="font-bold font-mono text-surface-700">{u.by}</span>
                      <span>{fmtDateTime(u.createdAt)}</span>
                    </div>
                    <div><span className="font-bold mr-2">[{translateComplaintStatus(u.status)}]</span>{u.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-surface-100 pt-6 space-y-4">
            <h4 className="font-bold text-surface-900">{ar() ? "إضافة ملاحظة وتحديث" : "Add Note & Update"}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold block mb-1">{ar() ? "تغيير الحالة" : "Change Status"}</label>
                <select className="select-field w-full" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="open">{ar() ? "مفتوح" : "Open"}</option>
                  <option value="in_progress">{ar() ? "قيد المعالجة" : "In Progress"}</option>
                  <option value="escalated">{ar() ? "تم التصعيد" : "Escalated"}</option>
                  <option value="resolved">{ar() ? "محلول" : "Resolved"}</option>
                  <option value="closed">{ar() ? "مغلق" : "Closed"}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">{ar() ? "ملاحظة (إلزامية عند التحديث)" : "Note (Required)"}</label>
              <textarea className="input-field w-full h-20 resize-none" placeholder="Enter resolution notes or updates..." value={note} onChange={e => setNote(e.target.value)}></textarea>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={onClose}>{ar() ? "إلغاء" : "Cancel"}</button>
              <button className="btn-primary" disabled={saving || (!note.trim() && status === data.status)} onClick={handleUpdate}>{saving ? "..." : (ar() ? "تحديث" : "Update")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
