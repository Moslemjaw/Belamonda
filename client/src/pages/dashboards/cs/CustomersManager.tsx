import { useState, useEffect } from "react";
import DatePicker from "../../../components/DatePicker";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { UserProfilePanel } from "../admin/UserProfilePanel";
import { ar } from "./shared";

export function CustomersManager() {
  const { getAuthHeader, impersonateUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Add Customer Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  
  type CustomInstallment = { dueDate: string; amountKwd: string; isPaid: boolean; method: string; };
  type EnrollmentRow = { 
    offerId: string; 
    clinicId: string; 
    purchaseMode: string; 
    amountPaidKwd: string; 
    method: string; 
    isVerified: boolean; 
    installmentCount: number;
    customInstallments?: CustomInstallment[];
  };
  
  const emptyRow: EnrollmentRow = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "cash", isVerified: true, installmentCount: 2 };
  
  const [addForm, setAddForm] = useState({
    phone: "", fullName: "", email: "", password: "",
    enrollments: [{ ...emptyRow }] as EnrollmentRow[],
  });
  const [addingUser, setAddingUser] = useState(false);

  // Dynamic public data
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const { data: offersData, loading: offersLoading } = useApi<{ items: any[] }>("/offers/admin");
  const { data: plansData } = useApi<any[]>("/subscriptions/plans");

  const generateInstallments = (count: number, offerId: string): CustomInstallment[] => {
    const offer = offersData?.items?.find((o: any) => o.id === offerId || o._id === offerId);
    const total = offer ? parseFloat(offer.subscriptionPriceKwd || "0") : 0;
    const baseEach = Math.floor((total * 1000) / count) / 1000;
    const remainder = total - (baseEach * count);
    
    const arr: CustomInstallment[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + (i * 30));
      const amt = baseEach + (i === 0 ? remainder : 0);
      arr.push({
        dueDate: d.toISOString().split("T")[0],
        amountKwd: amt.toFixed(3),
        isPaid: i === 0,
        method: "cash"
      });
    }
    return arr;
  };

  const updateEnrollment = (idx: number, patch: Partial<EnrollmentRow>) => {
    setAddForm(p => {
      const newList = [...p.enrollments];
      const current = newList[idx];
      
      // Auto-generate installments if mode switched to installments or count changes
      if (patch.purchaseMode === "installments" || (patch.installmentCount && current.purchaseMode === "installments")) {
        const count = patch.installmentCount || current.installmentCount || 2;
        patch.customInstallments = generateInstallments(count, patch.offerId || current.offerId);
      }
      
      newList[idx] = { ...current, ...patch };
      return { ...p, enrollments: newList };
    });
  };
  const addEnrollmentRow = () => {
    setAddForm(p => ({ ...p, enrollments: [...p.enrollments, { ...emptyRow }] }));
  };
  const removeEnrollmentRow = (idx: number) => {
    setAddForm(p => ({ ...p, enrollments: p.enrollments.filter((_, i) => i !== idx) }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const body: any = {
        phone: addForm.phone, fullName: addForm.fullName, email: addForm.email, password: addForm.password,
        enrollments: addForm.enrollments.filter(en => en.offerId),
      };
      await apiFetch("/users/admin/manual-enroll", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowAddModal(false);
      loadUsers();
      setAddForm({ phone: "", fullName: "", email: "", password: "", enrollments: [{ ...emptyRow }] });
    } catch (err: any) {
      alert(ar() ? "حدث خطأ: " + err.message : "An error occurred: " + err.message);
    } finally {
      setAddingUser(false);
    }
  };

  // Grant modal states
  const defaultGrantEnrollment = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "bank_transfer", isVerified: true, installmentCount: 2, customInstallments: [] };
  const [grantEnrollments, setGrantEnrollments] = useState<any[]>([{ ...defaultGrantEnrollment }]);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState(false);

  const addGrantEnrollmentRow = () => setGrantEnrollments(p => [...p, { ...defaultGrantEnrollment }]);
  const removeGrantEnrollmentRow = (idx: number) => setGrantEnrollments(p => p.filter((_, i) => i !== idx));
  const updateGrantEnrollment = (idx: number, updates: any) => setGrantEnrollments(p => p.map((x, i) => {
    if (i !== idx) return x;
    const next = { ...x, ...updates };
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
          phone: selectedUser.phone || selectedUser.username || `phone_${selectedUser.id}`, 
          fullName: selectedUser.fullName || "Customer", 
          email: selectedUser.email,
          enrollments: grantEnrollments 
        }),
      });
      setGrantSuccess(true);
      setGrantEnrollments([{ ...defaultGrantEnrollment }]);
      await refetchProfile();
    } catch (e: any) {
      setGrantError(e.message);
    } finally {
      setGrantSaving(false);
    }
  };

  // Clinic Transfer modal states
  const [clinicChangeModal, setClinicChangeModal] = useState<{ type: "membership" | "session" | "request"; id: string; currentClinicId: string; defaultFee: string } | null>(null);
  const [newClinicId, setNewClinicId] = useState("");
  const [isPaidTransfer, setIsPaidTransfer] = useState(false);
  const [transferFee, setTransferFee] = useState("10.000");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [freezing, setFreezing] = useState(false);
  const [cashAmt, setCashAmt] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);
  const [sessionAdjustingId, setSessionAdjustingId] = useState<string | null>(null);
  const [sessionDateModal, setSessionDateModal] = useState<{ membershipId: string } | null>(null);
  const [sessionDateValue, setSessionDateValue] = useState(new Date().toISOString().split("T")[0]);

  const refetchProfile = async () => {
    if (!selectedUser) return;
    try {
      const data: any = await apiFetch(`/users/admin/${selectedUser.id}/profile`, { headers: getAuthHeader() });
      setProfile(data);
    } catch (err) {
      console.error("Refetch profile error:", err);
    }
  };

  const handleCashbackAdjust = async (sign: 1 | -1) => {
    if (!selectedUser) return;
    const amt = parseFloat(cashAmt);
    if (!amt || amt <= 0) { setCashError(ar() ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    if (!cashReason.trim()) { setCashError(ar() ? "السبب مطلوب" : "Reason is required"); return; }
    setCashSaving(true);
    setCashError(null);
    try {
      const kwd = `${Math.floor(amt)}.${String(Math.round((amt % 1) * 1000)).padStart(3, "0")}`;
      const signedKwd = sign === -1 ? `-${kwd}` : kwd;
      await apiFetch("/wallet/admin/adjust", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ userId: selectedUser.id, amountKwd: signedKwd, reason: cashReason })
      });
      setCashAmt("");
      setCashReason("");
      await refetchProfile();
    } catch (e: any) {
      setCashError(e.message);
    } finally {
      setCashSaving(false);
    }
  };

  const [belmondoSaving, setBelmondoSaving] = useState(false);
  const [belmondoPlanId, setBelmondoPlanId] = useState<string>("");
  const [belmondoPaymentMethod, setBelmondoPaymentMethod] = useState<string>("pos");

  const handleUpdateSubscription = async (downgrade = false) => {
    if (!selectedUser) return;
    setBelmondoSaving(true);
    try {
      const body = downgrade ? { plan: "basic" } : {
        plan: "pro",
        planId: belmondoPlanId || plansData?.[0]?._id,
        method: belmondoPaymentMethod
      };
      await apiFetch(`/users/admin/${selectedUser.id}/subscription`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      await handleManage(selectedUser);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBelmondoSaving(false);
    }
  };

  const handleAdjustSessions = async (membershipId: string, delta: number) => {
    if (!selectedUser) return;
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
      await refetchProfile();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const submitSessionDate = async () => {
    if (!sessionDateModal || !selectedUser) return;
    const membershipId = sessionDateModal.membershipId;
    setSessionDateModal(null);
    setSessionAdjustingId(membershipId + "_inc");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta: 1, date: sessionDateValue }),
      });
      await refetchProfile();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const loadUsers = () => {
    setUsersLoading(true);
    apiFetch("/users/admin?role=customer", { headers: getAuthHeader() })
      .then((res: any) => setUsers(res.items ?? []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleManage = async (u: any) => {
    setSelectedUser(u);
    setProfile(null);
    setProfileLoading(true);
    try {
      const data: any = await apiFetch(`/users/admin/${u.id}/profile`, { headers: getAuthHeader() });
      setProfile(data);
    } catch {}
    finally { setProfileLoading(false); }
  };

  const handleFreeze = async () => {
    if (!selectedUser) return;
    setFreezing(true);
    try {
      await apiFetch(`/users/admin/${selectedUser.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !selectedUser.isActive }),
      });
      const updated = { ...selectedUser, isActive: !selectedUser.isActive };
      setSelectedUser(updated);
      setUsers(users.map(u => u.id === updated.id ? updated : u));
    } catch (e: any) { alert(e.message); }
    finally { setFreezing(false); }
  };

  const toggleConfirmationCall = async (id: string, currentVal: boolean) => {
    try {
      await apiFetch(`/users/admin/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isConfirmationCallDone: !currentVal }),
      });
      setUsers(users.map(u => u.id === id ? { ...u, isConfirmationCallDone: !currentVal } : u));
    } catch (e: any) {
      alert(ar() ? "فشل التحديث: " + e.message : "Update failed: " + e.message);
    }
  };

  const getDisplayName = (u: any) => u.fullName || u.username || "—";
  const getStatus = (u: any, p?: any) => {
    if (!u.isActive) return "Frozen";
    const kycStatus = p?.kyc?.status;
    if (kycStatus === "approved") return "Verified";
    if (kycStatus === "pending") return "Pending KYC";
    if (kycStatus === "rejected") return "KYC Rejected";
    return "Active";
  };
  const getStatusBadge = (status: string) => {
    if (status === "Verified") return "badge-green";
    if (status === "Frozen") return "badge-red";
    if (status === "Pending KYC") return "badge-yellow";
    return "badge-sage";
  };

  const filtered = users.filter(u =>
    getDisplayName(u).toLowerCase().includes(search.toLowerCase()) ||
    (u.phone || "").includes(search) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.civilIdNumberMasked || "").includes(search)
  );

  const userStatus = selectedUser ? getStatus(selectedUser, profile) : "";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "العملاء (المرضى)" : "Customers (Patients)"}</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-64 relative flex-1">
            <input className="input-field w-full pl-9" placeholder={ar() ? "بحث بالاسم أو الهاتف أو المدني..." : "Search name, phone or Civil ID..."} value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button
            className="btn-primary flex items-center justify-center gap-1.5 whitespace-nowrap"
            onClick={() => setShowAddModal(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {ar() ? "إضافة عميل" : "Add Customer"}
          </button>
        </div>
      </div>

      {selectedUser ? (
        <div className="mt-6 rounded-3xl overflow-hidden border border-surface-200 shadow-[0_20px_60px_rgb(0,0,0,0.08)]">
          <UserProfilePanel 
            user={selectedUser} 
            onClose={() => { setSelectedUser(null); }} 
            onRoleChange={(role) => {
              const updated = { ...selectedUser, role };
              setSelectedUser(updated);
              setUsers(users.map(u => u.id === updated.id ? updated : u));
            }}
            onStatusChange={(active) => {
              const updated = { ...selectedUser, isActive: active };
              setSelectedUser(updated);
              setUsers(users.map(u => u.id === updated.id ? updated : u));
            }}
            onLoginAs={() => void impersonateUser(selectedUser.id).catch((e: any) => alert(e.message))}
          />
        </div>
      ) : (
        <div className="card-elevated overflow-hidden bg-white">
          {/* Mobile view (Cards) */}
          <div className="md:hidden divide-y divide-surface-100">
            {usersLoading ? (
              <div className="p-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
            ) : filtered.map((u: any) => {
              const name = getDisplayName(u);
              const status = getStatus(u);
              return (
                <div key={u.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-pink-50 flex items-center justify-center text-sm font-bold text-brand-pink-600 flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-surface-900">{name}</div>
                        <div className="text-xs text-surface-500">{u.phone || "—"}</div>
                      </div>
                    </div>
                    <button
                      className="text-surface-700 font-bold text-xs px-3 py-1.5 bg-surface-50 border border-surface-200 rounded-lg shrink-0"
                      onClick={() => handleManage(u)}
                    >
                      {ar() ? "إدارة" : "Manage"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-sage !text-[10px] !px-2 !py-0.5">Customer</span>
                    <span className={`${getStatusBadge(status)} !text-[10px] !px-2 !py-0.5`}>{status}</span>
                    <div className="flex items-center gap-1 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-surface-600 cursor-pointer" onClick={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)}>
                      <input type="checkbox" checked={u.isConfirmationCallDone ?? false} readOnly className="w-3 h-3 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                      <span>{ar() ? "تأكيد اتصال" : "Confirmed"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!usersLoading && filtered.length === 0 && (
              <div className="p-8 text-center text-surface-500 text-sm">{ar() ? "لا يوجد عملاء" : "No customers found"}</div>
            )}
          </div>

          {/* Desktop view (Table) */}
          <div className="overflow-x-auto hidden md:block">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{ar() ? "الاسم" : "Name"}</th>
                  <th>{ar() ? "الرقم" : "Phone/Contact"}</th>
                  <th>{ar() ? "الصلاحية" : "Role"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                  <th>{ar() ? "تأكيد الاتصال" : "Confirmation"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</td></tr>
                ) : filtered.map((u: any) => {
                  const name = getDisplayName(u);
                  const status = getStatus(u);
                  return (
                    <tr key={u.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-pink-50 flex items-center justify-center text-xs font-bold text-brand-pink-600 flex-shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{name}</div>
                            <div className="flex flex-col gap-0.5 text-xs text-surface-400">
                              {u.email && <span>{u.email}</span>}
                              {u.civilIdNumberMasked && (
                                <span className="font-mono text-[11px] text-surface-500">
                                  {ar() ? "المدني: " : "Civil ID: "}{u.civilIdNumberMasked}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{u.phone || "—"}</td>
                      <td><span className="badge-sage">Customer</span></td>
                      <td><span className={getStatusBadge(status)}>{status}</span></td>
                      <td>
                        <label className="flex items-center gap-1.5 bg-surface-50 border border-surface-200 px-2 py-1 w-max rounded text-xs font-bold text-surface-600 cursor-pointer hover:bg-surface-100 transition-colors" title={ar() ? "تم الاتصال لتأكيد العميل" : "Customer confirmation call done"}>
                          <input type="checkbox" checked={u.isConfirmationCallDone ?? false} onChange={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)} className="w-4 h-4 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                          <span>{ar() ? "تم الاتصال" : "Done"}</span>
                        </label>
                      </td>
                      <td className="text-right">
                        <button className="btn-secondary btn-sm bg-white hover:bg-surface-50 text-surface-700 shadow-sm border border-surface-200 px-4"
                          onClick={() => handleManage(u)}>
                          {ar() ? "إدارة" : "Manage"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!usersLoading && filtered.length === 0 && (
                  <tr><td colSpan={5}><div className="empty-state">
                    <div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>
                    <div className="empty-state-title">{ar() ? "لا يوجد عملاء" : "No customers found"}</div>
                    <div className="empty-state-sub">{ar() ? "جربي تعديل الفلاتر أو البحث." : "Try adjusting your filters or search."}</div>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
              <h3 className="font-bold text-surface-900">{ar() ? "إضافة مستخدم جديد وتسجيل باقات" : "Add User & Enroll Memberships"}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="addUserForm" onSubmit={handleAddSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"} *</label>
                    <input required type="text" className="input-field" value={addForm.fullName} onChange={e => setAddForm(p => ({ ...p, fullName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone"} *</label>
                    <input required type="text" className="input-field" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 965..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني (اختياري)" : "Email (Optional)"}</label>
                    <input type="email" className="input-field" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور" : "Password"}</label>
                    <input type="text" className="input-field" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder={ar() ? "اتركه فارغ = رقم الهاتف" : "Leave empty = phone number"} />
                  </div>
                </div>

                <div className="border-t border-surface-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-surface-900">{ar() ? "الاشتراكات والدفع" : "Memberships & Payment"}</h4>
                    <button type="button" onClick={addEnrollmentRow} className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      {ar() ? "إضافة باقة" : "Add Membership"}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {addForm.enrollments.map((en, idx) => (
                      <div key={idx} className="relative bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden transition-all hover:border-brand-pink-200">
                        {addForm.enrollments.length > 1 && (
                          <button type="button" onClick={() => removeEnrollmentRow(idx)} className="absolute top-3 rtl:left-3 ltr:right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors z-10" title={ar() ? "إزالة" : "Remove"}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                        <div className="px-5 py-3 border-b border-surface-100 bg-surface-50 flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-pink-100 text-brand-pink-700 text-xs font-black">{idx + 1}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-surface-600">{ar() ? "تفاصيل الباقة" : "Membership Details"}</span>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "اختيار باقة/جلسة" : "Select Offer/Session"}</label>
                              <select className="select-field w-full bg-surface-50" disabled={offersLoading} value={en.offerId} onChange={e => updateEnrollment(idx, { offerId: e.target.value })}>
                                <option value="">{offersLoading ? (ar() ? "جاري التحميل..." : "Loading...") : (ar() ? "-- بدون اشتراك --" : "-- No Membership --")}</option>
                                {!offersLoading && (offersData?.items || []).map((o: any) => <option key={o.id || o._id} value={o.id || o._id}>{ar() ? o.nameAr || o.name : o.name}</option>)}
                              </select>
                            </div>
                            {en.offerId && (
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العيادة (إن وجدت)" : "Clinic (if applicable)"}</label>
                                <select className="select-field w-full bg-surface-50" value={en.clinicId} onChange={e => updateEnrollment(idx, { clinicId: e.target.value })}>
                                  <option value="">{ar() ? "غير محدد" : "None"}</option>
                                  {(clinicsData?.items || []).map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          
                          {en.offerId && (
                            <div className="pt-4 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "نوع الدفع" : "Purchase Mode"}</label>
                                <select className="select-field w-full" value={en.purchaseMode} onChange={e => updateEnrollment(idx, { purchaseMode: e.target.value })}>
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
                                  <select className="select-field w-full" value={en.installmentCount} onChange={e => updateEnrollment(idx, { installmentCount: Number(e.target.value) })}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </div>
                              )}
                              {en.purchaseMode !== "installments" ? (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "المبلغ المدفوع اليوم (KWD)" : "Amount Paid Today (KWD)"}</label>
                                    <input type="number" step="0.001" min="0" className="input-field w-full font-mono text-brand-pink-700 font-bold" value={en.amountPaidKwd} onChange={e => updateEnrollment(idx, { amountPaidKwd: e.target.value })} disabled={en.purchaseMode === "free"} placeholder="0.000" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"}</label>
                                    <select className="select-field w-full" value={en.method} onChange={e => updateEnrollment(idx, { method: e.target.value })}>
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
                                        {(en.customInstallments || []).map((inst, iIdx) => (
                                          <tr key={iIdx}>
                                            <td className="px-3 py-2 font-bold text-surface-500">{iIdx + 1}</td>
                                            <td className="px-3 py-2">
                                              <DatePicker className="input-field text-xs py-1 px-2 w-full min-w-[110px]" value={inst.dueDate} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].dueDate = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <input type="number" step="0.001" className="input-field text-xs py-1 px-2 w-full min-w-[80px]" value={inst.amountKwd} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].amountKwd = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <input type="checkbox" className="w-4 h-4 text-brand-pink-600 rounded" checked={inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].isPaid = e.target.checked;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <select className="select-field text-xs py-1 px-2 w-full min-w-[100px]" value={inst.method} disabled={!inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].method = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }}>
                                                <option value="cash">{ar() ? "في العيادة" : "In Clinic"}</option>
                                                <option value="pos">POS</option>
                                                <option value="bank_transfer">{ar() ? "رابط دفع" : "Pay Link"}</option>
                                                <option value="enet">ENET</option>
                                                <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                              </select>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <div className="px-4 py-2 bg-surface-50 border-t border-surface-200 flex justify-between text-xs font-bold text-surface-600">
                                      <span>{ar() ? "المتبقي:" : "Amount Left:"}</span>
                                      <span>
                                        {Math.max(0, (offersData?.items?.find((o: any) => o.id === en.offerId || o._id === en.offerId)?.subscriptionPriceKwd || 0) - (en.customInstallments || []).reduce((sum, inst) => sum + (parseFloat(inst.amountKwd) || 0), 0)).toFixed(3)} KWD
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="sm:col-span-2 mt-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-3">
                                <div className="flex items-center h-5">
                                  <input type="checkbox" id={`verifyPay-${idx}`} checked={en.isVerified} onChange={e => updateEnrollment(idx, { isVerified: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-emerald-300" />
                                </div>
                                <div>
                                  <label htmlFor={`verifyPay-${idx}`} className="text-sm text-emerald-800 font-bold cursor-pointer block leading-none">{ar() ? "الدفع مؤكد وموثق؟ (تفعيل فوري)" : "Payment is verified? (Instant Activation)"}</label>
                                  <p className="text-xs text-emerald-600 mt-1">{ar() ? "عند التفعيل سيتم إرسال إشعار للمستخدم وإتاحة الباقة في حسابه." : "When checked, the membership will be instantly available to the user."}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-surface-100 bg-surface-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">{ar() ? "إلغاء" : "Cancel"}</button>
              <button type="submit" form="addUserForm" disabled={addingUser} className="btn-primary">
                {addingUser ? (ar() ? "جاري الإضافة..." : "Adding...") : (ar() ? "إضافة وحفظ" : "Add & Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
