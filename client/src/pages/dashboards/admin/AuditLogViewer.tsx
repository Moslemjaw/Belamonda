import { useState, Fragment } from "react";
import { useApi } from "../../../hooks/useApi";
import { fmtDate } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { ar, AUDIT_ROLE_COLORS, ACTION_LABELS } from "./shared";

export function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = new URLSearchParams({ page: page.toString(), limit: "25" });
  if (filterType)   query.set("actionType", filterType);
  if (filterRole)   query.set("actorRole", filterRole);
  if (filterEntity) query.set("targetEntityType", filterEntity);
  if (startDate)    query.set("startDate", startDate);
  if (endDate)      query.set("endDate", endDate);

  const { data, loading, error } = useApi<{ items: any[]; total: number; page: number; pages: number }>(`/audit?${query.toString()}`);

  const resetFilters = () => {
    setFilterType(""); setFilterRole(""); setFilterEntity("");
    setStartDate(""); setEndDate(""); setPage(1);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "سجل التدقيق" : "Audit Logs"}</h2>
        <p className="text-sm text-surface-500 mt-1">{ar() ? "تتبع كل الإجراءات المهمة في النظام." : "Track every significant action across the system."}</p>
      </div>

      {/* Filters */}
      <div className="card-elevated border border-surface-200 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select className="select-field text-sm" value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
            <option value="">{ar() ? "جميع الأدوار" : "All Roles"}</option>
            <option value="admin">Admin</option>
            <option value="cs">CS</option>
            <option value="finance">Finance</option>
            <option value="clinicStaff">Clinic Staff</option>
            <option value="legal">Legal</option>
            <option value="cs_director">CS Director</option>
            <option value="customer">Customer</option>
            <option value="system">System</option>
          </select>
          <select className="select-field text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">{ar() ? "جميع الإجراءات" : "All Actions"}</option>
            <option value="create_offer">Create Offer</option>
            <option value="update_offer">Update Offer</option>
            <option value="delete_offer">Delete Offer</option>
            <option value="freeze_user">Freeze User</option>
            <option value="unfreeze_user">Unfreeze User</option>
            <option value="change_user_role">Change Role</option>
            <option value="approve_kyc">Approve KYC</option>
            <option value="reject_kyc">Reject KYC</option>
            <option value="confirm_payment">Confirm Payment</option>
            <option value="checkout_complete">Checkout</option>
          </select>
          <select className="select-field text-sm" value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }}>
            <option value="">{ar() ? "جميع الكيانات" : "All Entities"}</option>
            <option value="User">User</option>
            <option value="Offer">Offer</option>
            <option value="KycSubmission">KYC Submission</option>
            <option value="Payment">Payment</option>
            <option value="UserOffer">User Offer</option>
          </select>
          <DatePicker className="input-field text-sm" value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            placeholder="Start date" />
          <DatePicker className="input-field text-sm" value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            placeholder="End date" />
        </div>
        {(filterRole || filterType || filterEntity || startDate || endDate) && (
          <button onClick={resetFilters} className="mt-3 text-xs font-bold text-brand-pink-600 hover:text-brand-pink-800 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            {ar() ? "مسح الفلاتر" : "Clear filters"}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card-elevated border border-surface-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
          <span className="text-sm font-bold text-surface-700">
            {loading ? "..." : `${total.toLocaleString()} ${ar() ? "سجل" : "records"}`}
          </span>
          <span className="text-xs text-surface-400">
            {ar() ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-surface-400 animate-pulse">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-sm w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="w-36">{ar() ? "الوقت" : "Timestamp"}</th>
                  <th>{ar() ? "المستخدم" : "User"}</th>
                  <th>{ar() ? "الإجراء" : "Action"}</th>
                  <th>{ar() ? "الكيان" : "Target"}</th>
                  <th>{ar() ? "ملاحظات" : "Notes"}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {items.map((log: any) => (
                  <Fragment key={log.id}>
                    <tr className={`hover:bg-surface-50/50 transition-colors ${expandedId === log.id ? "bg-surface-50" : ""}`}>
                      <td className="text-xs text-surface-500 whitespace-nowrap">
                        <div>{fmtDate(log.createdAt)}</div>
                        <div className="text-[10px] text-surface-400">{new Date(log.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td>
                        <div className="font-bold text-surface-900 mb-0.5 text-xs">{log.actorName}</div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${AUDIT_ROLE_COLORS[log.actorRole] ?? "bg-surface-100 text-surface-600"}`}>
                          {log.actorRole}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-surface-900 text-xs">
                          {ACTION_LABELS[log.actionType] ?? (log.actionType ? log.actionType.replace(/_/g, " ") : "—")}
                        </span>
                      </td>
                      <td className="text-xs">
                        <span className="font-medium text-surface-700">{log.targetEntityType}</span>
                        {log.targetEntityName ? (
                          <div className="text-[11px] font-bold text-surface-900 truncate max-w-[150px] mt-0.5" title={log.targetEntityName}>{log.targetEntityName}</div>
                        ) : (
                          <div className="font-mono text-[10px] text-surface-400 truncate max-w-[120px]">{log.targetEntityId}</div>
                        )}
                      </td>
                      <td className="text-xs text-surface-500 max-w-[160px]">
                        {log.metadata?.username && <span className="font-medium text-surface-700">@{log.metadata.username}</span>}
                        {log.metadata?.reason && <span className="italic"> — {log.metadata.reason}</span>}
                        {log.metadata?.note && <span>{log.metadata.note}</span>}
                      </td>
                      <td>
                        {(log.beforeState || log.afterState) && (
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="w-6 h-6 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-500 flex items-center justify-center transition-colors"
                            title="Show changes"
                          >
                            <svg className={`w-3 h-3 transition-transform ${expandedId === log.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (log.beforeState || log.afterState) && (
                      <tr key={`${log.id}-expanded`} className="bg-surface-50">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {log.beforeState && (
                              <div>
                                <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">{ar() ? "قبل" : "Before"}</div>
                                <pre className="bg-white border border-surface-200 rounded-lg p-2.5 font-mono text-[10px] text-surface-700 overflow-auto max-h-32">
                                  {JSON.stringify(log.beforeState, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.afterState && (
                              <div>
                                <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">{ar() ? "بعد" : "After"}</div>
                                <pre className="bg-white border border-surface-200 rounded-lg p-2.5 font-mono text-[10px] text-surface-700 overflow-auto max-h-32">
                                  {JSON.stringify(log.afterState, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </div>
                        <div className="empty-state-title">{ar() ? "لا توجد سجلات" : "No logs found"}</div>
                        <div className="empty-state-sub">{ar() ? "لا توجد سجلات تطابق الفلاتر الحالية." : "No logs match the current filters."}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-4 border-t border-surface-100 bg-surface-50 flex items-center justify-between">
          <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {ar() ? "السابق" : "Previous"}
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? "bg-brand-pink-500 text-white" : "bg-white border border-surface-200 text-surface-600 hover:bg-surface-50"}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button className="btn-secondary btn-sm" disabled={page >= pages || items.length === 0} onClick={() => setPage(p => p + 1)}>
            {ar() ? "التالي" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ===========================================================================
// CLINIC NOTICES ADMIN PANEL
// ===========================================================================
