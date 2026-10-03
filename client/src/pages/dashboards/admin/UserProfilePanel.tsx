import { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { invalidateCache } from "../../../hooks/useApi";
import { apiFetch, API_BASE_URL } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { ar, ALL_ROLES, ROLE_COLORS } from "./shared";
import type { ProfileTab } from "./shared";
import { AdminCustomerCard } from "./AdminCustomerCard";

export function UserProfilePanel({
  user,
  onClose,
  onRoleChange,
  onStatusChange,
  onLoginAs,
}: {
  user: any;
  onClose: () => void;
  onRoleChange: (role: string) => void;
  onStatusChange: (active: boolean) => void;
  onLoginAs: () => void;
}) {
  const { auth, getAuthHeader } = useAuth();
  const myRole = auth?.role ?? "";
  const isAdmin = myRole === "admin";
  const isCS = myRole === "cs" || myRole === "cs_director" || myRole === "legal";
  const isFinance = myRole === "finance";
  
  const [profile, setProfile] = useState<any>(null);
  const [tab, setTab] = useState<ProfileTab>("overview");
  const displayUser = profile?.user || user;
  const userIsActive = displayUser.isActive ?? displayUser.kyc ?? true;
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [pendingRole, setPendingRole] = useState<string>(user.role);
  const [roleChanging, setRoleChanging] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);

  const [cashAmt, setCashAmt] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);
  const [sessionAdjustingId, setSessionAdjustingId] = useState<string | null>(null);
  const [sessionDateModal, setSessionDateModal] = useState<{ membershipId: string } | null>(null);
  const [sessionDateValue, setSessionDateValue] = useState(new Date().toISOString().split("T")[0]);
  const [installmentAdjustingId, setInstallmentAdjustingId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editingClinicValue, setEditingClinicValue] = useState("");
  
  const [editingFullName, setEditingFullName] = useState(false);
  const [editingFullNameValue, setEditingFullNameValue] = useState("");

  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
  const [generatingRecovery, setGeneratingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleGenerateRecoveryLink = async () => {
    setGeneratingRecovery(true);
    setRecoveryError(null);
    setRecoveryLink(null);
    try {
      const res = await apiFetch(`/users/admin/${user._id || user.id}/recovery-link`, {
        method: "POST",
        headers: getAuthHeader(),
      }) as any;
      if (res.url) {
        setRecoveryLink(res.url);
      }
    } catch (e: any) {
      setRecoveryError(e.message || "Failed to generate link");
    } finally {
      setGeneratingRecovery(false);
    }
  };

  const defaultGrantEnrollment = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "bank_transfer", isVerified: true, installmentCount: 2, customInstallments: [], historicalSessions: [] };
  const [grantEnrollments, setGrantEnrollments] = useState<any[]>([{ ...defaultGrantEnrollment }]);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState(false);
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [allClinics, setAllClinics] = useState<any[]>([]);

  const addGrantEnrollmentRow = () => setGrantEnrollments(p => [...p, { ...defaultGrantEnrollment }]);
  const removeGrantEnrollmentRow = (idx: number) => setGrantEnrollments(p => p.filter((_, i) => i !== idx));
  const updateGrantEnrollment = (idx: number, updates: any) => setGrantEnrollments(p => p.map((x, i) => {
    if (i !== idx) return x;
    const next = { ...x, ...updates };
    // Auto-generate installments if mode switches to installments
    if (updates.purchaseMode === "installments" || (updates.installmentCount && next.purchaseMode === "installments")) {
      const count = next.installmentCount || 2;
      const arr = [];
      const now = new Date();
      for (let j = 0; j < count; j++) {
        const d = new Date(now.getTime() + j * 30 * 24 * 60 * 60 * 1000);
        arr.push({ dueDate: d.toISOString().split("T")[0], amountKwd: "", isPaid: false, method: "cash" });
      }
      next.customInstallments = arr;
    }
    return next;
  }));

  useEffect(() => {
    if (!isAdmin && !isCS) return;
    apiFetch("/offers/admin", { headers: getAuthHeader() })
      .then((d: any) => setAllOffers(d.items ?? []))
      .catch(() => {});
    apiFetch("/clinics", { headers: getAuthHeader() })
      .then((d: any) => setAllClinics(Array.isArray(d) ? d : (d.items ?? [])))
      .catch(() => {});
  }, [isAdmin, isCS]);

  const handleGrantMembership = async () => {
    if (grantEnrollments.some(e => !e.offerId)) { setGrantError(ar() ? "الرجاء اختيار العرض" : "Select an offer for all rows"); return; }
    setGrantSaving(true);
    setGrantError(null);
    setGrantSuccess(false);
    try {
      await apiFetch("/users/admin/manual-enroll", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ 
          userId: user.id || user._id,
          phone: user.phone || user.username || `phone_${user.id}`, 
          fullName: user.fullName || "Customer", 
          email: user.email,
          enrollments: grantEnrollments 
        }),
      });
      setGrantSuccess(true);
      setGrantEnrollments([{ ...defaultGrantEnrollment }]);
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      setGrantError(e.message);
    } finally {
      setGrantSaving(false);
    }
  };

  useEffect(() => {
    setProfileLoading(true);
    setProfileError(null);
    apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() })
      .then((d: any) => setProfile(d))
      .catch((e: any) => setProfileError(e.message))
      .finally(() => setProfileLoading(false));
  }, [user.id]);

  const handleUnverify = async () => {
    if (!confirm(ar() ? "هل أنت متأكد من رغبتك في إلغاء توثيق هذا الحساب؟" : "Are you sure you want to unverify this account?")) return;
    try {
      await apiFetch(`/kyc/admin/${user.id}/unverify`, { method: "POST", headers: getAuthHeader() });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateFullName = async () => {
    try {
      await apiFetch(`/users/admin/${user.id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ fullName: editingFullNameValue }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEditingFullName(false);
    }
  };

  const handleRoleSave = async () => {
    if (!(isAdmin || isCS) || !pendingRole || pendingRole === user.role) return;
    setRoleChanging(true);
    setRoleSaveError(null);
    try {
      await apiFetch(`/users/admin/${user.id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ role: pendingRole })
      });
      onRoleChange(pendingRole);
    } catch (e: any) {
      setRoleSaveError(e.message);
    } finally {
      setRoleChanging(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!(isAdmin || isCS)) return;
    const newActive = !userIsActive;
    setStatusSaving(true);
    try {
      await apiFetch(`/users/admin/${user.id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ isActive: newActive })
      });
      onStatusChange(newActive);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setNoteSaving(true);
    try {
      const res = await apiFetch(`/users/admin/${user._id || user.id}/notes`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ text: newNote }),
      }) as any;
      setNewNote("");
      if (res.note) {
        setProfile((prev: any) => ({
          ...prev,
          user: {
            ...prev.user,
            staffNotes: [...(prev.user.staffNotes || []), res.note]
          }
        }));
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCashbackAdjust = async (sign: 1 | -1) => {
    const amt = parseFloat(cashAmt);
    if (!amt || amt <= 0) { setCashError(ar() ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    if ((isAdmin || isCS) && !cashReason.trim()) { setCashError(ar() ? "السبب مطلوب" : "Reason is required"); return; }
    setCashSaving(true);
    setCashError(null);
    try {
      const kwd = `${Math.floor(amt)}.${String(Math.round((amt % 1) * 1000)).padStart(3, "0")}`;
      const signedKwd = sign === -1 ? `-${kwd}` : kwd;
      if (isAdmin || isCS) {
        await apiFetch("/wallet/admin/adjust", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify({ userId: user.id, amountKwd: signedKwd, reason: cashReason })
        });
      }
      setCashAmt("");
      setCashReason("");
      // Refresh profile
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      setCashError(e.message);
    } finally {
      setCashSaving(false);
    }
  };

  const handleUpdateDate = async (membershipId: string, field: "activatedAt" | "expiresAt") => {
    try {
      await apiFetch(`/commerce/admin/user-offers/${membershipId}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ [field]: editingDateValue ? new Date(editingDateValue).toISOString() : null }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEditingDateId(null);
    }
  };

  const handleUpdateClinic = async (membershipId: string) => {
    try {
      await apiFetch(`/commerce/admin/user-offers/${membershipId}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ clinicId: editingClinicValue || null }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEditingClinicId(null);
    }
  };

  const handleAdjustSessions = async (membershipId: string, delta: number) => {
    if (delta > 0) {
      setSessionDateModal({ membershipId });
      setSessionDateValue(new Date().toISOString().split("T")[0]);
      return;
    }

    setSessionAdjustingId(membershipId + "_dec");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, date: null }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const submitSessionDate = async () => {
    if (!sessionDateModal) return;
    const membershipId = sessionDateModal.membershipId;
    setSessionDateModal(null);
    setSessionAdjustingId(membershipId + "_inc");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta: 1, date: sessionDateValue }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const [installMethodModal, setInstallMethodModal] = useState<{ membershipId: string } | null>(null);
  const [installMethodValue, setInstallMethodValue] = useState("cash");

  const handleAdjustInstallments = async (membershipId: string, delta: number, method?: string) => {
    if (delta > 0 && !method) {
      // Open the method picker modal
      setInstallMethodModal({ membershipId });
      setInstallMethodValue("cash");
      return;
    }
    setInstallmentAdjustingId(membershipId + (delta > 0 ? "_inc" : "_dec"));
    try {
      await apiFetch(`/commerce/admin/user-offers/${membershipId}/adjust-installments`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, method }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setInstallmentAdjustingId(null);
    }
  };

  const downloadExcel = async (url: string, filename: string) => {
    const headers = getAuthHeader() as Record<string, string> | undefined;
    const fullUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `${API_BASE_URL}${url}`;
    const res = await fetch(fullUrl, { headers });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const [overrideSavingId, setOverrideSavingId] = useState<string | null>(null);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string | null>(null);
  const [customCooldownDates, setCustomCooldownDates] = useState<Record<string, string>>({});

  const handleUpdateBookingOverride = async (uoId: string, payload: { bookingOverrideUnlocked?: boolean | null; bookingCooldownEndOverrideAt?: string | null }) => {
    setOverrideSavingId(uoId);
    setOverrideSuccessMsg(null);
    try {
      await apiFetch(`/commerce/admin/user-offers/${uoId}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });
      invalidateCache("/me");
      invalidateCache("/commerce");
      invalidateCache("/offers");
      const targetUserId = user.id || displayUser?.id || profile?.id || profile?.user?.id;
      if (targetUserId) {
        const updated = await apiFetch(`/users/admin/${targetUserId}/profile`, { headers: getAuthHeader() });
        setProfile(updated);
      }
      setOverrideSuccessMsg(
        payload.bookingOverrideUnlocked
          ? (ar() ? "✓ تم فتح زر الحجز فوراً للعميل بنجاح!" : "✓ Booking button unlocked immediately for customer!")
          : payload.bookingCooldownEndOverrideAt === null
          ? (ar() ? "✓ تم استعادة الضوابط الافتراضية!" : "✓ Reset to default rules!")
          : (ar() ? "✓ تم تحديث تاريخ الحجز بنجاح!" : "✓ Rebook date updated successfully!")
      );
      setTimeout(() => setOverrideSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to update booking override");
    } finally {
      setOverrideSavingId(null);
    }
  };

  const allTabs: { key: ProfileTab; label: string; labelAr: string }[] = [
    { key: "overview", label: "Overview", labelAr: "نظرة عامة" },
    { key: "memberships", label: "Memberships", labelAr: "العضويات" },
    { key: "cashback", label: "Cashback", labelAr: "الكاش باك" },
    { key: "booking_button", label: "Booking Button", labelAr: "حالة زر الحجز" },
    { key: "sessions", label: "Sessions", labelAr: "الجلسات" },
    { key: "payments", label: "Payments", labelAr: "الدفعات" },
    { key: "kyc", label: "KYC / Civil ID", labelAr: "الهوية" },
    { key: "notes", label: "Notes", labelAr: "الملاحظات" },
    { key: "recovery", label: "Account Recovery", labelAr: "استعادة الحساب" },
  ];

  const tabs = allTabs.filter(t => {
    if (t.key === "notes" || t.key === "payments" || t.key === "recovery" || t.key === "booking_button") return isAdmin || isFinance || isCS;
    return true;
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-50 text-emerald-700",
      pending_payment: "bg-amber-50 text-amber-700",
      expired: "bg-surface-100 text-surface-500",
      cancelled: "bg-red-50 text-red-600",
      reserved: "bg-blue-50 text-blue-700",
      enet_pending: "bg-purple-50 text-purple-700",
      enet_rejected: "bg-red-50 text-red-600",
      completed: "bg-emerald-50 text-emerald-700",
      scheduled: "bg-blue-50 text-blue-700",
      no_show: "bg-red-50 text-red-600",
    };
    return map[s] ?? "bg-surface-100 text-surface-600";
  };

  const payStatusBadge = (s: string) => {
    if (s === "completed") return "bg-emerald-50 text-emerald-700";
    if (s === "pending") return "bg-amber-50 text-amber-700";
    if (s === "failed") return "bg-red-50 text-red-600";
    return "bg-surface-100 text-surface-600";
  };

  const fmt = (d?: string) => fmtDate(d);

  return (
    <div className="card-elevated animate-slide-up relative bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-white border-b border-surface-100 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-xl shrink-0">
          {(displayUser.fullName || displayUser.name || displayUser.username || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editingFullName ? (
              <div className="flex items-center gap-2">
                <input type="text" className="input-field py-0.5 px-2 text-sm h-8 w-48" value={editingFullNameValue} onChange={e => setEditingFullNameValue(e.target.value)} />
                <button className="btn-primary btn-sm px-3 text-xs py-1 h-8" onClick={() => handleUpdateFullName()}>OK</button>
                <button className="btn-secondary btn-sm px-2 text-xs py-1 h-8" onClick={() => setEditingFullName(false)}>X</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-surface-900">{displayUser.fullName || displayUser.name || displayUser.username || displayUser.phone || "—"}</h2>
                {(isAdmin || isCS) && (
                  <button className="text-surface-400 hover:text-brand-pink-600 transition-colors" title="Edit Name" onClick={() => { setEditingFullName(true); setEditingFullNameValue(displayUser.fullName || displayUser.name || displayUser.username || ""); }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                )}
              </div>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[displayUser.role] ?? "bg-surface-100 text-surface-600"}`}>{displayUser.role}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${userIsActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {userIsActive ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {displayUser.username && (
              <span className="text-xs text-surface-400">@{displayUser.username}</span>
            )}
            {displayUser.phone && displayUser.phone !== "—" && (
              <span className="text-xs text-surface-400">{displayUser.phone}</span>
            )}
            <span className="text-xs text-surface-300 font-mono">{displayUser.id}</span>
          </div>
          {displayUser.referredByUsername && (
            <div className="text-xs text-brand-pink-500 mt-1">↩ {ar() ? "أُحيل بواسطة" : "Referred by"} @{displayUser.referredByUsername}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(isAdmin || isFinance || isCS) && (
            <button
              className="btn-secondary btn-sm flex items-center gap-1.5 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
              onClick={() => void downloadExcel(`/users/admin/${user.id}/export`, `user_${user.name}_report.xlsx`)}
              title={ar() ? "تصدير إكسل" : "Export Excel"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel
            </button>
          )}
          <button
            className="text-surface-400 hover:text-surface-900 bg-white hover:bg-surface-100 border border-surface-200 p-1.5 rounded-full"
            onClick={onClose}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-surface-100 bg-white px-4 gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? "border-brand-pink-500 text-brand-pink-600" : "border-transparent text-surface-500 hover:text-surface-900"}`}
          >
            {ar() ? t.labelAr : t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 max-h-[60vh] overflow-y-auto">
        {profileLoading && (
          <div className="py-10 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-brand-pink-200 border-t-brand-pink-500 animate-spin" /></div>
        )}
        {profileError && (
          <div className="py-6 text-center text-red-600 text-sm">{profileError}</div>
        )}

        {!profileLoading && profile && (
          <>
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                    <div className="text-2xl font-black text-brand-pink-600">{profile.memberships?.length ?? 0}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5 uppercase font-bold">{ar() ? "عضويات" : "Memberships"}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                    <div className="text-2xl font-black text-emerald-600">{profile.sessions?.length ?? 0}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5 uppercase font-bold">{ar() ? "جلسات" : "Sessions"}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                    <div className="text-2xl font-black text-amber-500">{parseFloat(profile.wallet?.unlockedKwd ?? "0").toFixed(3)}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5 uppercase font-bold">{ar() ? "كاش باك" : "Cashback KWD"}</div>
                  </div>
                </div>
                {/* Membership card */}
                {user.role === "customer" && <AdminCustomerCard userId={user.id} />}
                {/* Role change (admin or CS) */}
                {(isAdmin || isCS) && (
                  <div className="bg-white rounded-xl p-4 border border-surface-200">
                    <div className="text-xs font-bold text-surface-500 uppercase mb-2">{ar() ? "تغيير الدور" : "Change Role"}</div>
                    <div className="flex gap-2 flex-wrap">
                      <select className="input-field flex-1 min-w-[140px]" value={pendingRole} onChange={e => setPendingRole(e.target.value)}>
                        {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn-primary px-4 disabled:opacity-50" disabled={roleChanging || pendingRole === user.role} onClick={() => void handleRoleSave()}>
                        {roleChanging ? "…" : (ar() ? "حفظ" : "Save")}
                      </button>
                    </div>
                    {roleSaveError && <div className="text-xs text-red-600 mt-1">{roleSaveError}</div>}
                  </div>
                )}
                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {(isAdmin || isCS) && (
                    <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={onLoginAs}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                      {ar() ? "دخول كـ مستخدم" : "Login As User"}
                    </button>
                  )}
                  {(isAdmin || isCS) && (
                    <button
                      className={`btn-secondary btn-sm disabled:opacity-50 ${userIsActive ? "text-red-500 hover:bg-red-50 hover:border-red-200" : "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"}`}
                      disabled={statusSaving}
                      onClick={() => void handleStatusToggle()}
                    >
                      {statusSaving ? "…" : userIsActive ? (ar() ? "تعطيل" : "Disable") : (ar() ? "تفعيل" : "Enable")}
                    </button>
                  )}
                  {(isAdmin || isCS) && user.role === "customer" && (
                    <button
                      className="btn-secondary btn-sm disabled:opacity-50 text-red-600 hover:bg-red-50 hover:border-red-200"
                      onClick={async () => {
                        if (!window.confirm(ar() ? "هل أنت متأكد أنك تريد حذف هذا العميل وجميع بياناته بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to permanently delete this customer and all their associated data? This action cannot be undone.")) return;
                        try {
                          await apiFetch(`/users/${user.id}/all-data`, { method: "DELETE", headers: getAuthHeader() });
                          alert(ar() ? "تم الحذف بنجاح" : "Customer and data deleted successfully.");
                          window.location.reload();
                        } catch (err: any) {
                          alert(err.message || "Failed to delete user data");
                        }
                      }}
                    >
                      {ar() ? "حذف العميل والبيانات" : "Delete Customer & All Data"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── BOOKING BUTTON STATUS & OVERRIDES ── */}
            {tab === "booking_button" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-brand-pink-50 to-purple-50 border border-brand-pink-100 rounded-xl p-4">
                  <h4 className="font-bold text-surface-900 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 text-brand-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {ar() ? "التحكم في زر حجز المواعيد للعميل" : "Customer Booking Appointment Button Controls"}
                  </h4>
                  <p className="text-xs text-surface-600 mt-1 leading-relaxed">
                    {ar() 
                      ? "عرض حالة زر الحجز الحالية على لوحة العميل لكل عضوية، ويمكنك فتح الزر فوراً أو تعديل تاريخ التبريد حسب رغبتك." 
                      : "View the real-time booking button status on the customer's dashboard for each membership, and instantly unlock or change the rebook cooldown date."}
                  </p>
                </div>

                {overrideSuccessMsg && (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {overrideSuccessMsg}
                    </span>
                    <button type="button" onClick={() => setOverrideSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">✕</button>
                  </div>
                )}

                {profile?.memberships?.length === 0 ? (
                  <div className="text-sm text-surface-400 text-center py-8 bg-white rounded-xl border border-surface-100">
                    {ar() ? "لا توجد عضويات لهذا العميل" : "No memberships for this customer"}
                  </div>
                ) : (
                  profile?.memberships?.map((m: any) => {
                    const isPending = m.status === "pending_payment" || m.status === "pending payment";
                    const isInstallment = m.purchaseMode === "installments" || m.method === "Installments";
                    const paidInst = m.paidInstallments || m.installmentsPaid || 0;
                    const sessionsUsed = m.sessionsUsed || 0;
                    const sessionIntervalDays = m.sessionIntervalDays || 0;
                    const lastCompleted = m.lastCompletedSessionAt ? new Date(m.lastCompletedSessionAt) : null;
                    const hasActiveBooking = m.hasActiveBooking;

                    const isOverrideUnlocked = !!m.bookingOverrideUnlocked;
                    const cooldownOverrideAt = m.bookingCooldownEndOverrideAt ? new Date(m.bookingCooldownEndOverrideAt) : null;

                    let statusType: "unlocked" | "cooldown" | "installment" | "active_booking" | "pending" = "unlocked";
                    let displayStatusText = ar() ? "حجز موعد (مفتوح)" : "Book Appointment (Unlocked)";
                    let rebookDateStr = "";

                    if (isOverrideUnlocked) {
                      statusType = "unlocked";
                      displayStatusText = ar() ? "مفتوح فوراً (تجاوز الإدارة)" : "Unlocked Immediately (Admin Override)";
                    } else if (cooldownOverrideAt && new Date() < cooldownOverrideAt) {
                      statusType = "cooldown";
                      rebookDateStr = fmtDate(cooldownOverrideAt);
                      displayStatusText = ar() ? `مغلق — إعادة الحجز في ${rebookDateStr}` : `Locked — Rebook at ${rebookDateStr}`;
                    } else if (sessionIntervalDays > 0 && lastCompleted) {
                      const nextEligible = new Date(lastCompleted.getTime() + sessionIntervalDays * 24 * 60 * 60 * 1000);
                      if (new Date() < nextEligible) {
                        statusType = "cooldown";
                        rebookDateStr = fmtDate(nextEligible);
                        displayStatusText = ar() ? `مغلق — إعادة الحجز في ${rebookDateStr}` : `Locked — Rebook at ${rebookDateStr}`;
                      }
                    }

                    if (statusType !== "cooldown" && !isOverrideUnlocked) {
                      if (isPending) {
                        statusType = "pending";
                        displayStatusText = ar() ? "مغلق — بانتظار تأكيد الدفع" : "Locked — Awaiting Payment";
                      } else if (hasActiveBooking) {
                        statusType = "active_booking";
                        displayStatusText = ar() ? "مغلق — يوجد حجز قيد المعالجة" : "Locked — Active booking in progress";
                      } else if (isInstallment) {
                        if (paidInst === 0) {
                          statusType = "installment";
                          displayStatusText = ar() ? "مغلق — يجب دفع القسط الأول" : "Locked — First installment required";
                        } else if (paidInst < (m.installmentCount || 1) && sessionsUsed >= paidInst) {
                          statusType = "installment";
                          displayStatusText = ar() ? "مغلق — يجب دفع القسط التالي" : "Locked — Next installment required";
                        }
                      }
                    }

                    return (
                      <div key={m.id} className="bg-white rounded-xl border border-surface-200 p-5 shadow-sm space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 pb-3">
                          <div>
                            <h5 className="font-bold text-surface-900 text-base">{ar() && m.offerNameAr ? m.offerNameAr : (m.offerName || "Membership")}</h5>
                            <div className="text-xs text-surface-500 font-mono mt-0.5">ID: {m.id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              statusType === "unlocked" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {displayStatusText}
                            </span>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-50 p-3 rounded-lg text-xs">
                          <div>
                            <span className="text-surface-500 block">{ar() ? "الجلسات المستخدمة" : "Sessions Used"}</span>
                            <span className="font-bold text-surface-900">{m.sessionsUsed} {m.maxSessions ? `/ ${m.maxSessions}` : "(غير محدود)"}</span>
                          </div>
                          <div>
                            <span className="text-surface-500 block">{ar() ? "آخر جلسة مكتملة" : "Last Completed Session"}</span>
                            <span className="font-bold text-surface-900">{m.lastCompletedSessionAt ? fmtDate(new Date(m.lastCompletedSessionAt)) : "—"}</span>
                          </div>
                          <div>
                            <span className="text-surface-500 block">{ar() ? "فترة التبريد" : "Cooling Interval"}</span>
                            <span className="font-bold text-surface-900">{m.sessionIntervalDays ? `${m.sessionIntervalDays} days` : "None"}</span>
                          </div>
                          <div>
                            <span className="text-surface-500 block">{ar() ? "تاريخ التبريد الحالي" : "Current Rebook Date"}</span>
                            <span className="font-bold text-surface-900">{rebookDateStr || (isOverrideUnlocked ? (ar() ? "مفتوح فوراً" : "Unlocked Now") : "Immediate")}</span>
                          </div>
                        </div>

                        {/* Admin Override Action Controls */}
                        <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3">
                          <div className="text-xs font-bold text-surface-800 uppercase tracking-wide flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {ar() ? "إجراءات التحكم والفتح" : "Admin Override Controls"}
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {/* 1. Unlock Immediately */}
                            <button
                              type="button"
                              disabled={overrideSavingId === m.id}
                              onClick={() => handleUpdateBookingOverride(m.id, { bookingOverrideUnlocked: true, bookingCooldownEndOverrideAt: null })}
                              className={`btn-sm font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all ${
                                isOverrideUnlocked 
                                  ? "bg-emerald-600 text-white shadow-sm" 
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                              {isOverrideUnlocked ? (ar() ? "✓ مفتوح فوراً" : "✓ Unlocked Immediately") : (ar() ? "فتح الزر فوراً" : "Unlock Immediately")}
                            </button>

                            {/* 2. Custom Date Picker */}
                            <div className="flex items-center gap-2">
                              <div className="w-36">
                                <DatePicker
                                  value={customCooldownDates[m.id] ?? (m.bookingCooldownEndOverrideAt ? m.bookingCooldownEndOverrideAt.split("T")[0] : "")}
                                  onChange={e => setCustomCooldownDates(prev => ({ ...prev, [m.id]: e.target.value }))}
                                  className="input-field text-xs py-1.5 px-2 bg-white"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={overrideSavingId === m.id || !customCooldownDates[m.id]}
                                onClick={() => handleUpdateBookingOverride(m.id, { bookingOverrideUnlocked: false, bookingCooldownEndOverrideAt: customCooldownDates[m.id] })}
                                className="btn-secondary btn-sm text-xs py-2 px-3 font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                              >
                                {ar() ? "تعديل التاريخ" : "Change Date"}
                              </button>
                            </div>

                            {/* 3. Reset to Default */}
                            {(isOverrideUnlocked || m.bookingCooldownEndOverrideAt) && (
                              <button
                                type="button"
                                disabled={overrideSavingId === m.id}
                                onClick={() => handleUpdateBookingOverride(m.id, { bookingOverrideUnlocked: false, bookingCooldownEndOverrideAt: null })}
                                className="text-xs font-bold text-surface-600 hover:text-red-600 px-3 py-2 rounded-lg bg-surface-100 hover:bg-red-50 transition-colors ml-auto"
                              >
                                {ar() ? "إعادة الضوابط الافتراضية" : "Reset to Default Rules"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── MEMBERSHIPS ── */}
            {tab === "memberships" && (
              <div className="space-y-3">
                {/* Grant Membership (admin or CS) */}
                {(isAdmin || isCS) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs font-bold text-emerald-800 uppercase">{ar() ? "منح عضوية" : "Grant Membership"}</div>
                      <button type="button" onClick={addGrantEnrollmentRow} className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        {ar() ? "إضافة باقة أخرى" : "Add Another"}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {grantEnrollments.map((en, idx) => (
                        <div key={idx} className="relative bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden p-4">
                          {grantEnrollments.length > 1 && (
                            <button type="button" onClick={() => removeGrantEnrollmentRow(idx)} className="absolute top-3 rtl:left-3 ltr:right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors z-10" title={ar() ? "إزالة" : "Remove"}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "اختيار باقة/جلسة" : "Select Offer/Session"}</label>
                              <select className="select-field w-full bg-surface-50" value={en.offerId} onChange={e => updateGrantEnrollment(idx, { offerId: e.target.value })}>
                                <option value="">{ar() ? "-- بدون اشتراك --" : "-- No Membership --"}</option>
                                {allOffers.map((o: any) => <option key={o.id || o._id} value={o.id || o._id}>{ar() ? o.nameAr || o.name : o.name}</option>)}
                              </select>
                            </div>
                            {en.offerId && (
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العيادة (إن وجدت)" : "Clinic (if applicable)"}</label>
                                <select className="select-field w-full bg-surface-50" value={en.clinicId} onChange={e => updateGrantEnrollment(idx, { clinicId: e.target.value })}>
                                  <option value="">{ar() ? "غير محدد" : "None"}</option>
                                  {allClinics.map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          
                          {en.offerId && (
                            <div className="pt-4 mt-4 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "نوع الدفع" : "Purchase Mode"}</label>
                                <select className="select-field w-full" value={en.purchaseMode} onChange={e => updateGrantEnrollment(idx, { purchaseMode: e.target.value })}>
                                  <option value="full">{ar() ? "دفع كامل" : "Full Payment"}</option>
                                  <option value="installments">{ar() ? "أقساط" : "Installments"}</option>
                                  <option value="deposit">{ar() ? "عربون" : "Deposit"}</option>
                                  <option value="free">{ar() ? "عضوية مجانية" : "Free Membership"}</option>
                                  <option value="discount">{ar() ? "خصم خاص" : "Discount"}</option>
                                </select>
                              </div>
                              {en.purchaseMode === "installments" && (
                                <div>
                                  <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "عدد الأقساط" : "Installment Count"}</label>
                                  <select className="select-field w-full" value={en.installmentCount} onChange={e => updateGrantEnrollment(idx, { installmentCount: Number(e.target.value) })}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </div>
                              )}
                              {en.purchaseMode !== "installments" ? (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "المبلغ المدفوع (KWD)" : "Amount Paid (KWD)"}</label>
                                    <input 
                                      type="number" step="0.001" min="0"
                                      className="input-field w-full font-mono text-emerald-700 font-bold"
                                      value={en.amountPaidKwd}
                                      onChange={e => updateGrantEnrollment(idx, { amountPaidKwd: e.target.value })}
                                      disabled={en.purchaseMode === "free"}
                                      placeholder="0.000" 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"}</label>
                                    <select className="select-field w-full" value={en.method} onChange={e => updateGrantEnrollment(idx, { method: e.target.value })}>
                                      <option value="cash">{ar() ? "الدفع في العيادة" : "Paid in Clinic"}</option>
                                      <option value="pos">POS</option>
                                      <option value="bank_transfer">{ar() ? "رابط دفع خارجي" : "External Payment Link"}</option>
                                      <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
                                      <option value="enet">ENET</option>
                                      <option value="wallet">{ar() ? "محفظة كاش باك" : "Cashback Wallet"}</option>
                                      <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                    </select>
                                  </div>
                                </>
                              ) : (
                                <div className="sm:col-span-2 mt-2 space-y-3">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جدول الأقساط" : "Installment Schedule"}</label>
                                  <div className="bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                      <thead className="bg-surface-50 border-b border-surface-200 text-xs text-surface-500 uppercase">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold">#</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "المبلغ" : "Amount (KWD)"}</th>
                                          <th className="px-3 py-2 font-semibold text-center">{ar() ? "مدفوع؟" : "Paid?"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "الطريقة" : "Method"}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-surface-100">
                                        {(en.customInstallments || []).map((inst: any, iIdx: number) => (
                                          <tr key={iIdx}>
                                            <td className="px-3 py-2 font-bold text-surface-500">{iIdx + 1}</td>
                                            <td className="px-3 py-2">
                                              <DatePicker className="input-field text-xs py-1 px-2 w-full min-w-[110px]" value={inst.dueDate} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].dueDate = e.target.value;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <input type="number" step="0.001" className="input-field text-xs py-1 px-2 w-full min-w-[80px]" value={inst.amountKwd} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].amountKwd = e.target.value;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded" checked={inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].isPaid = e.target.checked;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <select className="select-field text-xs py-1 px-2 w-full min-w-[100px]" value={inst.method} disabled={!inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].method = e.target.value;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }}>
                                                <option value="cash">{ar() ? "في العيادة" : "In Clinic"}</option>
                                                <option value="pos">POS</option>
                                                <option value="bank_transfer">{ar() ? "رابط دفع" : "Pay Link"}</option>
                                                <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
                                              </select>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              
                              <div className="sm:col-span-2 mt-4 pt-4 border-t border-surface-100">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جلسات سابقة (تاريخية)" : "Historical Sessions"}</label>
                                  <button type="button" onClick={() => {
                                    const newEn = [...grantEnrollments];
                                    if (!newEn[idx].historicalSessions) newEn[idx].historicalSessions = [];
                                    newEn[idx].historicalSessions.push({ date: new Date().toISOString().split('T')[0] });
                                    setGrantEnrollments(newEn);
                                  }} className="text-xs font-bold text-brand-pink-600 hover:underline">
                                    + {ar() ? "إضافة جلسة سابقة" : "Add Past Session"}
                                  </button>
                                </div>
                                <p className="text-[10px] text-surface-500 mb-3 leading-relaxed">{ar() ? "استخدم هذا الخيار لتسجيل الجلسات التي تمت بالفعل في النظام القديم، سيتم خصمها من الباقة واحتساب فترة التبريد (التأخير بين الجلسات) بناءً عليها حتى يتم قفل الحجز لحين انتهاء المدة." : "Log sessions that were already done in a previous system. This will deduct from the package quota and trigger the cooling interval to lock future bookings until the time elapses."}</p>
                                
                                {en.historicalSessions && en.historicalSessions.length > 0 && (
                                  <div className="space-y-2">
                                    {en.historicalSessions.map((hs: any, hsIdx: number) => (
                                      <div key={hsIdx} className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-surface-400 w-6">{hsIdx + 1}.</div>
                                        <DatePicker className="input-field text-xs py-1" value={hs.date} onChange={e => {
                                          const newEn = [...grantEnrollments];
                                          newEn[idx].historicalSessions[hsIdx].date = e.target.value;
                                          setGrantEnrollments(newEn);
                                        }} />
                                        <button type="button" onClick={() => {
                                          const newEn = [...grantEnrollments];
                                          newEn[idx].historicalSessions.splice(hsIdx, 1);
                                          setGrantEnrollments(newEn);
                                        }} className="text-red-500 hover:text-red-700 p-1">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                      <button
                        className="btn-primary"
                        disabled={grantSaving}
                        onClick={() => void handleGrantMembership()}
                      >
                        {grantSaving ? "…" : (ar() ? "حفظ باقات العضوية" : "Grant Memberships")}
                      </button>
                      {grantError && <div className="text-xs text-red-600">{grantError}</div>}
                      {grantSuccess && <div className="text-xs text-emerald-700 font-medium">✓ {ar() ? "تم منح العضوية بنجاح" : "Membership granted successfully"}</div>}
                    </div>
                  </div>
                )}

                {profile.memberships?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد عضويات" : "No memberships"}</div>}
                {profile.memberships?.map((m: any) => {
                  const sessionsLeft = m.maxSessions != null ? m.maxSessions - m.sessionsUsed : null;
                  return (
                    <div key={m.id} className="bg-white rounded-xl border border-surface-100 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-bold text-surface-900 text-sm">{ar() && m.offerNameAr ? m.offerNameAr : m.offerName}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <svg className="w-3.5 h-3.5 text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            {editingClinicId === m.id ? (
                              <div className="flex items-center gap-1">
                                <select className="select-field py-0.5 px-1.5 text-xs h-7 min-w-[120px]" value={editingClinicValue} onChange={e => setEditingClinicValue(e.target.value)}>
                                  <option value="">{ar() ? "لا يوجد" : "None"}</option>
                                  {allClinics.map((c: any) => (
                                    <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>
                                  ))}
                                </select>
                                <button className="btn-primary btn-sm px-2 text-xs py-1 h-7" onClick={() => void handleUpdateClinic(m.id)}>OK</button>
                                <button className="btn-secondary btn-sm px-2 text-xs py-1 h-7" onClick={() => setEditingClinicId(null)}>X</button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-semibold text-surface-600">{(m.clinicNameEn || m.clinicNameAr) ? (ar() ? (m.clinicNameAr || m.clinicNameEn) : (m.clinicNameEn || m.clinicNameAr)) : (ar() ? "لم يحدد" : "Not set")}</span>
                                {(isAdmin || isCS || isFinance) && (
                                  <button className="bg-surface-100 text-surface-600 hover:bg-brand-pink-50 hover:text-brand-pink-600 p-1 rounded-md border border-surface-200 shadow-sm transition-all flex items-center justify-center" title="Edit Clinic" onClick={() => { setEditingClinicId(m.id); setEditingClinicValue(m.clinicId || ""); }}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-xs text-surface-400 font-mono mt-0.5">{m.id}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadge(m.status)}`}>{m.status}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3">
                        {(isAdmin || isCS || isFinance) && (
                          <div><span className="text-surface-400">{ar() ? "نوع الشراء" : "Mode"}</span><div className="font-bold mt-0.5">{m.purchaseMode ?? "—"}</div></div>
                        )}
                        <div>
                          <span className="text-surface-400">{ar() ? "جلسات مستخدمة" : "Sessions Used"}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {(isAdmin || isCS || isFinance) && (
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-red-100 hover:text-red-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                                disabled={sessionAdjustingId !== null || m.sessionsUsed <= 0}
                                onClick={() => handleAdjustSessions(m.id, -1)}
                                title={ar() ? "تقليل" : "Decrement"}
                              >−</button>
                            )}
                            <span className="font-bold">{m.sessionsUsed}</span>
                            {(isAdmin || isCS || isFinance) && (
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-emerald-100 hover:text-emerald-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                                disabled={sessionAdjustingId !== null}
                                onClick={() => handleAdjustSessions(m.id, +1)}
                                title={ar() ? "زيادة" : "Increment"}
                              >+</button>
                            )}
                          </div>
                        </div>
                        {m.maxSessions != null && (
                          <div>
                            <span className="text-surface-400">{ar() ? "جلسات متبقية" : "Sessions Left"}</span>
                            <div className={`font-bold mt-0.5 ${sessionsLeft != null && sessionsLeft <= 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {sessionsLeft != null ? sessionsLeft : "—"} / {m.maxSessions}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-surface-400">{ar() ? "الأقساط المدفوعة" : "Installments Paid"}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {(isAdmin || isCS || isFinance) && (
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-red-100 hover:text-red-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                                disabled={installmentAdjustingId !== null || (m.installmentsPaid ?? 0) <= 0}
                                onClick={() => handleAdjustInstallments(m.id, -1)}
                                title={ar() ? "تقليل" : "Decrement"}
                              >−</button>
                            )}
                            <span className="font-bold">{m.installmentsPaid}</span>
                            {(isAdmin || isCS || isFinance) && (
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-emerald-100 hover:text-emerald-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                                disabled={installmentAdjustingId !== null}
                                onClick={() => handleAdjustInstallments(m.id, +1)}
                                title={ar() ? "زيادة" : "Increment"}
                              >+</button>
                            )}
                            <span className="text-surface-400 text-sm">/ {m.installmentCount ?? "—"}</span>
                          </div>
                        </div>
                        {(isAdmin || isCS || isFinance) && (
                          <div><span className="text-surface-400">{ar() ? "المبلغ (د.ك)" : "Amount (KWD)"}</span><div className="font-bold mt-0.5">{m.paymentAmountKwd ?? "—"}</div></div>
                        )}
                        <div>
                          <span className="text-surface-400">{ar() ? "التفعيل" : "Activated"}</span>
                          {editingDateId === `${m.id}_activatedAt` ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <DatePicker className="input-field py-0.5 px-1.5 text-xs h-7 w-28" value={editingDateValue} onChange={e => setEditingDateValue(e.target.value)} />
                              <button className="btn-primary btn-sm px-2 text-xs py-1 h-7" onClick={() => handleUpdateDate(m.id, "activatedAt")}>OK</button>
                              <button className="btn-secondary btn-sm px-2 text-xs py-1 h-7" onClick={() => setEditingDateId(null)}>X</button>
                            </div>
                          ) : (
                            <div className="font-bold mt-0.5 flex items-center gap-2">
                              {fmt(m.activatedAt)}
                              {(isAdmin || isCS || isFinance) && (
                                <button className="bg-surface-100 text-surface-600 hover:bg-brand-pink-50 hover:text-brand-pink-600 p-1.5 rounded-md border border-surface-200 shadow-sm transition-all flex items-center justify-center" title="Edit Date" onClick={() => { setEditingDateId(`${m.id}_activatedAt`); setEditingDateValue(m.activatedAt ? new Date(m.activatedAt).toISOString().split('T')[0] : ""); }}>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-surface-400">{ar() ? "الانتهاء" : "Expires"}</span>
                          {editingDateId === `${m.id}_expiresAt` ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <DatePicker className="input-field py-0.5 px-1.5 text-xs h-7 w-28" value={editingDateValue} onChange={e => setEditingDateValue(e.target.value)} />
                              <button className="btn-primary btn-sm px-2 text-xs py-1 h-7" onClick={() => handleUpdateDate(m.id, "expiresAt")}>OK</button>
                              <button className="btn-secondary btn-sm px-2 text-xs py-1 h-7" onClick={() => setEditingDateId(null)}>X</button>
                            </div>
                          ) : (
                            <div className="font-bold mt-0.5 flex items-center gap-2">
                              {fmt(m.expiresAt)}
                              {(isAdmin || isCS || isFinance) && (
                                <button className="bg-surface-100 text-surface-600 hover:bg-brand-pink-50 hover:text-brand-pink-600 p-1.5 rounded-md border border-surface-200 shadow-sm transition-all flex items-center justify-center" title="Edit Date" onClick={() => { setEditingDateId(`${m.id}_expiresAt`); setEditingDateValue(m.expiresAt ? new Date(m.expiresAt).toISOString().split('T')[0] : ""); }}>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div><span className="text-surface-400">{ar() ? "تاريخ الإنشاء" : "Created"}</span><div className="font-bold mt-0.5">{fmt(m.createdAt)}</div></div>
                        {(isAdmin || isCS || isFinance) && m.purchaseMode === "installments" && m.installmentSchedule && m.installmentSchedule.some((i: any) => !i.paid) && (
                          <div className="sm:col-span-4 mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-amber-700 font-bold">{ar() ? "المبلغ المتبقي (غير مدفوع)" : "Unpaid Amount Left"}</span>
                              <div className="text-lg font-black text-amber-600">
                                {m.installmentSchedule.filter((i: any) => !i.paid).reduce((sum: number, i: any) => sum + parseFloat(i.amountKwd || "0"), 0).toFixed(3)} KWD
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-amber-700 font-bold">{ar() ? "تواريخ الاستحقاق القادمة" : "Upcoming Due Dates"}</span>
                              <div className="text-xs font-bold text-amber-600 mt-0.5">
                                {m.installmentSchedule.filter((i: any) => !i.paid).map((i: any) => fmt(i.dueDate)).join(" • ")}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {(isAdmin || isCS || isFinance) && (
                        <div className="mt-4 pt-3 border-t border-surface-100 flex justify-end gap-2">
                          {m.status !== "active" && (
                            <button
                              onClick={async () => {
                                const confirmReactivate = window.confirm(
                                  ar()
                                    ? "هل أنت متأكد من إعادة تفعيل هذه العضوية؟"
                                    : "Are you sure you want to reactivate this membership?"
                                );
                                if (!confirmReactivate) return;
                                try {
                                  await apiFetch(`/commerce/admin/user-offers/${m.id}`, {
                                    method: "PATCH",
                                    headers: getAuthHeader(),
                                    body: JSON.stringify({ status: "active" })
                                  });
                                  const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
                                  setProfile(d);
                                  alert(ar() ? "تم إعادة تفعيل العضوية بنجاح" : "Membership reactivated successfully");
                                } catch (e: any) {
                                  alert(e.message || "Failed to reactivate membership");
                                }
                              }}
                              className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors border border-emerald-200"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              {ar() ? "إعادة تفعيل العضوية" : "Reactivate Membership"}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const confirmCancel = window.confirm(
                                ar()
                                  ? "هل أنت متأكد من حذف هذه العضوية؟"
                                  : "Are you sure you want to delete this membership?"
                              );
                              if (!confirmCancel) return;
                              try {
                                await apiFetch(`/commerce/admin/user-offers/${m.id}`, {
                                  method: "DELETE",
                                  headers: getAuthHeader()
                                });
                                const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
                                setProfile(d);
                              } catch (e: any) {
                                alert(e.message || "Failed to cancel membership");
                              }
                            }}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            {ar() ? "حذف العضوية" : "Delete Membership"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── CASHBACK ── */}
            {tab === "cashback" && (
              <div className="space-y-4">
                {/* Balance summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: ar() ? "الرصيد المتاح" : "Unlocked", val: profile.wallet?.unlockedKwd ?? "—", cls: "text-emerald-600" },
                    { label: ar() ? "الرصيد المقفل" : "Locked", val: profile.wallet?.lockedKwd ?? "—", cls: "text-amber-600" },
                    { label: ar() ? "الحد الأقصى" : "Ceiling", val: profile.wallet?.ceilingKwd ?? "—", cls: "text-surface-700" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                      <div className={`text-xl font-black ${item.cls}`}>{item.val}</div>
                      <div className="text-[10px] text-surface-500 uppercase font-bold mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Add / Remove cashback (admin or CS) */}
                {(isAdmin || isCS) && (
                  <div className="bg-white rounded-xl border border-surface-200 p-4">
                    <div className="text-xs font-bold text-surface-700 uppercase mb-3">{ar() ? "تعديل الكاش باك" : "Adjust Cashback"}</div>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder={ar() ? "المبلغ (د.ك)" : "Amount KWD"}
                        className="input-field flex-1 min-w-[120px]"
                        value={cashAmt}
                        onChange={e => setCashAmt(e.target.value)}
                      />
                      {(isAdmin || isCS) && (
                        <input
                          type="text"
                          placeholder={ar() ? "السبب (مطلوب)" : "Reason (required)"}
                          className="input-field flex-1 min-w-[160px]"
                          value={cashReason}
                          onChange={e => setCashReason(e.target.value)}
                        />
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {(isAdmin || isCS) && (
                        <button className="btn-primary btn-sm flex-1 disabled:opacity-50" disabled={cashSaving} onClick={() => void handleCashbackAdjust(1)}>
                          {cashSaving ? "…" : (ar() ? "+ إضافة" : "+ Add")}
                        </button>
                      )}
                      <button className="btn-secondary btn-sm flex-1 text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50" disabled={cashSaving} onClick={() => void handleCashbackAdjust(-1)}>
                        {cashSaving ? "…" : (ar() ? "- خصم" : "- Deduct")}
                      </button>
                    </div>
                    {cashError && <div className="text-xs text-red-600 mt-2">{cashError}</div>}
                  </div>
                )}

                {/* Transaction history */}
                <div className="bg-white rounded-xl border border-surface-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-100 text-xs font-bold text-surface-700 uppercase">{ar() ? "سجل المعاملات" : "Transaction History"}</div>
                  {!profile.wallet?.txns?.length && <div className="p-6 text-center text-sm text-surface-400">{ar() ? "لا توجد معاملات" : "No transactions"}</div>}
                  {profile.wallet?.txns?.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 border-b border-surface-50 last:border-0">
                      <div>
                        <div className="text-xs font-bold text-surface-900">{t.type}</div>
                        <div className="text-[10px] text-surface-400">{t.reason ?? "—"} · {fmt(t.createdAt)}</div>
                      </div>
                      <div className={`text-sm font-black tabular-nums ${(t.amountKwd ?? "").startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>
                        {(t.amountKwd ?? "").startsWith("-") ? "" : "+"}{t.amountKwd} KWD
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── REQUESTS ── */}
            {tab === "requests" && (
              <div className="space-y-2">
                {profile.sessions?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد طلبات" : "No requests"}</div>}
                {profile.sessions?.map((s: any) => (
                  <div key={s.id} className="bg-white rounded-xl border border-surface-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-surface-900">{ar() ? (s.offerNameAr || s.offerName) : s.offerName}</div>
                      <div className="text-xs font-mono text-surface-400 mt-0.5" title="Request ID">{s.id}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{ar() ? "تاريخ الطلب" : "Requested"}: {fmt(s.requestedAt)}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      s.status === 'completed' && s.clinicPaymentStatus !== 'paid'
                        ? 'bg-amber-50 text-amber-700'
                        : statusBadge(s.status)
                    }`}>
                      {s.status === 'completed' && s.clinicPaymentStatus !== 'paid'
                        ? 'Awaiting Session Payment'
                        : s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── SESSIONS ── */}
            {tab === "sessions" && (
              <div className="space-y-2">
                {profile.bookingSessions?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد جلسات" : "No sessions"}</div>}
                {profile.bookingSessions?.map((s: any) => (
                  <div key={s.id} className="bg-white rounded-xl border border-surface-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-surface-900 flex items-center gap-2 flex-wrap">
                        <span>{ar() ? (s.offerNameAr || s.offerName) : s.offerName}</span>
                        {String(s.id).startsWith("manual_") && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            {ar() ? "جلسة يدوية / تاريخية" : "Manual / Historical"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-surface-400 mt-0.5" title="Session ID">{s.shortId || s.id}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{ar() ? "الموعد" : "Scheduled"}: {fmt(s.scheduledAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.bookingRequestId && (isAdmin || isCS) && (s.status === "scheduled" || s.status === "completed" || s.status === "no_show") && (
                        <button
                          className="btn-secondary btn-sm flex items-center gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 shrink-0"
                          onClick={async () => {
                            const ok = window.confirm(
                              ar()
                                ? "هل أنت متأكد من إرجاع هذا الطلب إلى حالة الانتظار؟ سيتم حذف الجلسة وتقليل عدد الجلسات المستخدمة."
                                : "Are you sure you want to revert this booking back to pending? The session will be deleted and sessions used will be decremented."
                            );
                            if (!ok) return;
                            try {
                              await apiFetch(`/scheduling/admin/requests/${s.bookingRequestId}/revert`, {
                                method: "POST",
                                headers: getAuthHeader(),
                              });
                              // Refresh profile
                              const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
                              setProfile(d);
                            } catch (e: any) {
                              alert(e.message || "Failed to revert booking");
                            }
                          }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
                          </svg>
                          {ar() ? "إرجاع للانتظار" : "Revert to Pending"}
                        </button>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        s.status === 'completed' && s.clinicPaymentStatus !== 'paid' && !String(s.id).startsWith('manual_')
                          ? 'bg-amber-50 text-amber-700'
                          : statusBadge(s.status)
                      }`}>
                        {s.status === 'completed' && s.clinicPaymentStatus !== 'paid' && !String(s.id).startsWith('manual_')
                          ? 'Awaiting Session Payment'
                          : s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PAYMENTS ── */}
            {tab === "payments" && (
              <div className="space-y-2">
                {profile.payments?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد دفعات" : "No payments"}</div>}
                {profile.payments?.map((p: any) => (
                  <div key={p.id} className="bg-white rounded-xl border border-surface-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-bold text-sm text-surface-900">{p.offerName}</div>
                        <div className="text-[10px] text-surface-400 font-mono">{p.id}</div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${payStatusBadge(p.status)}`}>{p.status}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-surface-400">{ar() ? "المبلغ" : "Amount"}</span><div className="font-black text-brand-pink-600 mt-0.5">{p.amountKwd} KWD</div></div>
                      <div><span className="text-surface-400">{ar() ? "الطريقة" : "Method"}</span><div className="font-bold mt-0.5">{p.method}</div></div>
                      <div><span className="text-surface-400">{ar() ? "الغرض" : "Purpose"}</span><div className="font-bold mt-0.5">{p.purpose}</div></div>
                      <div><span className="text-surface-400">{ar() ? "القسط" : "Installment"}</span><div className="font-bold mt-0.5">{p.installmentNumber ?? "—"}</div></div>
                      <div><span className="text-surface-400">{ar() ? "كاش باك مطبق" : "Cashback Applied"}</span><div className="font-bold mt-0.5">{p.cashbackAppliedKwd ?? "0.000"} KWD</div></div>
                      <div><span className="text-surface-400">{ar() ? "تأكيد" : "Confirmed"}</span><div className="font-bold mt-0.5">{fmt(p.confirmedAt)}</div></div>
                      <div><span className="text-surface-400">{ar() ? "تاريخ الإنشاء" : "Created"}</span><div className="font-bold mt-0.5">{fmt(p.createdAt)}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── KYC ── */}
            {tab === "kyc" && (
              <div className="space-y-4">
                {!profile.kyc && (
                  <div className="text-center py-8 text-surface-400 text-sm">
                    <svg className="w-10 h-10 mx-auto mb-2 text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                    {ar() ? "لم يتم تقديم طلب KYC بعد" : "No KYC submission yet"}
                  </div>
                )}
                {profile.kyc && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-surface-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-surface-900">{ar() ? "بيانات الهوية" : "Identity Details"}</h4>
                        <div className="flex items-center gap-2">
                          {profile.kyc.status === "approved" && (
                            <button onClick={handleUnverify} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                              {ar() ? "إلغاء التوثيق" : "Unverify Account"}
                            </button>
                          )}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.kyc.status === "approved" ? "bg-emerald-50 text-emerald-700" : profile.kyc.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                            {profile.kyc.status}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-surface-500">{ar() ? "رقم الهوية المدنية (مخفي)" : "Civil ID (masked)"}</div>
                          <div className="mt-1 font-black text-surface-900 tracking-widest text-lg font-mono">{profile.kyc.civilIdNumberMasked}</div>
                        </div>
                        <div>
                          <div className="text-xs text-surface-500">{ar() ? "تاريخ التقديم" : "Submitted"}</div>
                          <div className="mt-1 font-bold text-surface-900">{fmt(profile.kyc.createdAt)}</div>
                        </div>
                        {profile.kyc.reviewedAt && (
                          <div>
                            <div className="text-xs text-surface-500">{ar() ? "تاريخ المراجعة" : "Reviewed"}</div>
                            <div className="mt-1 font-bold text-surface-900">{fmt(profile.kyc.reviewedAt)}</div>
                          </div>
                        )}
                        {profile.kyc.rejectionReason && (
                          <div className="sm:col-span-2">
                            <div className="text-xs text-surface-500">{ar() ? "سبب الرفض" : "Rejection Reason"}</div>
                            <div className="mt-1 text-sm text-red-600 font-medium">{profile.kyc.rejectionReason}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: ar() ? "صورة الهوية (الأمامية)" : "Civil ID — Front", ref: profile.kyc.civilIdFrontRef },
                        { label: ar() ? "صورة الهوية (الخلفية)" : "Civil ID — Back", ref: profile.kyc.civilIdBackRef },
                        { label: ar() ? "التوقيع" : "Signature", ref: profile.kyc.signatureRef },
                      ].filter(d => d.ref).map((doc) => (
                        <div key={doc.label} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                          <div className="px-3 py-2 border-b border-surface-100 text-xs font-bold text-surface-600">{doc.label}</div>
                          <div className="p-3">
                            <a href={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} target="_blank" rel="noreferrer" className="block w-full">
                              <img
                                src={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`}
                                alt={doc.label}
                                className="w-full h-36 object-contain rounded-lg bg-surface-50 hover:opacity-90 transition-opacity"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </a>
                            <a href={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} target="_blank" rel="noreferrer" className="text-[10px] text-surface-400 mt-1 truncate font-mono block hover:text-brand-pink-500 hover:underline">
                              {doc.ref}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES ── */}
            {tab === "notes" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                  <h4 className="font-bold text-surface-900 mb-4">{ar() ? "إضافة ملاحظة" : "Add Note"}</h4>
                  <textarea
                    className="input-field w-full h-24 p-3 mb-3 resize-none"
                    placeholder={ar() ? "اكتب ملاحظتك هنا..." : "Type your note here..."}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all disabled:opacity-50"
                      onClick={handleAddNote}
                      disabled={noteSaving || !newNote.trim()}
                    >
                      {noteSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ الملاحظة" : "Save Note")}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {profile.user.staffNotes?.length > 0 ? (
                    profile.user.staffNotes.slice().reverse().map((note: any, idx: number) => (
                      <div key={note.id || idx} className="bg-surface-50 rounded-xl p-4 border border-surface-100">
                        <div className="text-surface-800 text-sm whitespace-pre-wrap leading-relaxed">{note.text}</div>
                        <div className="flex items-center gap-2 mt-3 text-xs text-surface-400">
                          <span className="font-bold text-surface-500">{note.authorName}</span>
                          <span>•</span>
                          <span>{fmt(note.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-surface-400 text-sm">
                      <svg className="w-10 h-10 mx-auto mb-2 text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      {ar() ? "لا توجد ملاحظات بعد" : "No notes yet"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── RECOVERY ── */}
            {tab === "recovery" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-surface-200 p-5 text-center">
                  <div className="w-16 h-16 bg-brand-pink-50 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-pink-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-surface-900 mb-2">{ar() ? "استعادة الحساب" : "Account Recovery"}</h4>
                  <p className="text-sm text-surface-500 mb-6 max-w-md mx-auto">
                    {ar() 
                      ? "قم بإنشاء رابط آمن ومؤقت (صالح لمدة 24 ساعة) لمشاركته مع العميل حتى يتمكن من تعيين كلمة مرور جديدة لحسابه بسهولة وبدون تعقيدات."
                      : "Generate a secure, temporary link (valid for 24 hours) to share with the customer so they can set a new password."}
                  </p>

                  {recoveryError && (
                    <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                      {recoveryError}
                    </div>
                  )}

                  {!recoveryLink ? (
                    <button
                      className="btn-primary px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                      onClick={handleGenerateRecoveryLink}
                      disabled={generatingRecovery}
                    >
                      {generatingRecovery 
                        ? (ar() ? "جاري الإنشاء..." : "Generating...") 
                        : (ar() ? "إنشاء رابط استعادة جديد" : "Generate Recovery Link")}
                    </button>
                  ) : (
                    <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 mt-4 text-left">
                      <label className="block text-xs font-bold text-surface-500 mb-2 uppercase tracking-wide">
                        {ar() ? "رابط الاستعادة للعميل" : "Customer Recovery Link"}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={recoveryLink}
                          className="input-field w-full text-xs font-mono py-2 px-3 bg-white"
                          dir="ltr"
                          onClick={(e) => e.currentTarget.select()}
                        />
                        <button
                          className="btn-primary whitespace-nowrap px-4 py-2 text-sm flex items-center gap-2"
                          onClick={() => {
                            navigator.clipboard.writeText(recoveryLink);
                            alert(ar() ? "تم النسخ" : "Copied to clipboard");
                          }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {ar() ? "نسخ الرابط" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Method Modal for Installment Increment */}
      {installMethodModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4" onClick={() => setInstallMethodModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-900 mb-4">{ar() ? "طريقة الدفع" : "Payment Method"}</h3>
            <select
              className="select-field w-full mb-4"
              value={installMethodValue}
              onChange={e => setInstallMethodValue(e.target.value)}
            >
              <option value="cash">{ar() ? "نقد" : "Cash"}</option>
              <option value="knet">{ar() ? "كي نت" : "KNET"}</option>
              <option value="bank_transfer">{ar() ? "تحويل بنكي" : "Bank Transfer"}</option>
              <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
              <option value="card">{ar() ? "بطاقة ائتمان" : "Credit Card"}</option>
              <option value="link">{ar() ? "رابط دفع" : "Payment Link"}</option>
              <option value="other">{ar() ? "أخرى" : "Other"}</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                onClick={() => setInstallMethodModal(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all"
                onClick={() => {
                  const mid = installMethodModal.membershipId;
                  setInstallMethodModal(null);
                  handleAdjustInstallments(mid, +1, installMethodValue);
                }}
              >
                {ar() ? "تأكيد الدفع" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionDateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative">
            <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "تاريخ الجلسة" : "Session Date"}</h3>
            <p className="text-sm text-surface-500 mb-4">{ar() ? "الرجاء إدخال تاريخ الجلسة" : "Please enter the session date"}</p>
            <DatePicker
              className="input-field w-full mb-4"
              value={sessionDateValue}
              onChange={(e) => setSessionDateValue(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                onClick={() => setSessionDateModal(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all"
                onClick={submitSessionDate}
                disabled={!sessionDateValue}
              >
                {ar() ? "تأكيد" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
