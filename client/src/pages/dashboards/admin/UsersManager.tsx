import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch, API_BASE_URL } from "../../../lib/api";
import DatePicker from "../../../components/DatePicker";
import { ar, ROLE_COLORS } from "./shared";
import { UserProfilePanel } from "./UserProfilePanel";

export function UsersManager({ from, to }: { from?: string; to?: string }) {
  const { auth, login, getAuthHeader, impersonateUser } = useAuth();
  const canExport = auth?.role === "admin" || auth?.role === "finance";
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [users, setUsers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalUsers, setTotalUsers] = useState(0);

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
    historicalSessions?: { date: string }[];
  };
  
  const emptyRow: EnrollmentRow = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "cash", isVerified: true, installmentCount: 2, historicalSessions: [] };
  
  const [addForm, setAddForm] = useState({
    phone: "", fullName: "", email: "", password: "",
    enrollments: [{ ...emptyRow }] as EnrollmentRow[],
  });
  
  const { data: offersData, loading: offersLoading } = useApi<{ items: any[] }>("/offers/admin");
  const offers = offersData?.items || [];
  const { data: clinicsData, loading: clinicsLoading } = useApi<{ items: any[] }>("/clinics");
  const clinics = clinicsData?.items || [];
  const [addingUser, setAddingUser] = useState(false);

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

  const loadUsers = useCallback(() => {
    interface AdminUserItem {
      id: string;
      username?: string;
      fullName?: string;
      phone?: string;
      role: string;
      isActive: boolean;
      isConfirmationCallDone?: boolean;
      referredByUsername?: string | null;
    }
    interface AdminUsersResponse {
      items: AdminUserItem[];
      total?: number;
      totalPages?: number;
    }
    let url = `/users/admin?page=${currentPage}&limit=${pageSize}&`;
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}&`;
    if (search) url += `q=${encodeURIComponent(search.trim())}&`;
    if (filterRole && filterRole !== "all") url += `role=${filterRole}&`;
    if (filterStatus && filterStatus !== "all") url += `status=${filterStatus}&`;

    apiFetch(url, { headers: getAuthHeader() })
      .then((d) => {
        const resp = d as AdminUsersResponse;
        if (typeof resp.total === "number") setTotalUsers(resp.total);
        setUsers((resp.items || []).map((u) => ({
          id: u.id,
          fullName: u.fullName,
          username: u.username,
          name: u.fullName || u.username || u.phone || "—",
          phone: u.phone || "—",
          role: u.role,
          status: u.isActive ? "Active" : "Disabled",
          kyc: u.isActive,
          isConfirmationCallDone: u.isConfirmationCallDone ?? false,
          referredByUsername: u.referredByUsername ?? null
        })));
      })
      .catch((err: unknown) => {
        console.error("[UsersManager] Failed to load users:", err);
      });
  }, [from, to, search, filterRole, filterStatus, currentPage, pageSize, getAuthHeader]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const filtered = users;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterRole, filterStatus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const paginatedUsers = users;

  const openUser = (u: any) => { setSelectedUser(u); };

  const toggleConfirmationCall = async (id: string, currentVal: boolean) => {
    try {
      await apiFetch(`/users/admin/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isConfirmationCallDone: !currentVal }),
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isConfirmationCallDone: !currentVal } : u));
    } catch (e: any) {
      alert(ar() ? "فشل التحديث: " + e.message : "Update failed: " + e.message);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة المستخدمين" : "User Management"}</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canExport && (
            <button
              className="btn-secondary btn-sm flex items-center justify-center gap-1.5 text-emerald-700 hover:bg-emerald-50 border-emerald-200 flex-1 sm:flex-none"
              onClick={async () => {
                const headers = getAuthHeader() as Record<string, string> | undefined;
                const res = await fetch(`${API_BASE_URL}/users/admin/export/all`, { headers });
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "belamonda_all_users_report.xlsx";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {ar() ? "تصدير الكل" : "Export All"}
            </button>
          )}
          <button
            className="btn-primary btn-sm flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            onClick={() => setShowAddModal(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {ar() ? "إضافة مستخدم" : "Add User"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="relative">
          <input
            className="input-field w-full pl-9 h-10"
            placeholder={ar() ? "بحث بالاسم أو الهاتف..." : "Search name or phone..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <svg className="w-4 h-4 absolute left-3 top-3 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select
          className="select-field w-full h-10"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="all">{ar() ? "كل الأدوار" : "All roles"}</option>
          <option value="customer">{ar() ? "عميل" : "Customer"}</option>
          <option value="admin">{ar() ? "مدير" : "Admin"}</option>
          <option value="cs">{ar() ? "خدمة عملاء" : "CS"}</option>
          <option value="finance">{ar() ? "مالية" : "Finance"}</option>
          <option value="clinicStaff">{ar() ? "موظف عيادة" : "Clinic Staff"}</option>
          <option value="legal">{ar() ? "قانوني" : "Legal"}</option>
          <option value="cs_director">{ar() ? "مدير خدمة العملاء" : "CS Director"}</option>
          <option value="user">{ar() ? "مستخدم" : "User"}</option>
        </select>
        <select
          className="select-field w-full h-10"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">{ar() ? "كل الحالات" : "All statuses"}</option>
          <option value="active">{ar() ? "نشط" : "Active"}</option>
          <option value="disabled">{ar() ? "معطّل" : "Disabled"}</option>
        </select>
      </div>

      {selectedUser ? (
        <UserProfilePanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRoleChange={(role) => {
            const updated = { ...selectedUser, role };
            setSelectedUser(updated);
            setUsers(users.map(u => u.id === updated.id ? updated : u));
          }}
          onStatusChange={(active) => {
            const updated = { ...selectedUser, kyc: active, status: active ? "Active" : "Disabled" };
            setSelectedUser(updated);
            setUsers(users.map(u => u.id === updated.id ? updated : u));
          }}
          onLoginAs={() => void impersonateUser(selectedUser.id).catch(e => alert(e.message))}
        />
      ) : (
        <div className="card-elevated overflow-hidden bg-white">
          {/* Mobile view (Cards) */}
          <div className="md:hidden divide-y divide-surface-100">
            {paginatedUsers.map((u: any) => (
              <div key={u.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-pink-50 flex items-center justify-center text-sm font-bold text-brand-pink-600 flex-shrink-0">
                      {(u.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-surface-900">{u.fullName || u.username || u.phone}</div>
                      <div className="text-xs text-surface-500">{u.phone}</div>
                    </div>
                  </div>
                  <button
                    className="text-brand-pink-600 font-bold text-xs px-3 py-1.5 bg-brand-pink-50 rounded-lg shrink-0"
                    onClick={() => openUser(u)}
                  >
                    {ar() ? "إدارة" : "Manage"}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-surface-100 text-surface-600"}`}>{u.role}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.kyc ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{u.kyc ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}</span>
                  {u.id && parseInt(u.id.slice(-1), 16) > 12 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">🔥 High</span>}
                  {u.id && parseInt(u.id.slice(-2,-1), 16) < 3 && <span className="bg-surface-100 text-surface-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-surface-200">💤</span>}
                  {u.referredByUsername && <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">🔗</span>}
                  <div className="flex items-center gap-1 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-surface-600 cursor-pointer" onClick={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)}>
                    <input type="checkbox" checked={u.isConfirmationCallDone} readOnly className="w-3 h-3 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                    <span>{ar() ? "اتصال التأكيد" : "Confirmed"}</span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-surface-500 text-sm">{ar() ? "لا يوجد مستخدمين" : "No users found"}</div>
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
                  <th>{ar() ? "مؤشرات" : "Flags"}</th>
                  <th>{ar() ? "تأكيد الاتصال" : "Confirmation"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-pink-50 flex items-center justify-center text-xs font-bold text-brand-pink-600">
                          {(u.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{u.fullName || u.username || u.phone}</div>
                          {u.fullName && u.username && (
                            <div className="text-[11px] text-surface-400">@{u.username}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{u.phone}</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-surface-100 text-surface-600"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.kyc ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {u.kyc ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {u.id && parseInt(u.id.slice(-1), 16) > 12 && (
                           <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200" title="High Usage">🔥 {ar() ? "استخدام عالي" : "High Usage"}</span>
                        )}
                        {u.id && parseInt(u.id.slice(-2,-1), 16) < 3 && (
                           <span className="bg-surface-100 text-surface-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-surface-200" title="Dormant">💤 {ar() ? "خامل" : "Dormant"}</span>
                        )}
                        {u.referredByUsername && (
                           <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200" title="Referred">🔗 {ar() ? "إحالة" : "Referred"}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <label className="flex items-center gap-1.5 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-surface-600 cursor-pointer hover:bg-surface-100 transition-colors w-max" title={ar() ? "تم الاتصال لتأكيد العميل" : "Customer confirmation call done"}>
                        <input type="checkbox" checked={u.isConfirmationCallDone} onChange={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)} className="w-3 h-3 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                        <span>{ar() ? "تأكيد اتصال" : "Confirmed"}</span>
                      </label>
                    </td>
                    <td className="text-right">
                      <button
                        className="text-brand-pink-600 hover:text-brand-pink-800 font-medium text-sm px-4 py-1.5 bg-brand-pink-50 rounded-lg transition-colors hover:bg-brand-pink-100"
                        onClick={() => openUser(u)}
                      >
                        {ar() ? "إدارة" : "Manage"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                          </svg>
                        </div>
                        <div className="empty-state-title">{ar() ? "لا يوجد مستخدمين" : "No users found"}</div>
                        <div className="empty-state-sub">{ar() ? "جربي تعديل الفلاتر أو البحث." : "Try adjusting your filters or search."}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {filtered.length > 0 && (
            <div className="border-t border-surface-200 px-5 py-3.5 bg-surface-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-surface-600">
              <div className="flex items-center gap-3 flex-wrap">
                <span>
                  {ar()
                    ? `عرض ${(currentPage - 1) * pageSize + 1} إلى ${Math.min(currentPage * pageSize, totalUsers)} من أصل ${totalUsers} مستخدم`
                    : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, totalUsers)} of ${totalUsers} users`}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-surface-300">|</span>
                  <span>{ar() ? "لكل صفحة:" : "Per page:"}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-surface-200 rounded-lg px-2 py-1 text-xs font-semibold text-surface-700"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white font-semibold text-surface-700 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {ar() ? "السابق" : "Previous"}
                </button>

                <div className="px-3 py-1 font-bold text-surface-800 bg-white border border-surface-200 rounded-lg">
                  {ar() ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white font-semibold text-surface-700 hover:bg-surface-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {ar() ? "التالي" : "Next"}
                </button>
              </div>
            </div>
          )}
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
                                {!offersLoading && offers.map((o: any) => <option key={o.id || o._id} value={o.id || o._id}>{ar() ? o.nameAr || o.name : o.name}</option>)}
                              </select>
                            </div>
                            {en.offerId && (
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العيادة (إن وجدت)" : "Clinic (if applicable)"}</label>
                                <select className="select-field w-full bg-surface-50" disabled={clinicsLoading} value={en.clinicId} onChange={e => updateEnrollment(idx, { clinicId: e.target.value })}>
                                  <option value="">{clinicsLoading ? (ar() ? "جاري التحميل..." : "Loading...") : (ar() ? "غير محدد" : "None")}</option>
                                  {!clinicsLoading && clinics.map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
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
                                    <input type="number" step="0.001" className="input-field w-full font-mono text-brand-pink-700 font-bold" value={en.amountPaidKwd} onChange={e => updateEnrollment(idx, { amountPaidKwd: e.target.value })} placeholder="0.000" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"}</label>
                                    <select className="select-field w-full" value={en.method} onChange={e => updateEnrollment(idx, { method: e.target.value })}>
                                      <option value="cash">{ar() ? "الدفع في العيادة" : "Paid in Clinic"}</option>
                                      <option value="pos">POS</option>
                                      <option value="bank_transfer">{ar() ? "رابط دفع خارجي" : "External Payment Link"}</option>
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
                                        {Math.max(0, (offers.find((o: any) => o.id === en.offerId || o._id === en.offerId)?.subscriptionPriceKwd || 0) - (en.customInstallments || []).reduce((sum, inst) => sum + (parseFloat(inst.amountKwd) || 0), 0)).toFixed(3)} KWD
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="sm:col-span-2 mt-4 pt-4 border-t border-surface-100">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جلسات سابقة (تاريخية)" : "Historical Sessions"}</label>
                                  <button type="button" onClick={() => {
                                    const newEn = [...addForm.enrollments];
                                    if (!newEn[idx].historicalSessions) newEn[idx].historicalSessions = [];
                                    newEn[idx].historicalSessions!.push({ date: new Date().toISOString().split('T')[0] });
                                    setAddForm({ ...addForm, enrollments: newEn });
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
                                          const newEn = [...addForm.enrollments];
                                          newEn[idx].historicalSessions![hsIdx].date = e.target.value;
                                          setAddForm({ ...addForm, enrollments: newEn });
                                        }} />
                                        <button type="button" onClick={() => {
                                          const newEn = [...addForm.enrollments];
                                          newEn[idx].historicalSessions!.splice(hsIdx, 1);
                                          setAddForm({ ...addForm, enrollments: newEn });
                                        }} className="text-red-500 hover:text-red-700 p-1">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="sm:col-span-2 mt-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-3">
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
