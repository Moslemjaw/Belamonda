import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

export function ProfileTab() {
  const { getAuthHeader, auth } = useAuth();
  const { data: meData, loading, refetch: refetchMe } = useApi<any>("/users/me");

  const me = meData?.user ?? meData ?? auth;

  const roleLabel: Record<string, string> = {
    admin: "Administrator", finance: "Finance Staff",
    clinicStaff: "Clinic Staff", customer: "Customer",
  };

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", username: "", newPassword: "" });

  useEffect(() => {
    if (me) {
      setForm({
        fullName: me.fullName || me.name || [me.firstName, me.lastName].filter(Boolean).join(" ") || "",
        email: me.email || "",
        phone: me.phone || "",
        username: me.username || "",
        newPassword: "",
      });
    }
  }, [me]);

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
      setIsEditing(false);
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

  if (loading && !me) {
    return (
      <div className="py-20 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading profile..."}</div>
    );
  }

  const displayName = form.fullName || form.username || me?.email || "—";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">

      {/* Avatar + name card */}
      <div className="card-elevated p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-2xl font-black text-brand-pink-600 shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-black text-surface-900 truncate">{displayName}</div>
          <div className="text-xs text-surface-400 mt-0.5">{me?.email}</div>
          <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-pink-50 text-brand-pink-700">
            {roleLabel[me?.role] ?? me?.role ?? "Finance"}
          </span>
        </div>
      </div>

      {/* Account details */}
      <div className="card-elevated p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h4 className="font-bold text-surface-900 text-sm">{ar() ? "بيانات الحساب" : "Account Details"}</h4>
            <p className="text-xs text-surface-400 mt-0.5">{ar() ? "معلومات حسابك الشخصي في النظام" : "Your personal account information in the system"}</p>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${saveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {saveMsg.text}
              </span>
            )}
            {!isEditing ? (
              <button onClick={() => { setIsEditing(true); setSaveMsg(null); }} className="btn-secondary btn-sm text-xs">{ar() ? "تعديل" : "Edit Profile"}</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setIsEditing(false); setSaveMsg(null); }} className="btn-secondary btn-sm text-xs">{ar() ? "إلغاء" : "Cancel"}</button>
                <button onClick={saveProfile} disabled={saving} className="btn-primary btn-sm text-xs">
                  {saving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ" : "Save")}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "اسم المستخدم" : "Username"}</span>
            {isEditing ? <input className="input-field text-sm py-1.5 flex-1" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} dir="ltr" /> : <span className="text-sm font-medium text-surface-800 font-mono">{me?.username || "—"}</span>}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "الاسم الكامل" : "Full Name"}</span>
            {isEditing ? <input className="input-field text-sm py-1.5 flex-1" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /> : <span className="text-sm font-medium text-surface-800">{form.fullName || "—"}</span>}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "البريد الإلكتروني" : "Email"}</span>
            {isEditing ? <input type="email" className="input-field text-sm py-1.5 flex-1" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" /> : <span className="text-sm font-medium text-surface-800">{me?.email || "—"}</span>}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
            <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "الهاتف" : "Phone"}</span>
            {isEditing ? <input className="input-field text-sm py-1.5 flex-1" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" /> : <span className="text-sm font-medium text-surface-800">{me?.phone || "—"}</span>}
          </div>
          {isEditing && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
              <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "كلمة مرور جديدة" : "New Password"}</span>
              <input type="password" className="input-field text-sm py-1.5 flex-1" placeholder="leave blank to keep current" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} dir="ltr" />
            </div>
          )}
          {me?.role && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-surface-100">
              <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "الدور" : "Role"}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-pink-50 text-brand-pink-700">{roleLabel[me.role] ?? me.role}</span>
            </div>
          )}
          {me?.createdAt && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3">
              <span className="text-xs uppercase tracking-wider text-surface-400 font-bold w-36 shrink-0">{ar() ? "تاريخ الانضمام" : "Member Since"}</span>
              <span className="text-sm font-medium text-surface-800">{fmtDate(me.createdAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Access rights */}
      <div className="card-elevated p-5">
        <h4 className="font-bold text-surface-900 text-sm mb-1">{ar() ? "صلاحيات الوصول" : "Access Rights"}</h4>
        <p className="text-xs text-surface-400 mb-4">{ar() ? "الأقسام والبيانات التي يمكنك الاطلاع عليها" : "Dashboard sections and data you have access to"}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: ar() ? "نظرة عامة على الإيرادات" : "Revenue Overview", ok: true },
            { label: ar() ? "سجل المدفوعات" : "Payments Ledger", ok: true },
            { label: ar() ? "تتبع الأقساط" : "Installments Tracking", ok: true },
            { label: ar() ? "بيانات العملاء" : "Customer Data", ok: true },
            { label: ar() ? "تحليلات الأداء" : "Performance Analytics", ok: true },
            { label: ar() ? "تقارير العيادات" : "Clinic Reports", ok: true },
            { label: ar() ? "تصدير التقارير" : "Export Reports", ok: true },
            { label: ar() ? "القيود اليدوية" : "Manual Entries", ok: true },
            { label: ar() ? "الاستردادات" : "Refunds (Relief)", ok: true },
            { label: ar() ? "إدارة النظام" : "System Administration", ok: me?.role === "admin" },
          ].map(item => (
            <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-medium ${item.ok ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-surface-100 bg-surface-50 text-surface-400"}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.ok ? "bg-emerald-500" : "bg-surface-300"}`} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MANUAL ENTRIES TAB
// ===========================================================================
