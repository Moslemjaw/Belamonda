import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";
import type { NoticeItem } from "./shared";

export function NoticesAdminPanel() {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ message: "", messageAr: "", isActive: false, clinicId: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics/admin");
  const clinics = clinicsData?.items ?? [];

  const load = () => {
    setLoading(true);
    apiFetch("/notices/admin", { headers: getAuthHeader() })
      .then((res: any) => setItems(res.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (n: NoticeItem) => {
    setEditId(n._id);
    setForm({
      message: n.message,
      messageAr: n.messageAr ?? "",
      isActive: n.isActive,
      clinicId: n.clinicId?._id ?? "",
    });
  };

  const cancelEdit = () => { setEditId(null); setForm({ message: "", messageAr: "", isActive: false, clinicId: "" }); };

  const save = async () => {
    if (!form.message.trim()) return;
    setSaving(true);
    try {
      const payload = {
        message: form.message,
        messageAr: form.messageAr,
        isActive: form.isActive,
        clinicId: form.clinicId || null,
      };
      if (editId) {
        await apiFetch(`/notices/admin/${editId}`, {
          method: "PUT", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/notices/admin", {
          method: "POST", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      cancelEdit();
      load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await apiFetch(`/notices/admin/${id}`, {
        method: "PUT", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm(ar() ? "حذف هذا الإشعار؟" : "Delete this notice?")) return;
    try {
      await apiFetch(`/notices/admin/${id}`, { method: "DELETE", headers: getAuthHeader() });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const activeNotice = items.find(n => n.isActive);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "إشعارات العيادات" : "Clinic Notices"}</h2>
        <p className="text-sm text-surface-500 mt-1">
          {ar()
            ? "أنشئ إشعاراً يظهر كشريط متحرك في أعلى شاشة لوحة العيادة. يمكنك توجيهه لعيادة محددة أو لجميع العيادات."
            : "Create a notice that displays as a scrolling banner at the top of the clinic dashboard. Target a specific clinic or send it to all."}
        </p>
      </div>

      {/* Live preview */}
      {activeNotice && (
        <div className="rounded-xl overflow-hidden border border-brand-pink-200 shadow-sm">
          <div className="px-4 py-2 bg-brand-pink-50 border-b border-brand-pink-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-pink-500 animate-pulse" />
              <span className="text-xs font-bold text-brand-pink-700">{ar() ? "معاينة الشريط المباشر" : "Live Banner Preview"}</span>
            </div>
            {activeNotice.clinicId ? (
              <span className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-2 py-0.5 rounded-full">
                {activeNotice.clinicId.nameEn}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full">
                {ar() ? "جميع العيادات" : "All Clinics"}
              </span>
            )}
          </div>
          <div className="bg-gradient-to-r from-brand-pink-600 via-brand-pink-500 to-brand-pink-600 text-white overflow-hidden" style={{ minHeight: "36px" }}>
            <div className="flex items-center h-9 overflow-hidden">
              <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-wide"
                style={{ animation: `marquee ${Math.max(18, activeNotice.message.length * 0.28)}s linear infinite`, paddingLeft: "100%" }}>
                <span className="inline-flex items-center gap-1.5 mr-6">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" /></svg>
                  {ar() ? "إشعار" : "Notice"}
                </span>
                {activeNotice.message}
                <span className="mx-16 opacity-40">✦</span>
                {activeNotice.message}
                <span className="mx-16 opacity-40">✦</span>
                {activeNotice.message}
              </div>
            </div>
            <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-66.67%); } }`}</style>
          </div>
        </div>
      )}

      {/* Create / Edit form */}
      <div className="card-elevated border border-surface-200 shadow-sm rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-surface-900">
          {editId ? (ar() ? "تعديل الإشعار" : "Edit Notice") : (ar() ? "إنشاء إشعار جديد" : "Create New Notice")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "النص (إنجليزي)" : "Message (English)"} <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="e.g. Belamondo clinic portal will be under maintenance on Friday from 10 PM – 12 AM."
              className="input-field w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "النص (عربي — اختياري)" : "Message (Arabic — optional)"}</label>
            <input
              type="text"
              value={form.messageAr}
              onChange={e => setForm(f => ({ ...f, messageAr: e.target.value }))}
              placeholder="مثال: سيتوقف نظام العيادات للصيانة يوم الجمعة من ١٠ م حتى ١٢ ص."
              className="input-field w-full text-sm text-right"
              dir="rtl"
            />
          </div>
          {/* Clinic selector */}
          <div>
            <label className="block text-xs font-bold text-surface-700 mb-1.5">
              {ar() ? "استهداف العيادة" : "Target Clinic"}
            </label>
            <select
              value={form.clinicId}
              onChange={e => setForm(f => ({ ...f, clinicId: e.target.value }))}
              className="select-field w-full text-sm"
            >
              <option value="">{ar() ? "جميع العيادات (بث عام)" : "All Clinics (broadcast)"}</option>
              {clinics.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nameEn}{c.nameAr ? ` — ${c.nameAr}` : ""}</option>
              ))}
            </select>
            <p className="text-[11px] text-surface-400 mt-1">
              {ar()
                ? "اختر عيادة محددة لعرض الإشعار لها فقط، أو اتركه فارغاً لإرساله لجميع العيادات."
                : "Pick a specific clinic to show only them this notice, or leave blank to broadcast to all clinics."}
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? "bg-brand-pink-500" : "bg-surface-200"}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm font-medium text-surface-800">
              {ar() ? "تفعيل الآن (سيُلغي تفعيل أي إشعار آخر في نفس النطاق)" : "Activate now (will deactivate any other active notice in the same scope)"}
            </span>
          </label>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving || !form.message.trim()}
            className="px-5 py-2.5 rounded-xl bg-brand-pink-500 text-white text-sm font-bold hover:bg-brand-pink-600 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? "..." : editId ? (ar() ? "حفظ التعديلات" : "Save Changes") : (ar() ? "إنشاء الإشعار" : "Create Notice")}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="px-4 py-2.5 rounded-xl text-sm font-bold text-surface-600 hover:bg-surface-100 transition-colors">
              {ar() ? "إلغاء" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {/* Notices list */}
      <div className="card-elevated border border-surface-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900">{ar() ? "جميع الإشعارات" : "All Notices"} <span className="text-surface-400 font-medium text-xs">({items.length})</span></h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            </div>
            <p className="text-sm text-surface-500">{ar() ? "لا توجد إشعارات بعد" : "No notices yet"}</p>
            <p className="text-xs text-surface-400 mt-1">{ar() ? "أنشئ إشعاراً أعلاه لعرضه للعيادات" : "Create a notice above to display to clinics"}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {items.map(n => (
              <div key={n._id} className={`flex items-start gap-4 px-6 py-5 transition-colors ${n.isActive ? "bg-brand-pink-50/30" : ""}`}>
                {/* Status toggle */}
                <button
                  onClick={() => toggleActive(n._id, n.isActive)}
                  title={n.isActive ? (ar() ? "إيقاف التفعيل" : "Deactivate") : (ar() ? "تفعيل" : "Activate")}
                  className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors border ${n.isActive ? "bg-brand-pink-500 border-brand-pink-500 text-white shadow-sm" : "bg-white border-surface-200 text-surface-400 hover:border-brand-pink-400 hover:text-brand-pink-500"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {n.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-pink-100 text-brand-pink-700 text-[10px] font-bold uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-pink-500 animate-pulse" />
                        {ar() ? "نشط" : "Active"}
                      </span>
                    )}
                    {n.clinicId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {n.clinicId.nameEn}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 text-surface-500 text-[10px] font-bold">
                        {ar() ? "جميع العيادات" : "All Clinics"}
                      </span>
                    )}
                    <span className="text-[10px] text-surface-400">{fmtDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-surface-900 leading-snug">{n.message}</p>
                  {n.messageAr && <p className="text-sm text-surface-500 mt-0.5 text-right" dir="rtl">{n.messageAr}</p>}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => startEdit(n)}
                    className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => remove(n._id)}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
