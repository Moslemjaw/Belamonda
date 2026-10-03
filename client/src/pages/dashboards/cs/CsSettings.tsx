import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function CsSettings() {
  const { getAuthHeader } = useAuth();
  const { data: meData, loading: meLoading, refetch: refetchMe } = useApi<{ user: { fullName?: string; email?: string; phone?: string; username?: string } }>("/users/me");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", username: "", newPassword: "" });

  useEffect(() => {
    const u = meData?.user;
    if (u) {
      setForm(f => ({
        ...f,
        fullName: u.fullName || "",
        email: u.email || "",
        phone: u.phone || "",
        username: u.username || "",
      }));
    }
  }, [meData]);

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        username: form.username,
      };
      if (form.newPassword.trim()) body.newPassword = form.newPassword.trim();
      await apiFetch("/users/me", { method: "PATCH", headers: getAuthHeader(), body: JSON.stringify(body) });
      setForm(f => ({ ...f, newPassword: "" }));
      setSaveMsg({ type: "ok", text: ar() ? "تم حفظ الملف الشخصي" : "Profile saved successfully" });
      refetchMe();
      setTimeout(() => setSaveMsg(null), 4000);
    } catch (e: any) {
      setSaveMsg({ type: "err", text: e.message || (ar() ? "فشل الحفظ" : "Save failed") });
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.fullName || form.username || "CS").charAt(0).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h4 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {ar() ? "الملف الشخصي للموظف" : "Agent Profile"}
          </h4>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${saveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {saveMsg.text}
              </span>
            )}
            <button onClick={saveProfile} disabled={saving || meLoading} className="btn-primary btn-sm">
              {saving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التغييرات" : "Save Changes")}
            </button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm">
              {initials}
            </div>
            <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Customer Service</div>
          </div>
          <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
              <input type="text" className="input-field bg-white" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder={meLoading ? (ar() ? "جاري التحميل..." : "Loading...") : ""} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
              <input type="email" className="input-field bg-white" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
              <input type="text" className="input-field bg-white" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور الجديدة" : "New Password"}</label>
              <input type="password" className="input-field bg-white" placeholder={ar() ? "اتركه فارغاً للإبقاء على الحالي" : "Leave blank to keep current"} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {ar() ? "إعدادات عامة" : "General Configuration"}
          </h4>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
              <select className="select-field"><option>English (EN)</option><option>Arabic (AR)</option></select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "تلقي إشعارات الحجوزات" : "Receive Booking Alerts"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            {ar() ? "الأمان والوصول" : "Security & Access"}
          </h4>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "صلاحية الجلسة (ساعات)" : "Session Timeout (Hours)"}</label>
              <input type="number" className="input-field" defaultValue={24} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية (2FA)" : "Enable 2FA Authentication"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
