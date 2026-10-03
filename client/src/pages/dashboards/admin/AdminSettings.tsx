import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { ar, SettingsToggle } from "./shared";

export function AdminSettings() {
  const { getAuthHeader } = useAuth();

  // ── Profile state ──────────────────────────────────────────────────────
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const d = (await apiFetch("/users/me", { headers: getAuthHeader() })) as {
          user?: { fullName?: string; email?: string; phone?: string; username?: string };
        };
        if (cancelled) return;
        if (d.user) {
          setFullName(d.user.fullName ?? "");
          setEmail(d.user.email ?? "");
          setPhone(d.user.phone ?? "");
          setUsername(d.user.username ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          setProfileMsg({
            type: "err",
            text: e instanceof Error ? e.message : ar() ? "تعذر تحميل الملف" : "Could not load profile"
          });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAuthHeader]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const body: Record<string, string> = { fullName, email, phone, username };
      if (newPassword.trim()) body.newPassword = newPassword.trim();
      await apiFetch("/users/me", {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      setNewPassword("");
      setProfileMsg({ type: "ok", text: ar() ? "تم حفظ الملف الشخصي" : "Profile saved successfully" });
    } catch (e: unknown) {
      setProfileMsg({ type: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── System settings state ──────────────────────────────────────────────
  const [sysLoading, setSysLoading] = useState(true);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysMsg, setSysMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowNewSignups, setAllowNewSignups] = useState(true);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [requireInstallmentPayment, setRequireInstallmentPayment] = useState(false);
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState(24);
  const [force2FA, setForce2FA] = useState(false);
  const [maxCashbackCapacityKwd, setMaxCashbackCapacityKwd] = useState(10000);

  useEffect(() => {
    let cancelled = false;
    setSysLoading(true);
    void (async () => {
      try {
        const d = (await apiFetch("/settings/system", { headers: getAuthHeader() })) as {
          settings?: {
            maintenanceMode?: boolean;
            allowNewSignups?: boolean;
            defaultLanguage?: string;
            requireInstallmentPayment?: boolean;
            sessionTimeoutHours?: number;
            force2FAForAdmins?: boolean;
            maxCashbackCapacityKwd?: number;
          };
        };
        if (cancelled) return;
        if (d.settings) {
          const s = d.settings;
          setMaintenanceMode(!!s.maintenanceMode);
          setAllowNewSignups(s.allowNewSignups !== false);
          setDefaultLanguage(s.defaultLanguage ?? "en");
          setRequireInstallmentPayment(!!s.requireInstallmentPayment);
          setSessionTimeoutHours(Number(s.sessionTimeoutHours) || 24);
          setForce2FA(!!s.force2FAForAdmins);
          setMaxCashbackCapacityKwd(Number(s.maxCashbackCapacityKwd) || 10000);
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setSysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAuthHeader]);

  const saveSettings = async () => {
    setSysSaving(true);
    setSysMsg(null);
    try {
      const body = {
        maintenanceMode,
        allowNewSignups,
        defaultLanguage,
        requireInstallmentPayment,
        sessionTimeoutHours,
        force2FAForAdmins: force2FA,
        maxCashbackCapacityKwd
      };
      await apiFetch("/settings/system", {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      // also persist installment flag locally for client-side guards
      localStorage.setItem("bel_require_installment_booking_v1", String(requireInstallmentPayment));
      setSysMsg({ type: "ok", text: ar() ? "تم حفظ الإعدادات" : "Settings saved successfully" });
    } catch (e: unknown) {
      setSysMsg({ type: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setSysSaving(false);
    }
  };

  const initials = (fullName || username || "A").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Administrator Profile ── */}
      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {ar() ? "الملف الشخصي للمسؤول" : "Administrator Profile"}
          </h4>
          <button onClick={saveProfile} disabled={profileSaving || profileLoading} className="btn-primary btn-sm">
            {profileSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ الملف" : "Save Profile")}
          </button>
        </div>
        {profileMsg && (
          <div className={`text-xs mb-4 px-3 py-2 rounded-lg ${profileMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{profileMsg.text}</div>
        )}
        {profileLoading ? (
          <div className="h-24 flex items-center justify-center text-surface-400 text-sm">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="shrink-0 flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm">
                {initials}
              </div>
              <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Super Admin</div>
            </div>
            <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
                <input type="text" className="input-field bg-white" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "اسم المستخدم" : "Username"}</label>
                <input type="text" className="input-field bg-white" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
                <input type="email" className="input-field bg-white" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
                <input type="text" className="input-field bg-white" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)" : "New Password (leave blank to keep current)"}</label>
                <input type="password" className="input-field bg-white" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── System Settings ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إعدادات النظام" : "System Settings"}</h3>
        <button onClick={saveSettings} disabled={sysSaving || sysLoading} className="btn-primary btn-sm">
          {sysSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ الإعدادات" : "Save Settings")}
        </button>
      </div>
      {sysMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg ${sysMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{sysMsg.text}</div>
      )}

      {sysLoading ? (
        <div className="h-24 flex items-center justify-center text-surface-400 text-sm">{ar() ? "جاري التحميل..." : "Loading settings..."}</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card-elevated p-6">
            <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {ar() ? "إعدادات عامة" : "General Configuration"}
            </h4>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700">{ar() ? "وضع الصيانة" : "Maintenance Mode"}</span>
                <SettingsToggle checked={maintenanceMode} onChange={setMaintenanceMode} color="red" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700">{ar() ? "السماح بالتسجيل الجديد" : "Allow New Signups"}</span>
                <SettingsToggle checked={allowNewSignups} onChange={setAllowNewSignups} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
                <select className="select-field" value={defaultLanguage} onChange={e => setDefaultLanguage(e.target.value)}>
                  <option value="en">English (EN)</option>
                  <option value="ar">Arabic (AR)</option>
                </select>
              </div>
              <div className="flex items-start justify-between pt-4 border-t border-surface-100 gap-3">
                <div>
                  <span className="text-sm font-medium text-surface-700 block">{ar() ? "إلزام دفع القسط المستحق قبل حجز موعد" : "Require Installment Payment Before Booking"}</span>
                  <span className="text-[10px] text-surface-400">{ar() ? "يمنع المستخدم من حجز مواعيد إذا كان هناك أقساط غير مدفوعة للباقة" : "Prevents users from booking sessions if they have unpaid installments"}</span>
                </div>
                <SettingsToggle checked={requireInstallmentPayment} onChange={setRequireInstallmentPayment} />
              </div>
              <div className="pt-2 border-t border-surface-100">
                <label className="block text-xs font-medium text-surface-700 mb-1.5">{ar() ? "الحد الأقصى لسعة الكاش باك (د.ك)" : "Global Max Cashback Capacity (KWD)"}</label>
                <div className="text-[10px] text-surface-400 mb-2">{ar() ? "الحد الأقصى المطلق للكاش باك الذي يمكن لأي مستخدم امتلاكه (الرصيد المتاح والمقفل معاً)" : "The absolute global limit of cashback a user can have at any time (locked and unlocked combined)"}</div>
                <input type="number" min={0} className="input-field w-full sm:w-1/2" value={maxCashbackCapacityKwd} onChange={e => setMaxCashbackCapacityKwd(Number(e.target.value))} />
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
                <input type="number" min={1} max={168} className="input-field" value={sessionTimeoutHours} onChange={e => setSessionTimeoutHours(Number(e.target.value))} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية للمشرفين" : "Force 2FA for Admins"}</span>
                <SettingsToggle checked={force2FA} onChange={setForce2FA} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
