import { fmtDateTime } from "../../lib/dateFormat";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import DatePicker from "../../components/DatePicker";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

type BookingRow = {
  id: string;
  status: string;
  clinicId: string;
  clinicNameEn?: string;
  clinicNameAr?: string;
  userId: string;
  userName?: string;
  userOfferId: string;
  adminSuggestedAt?: string;
  clinicScheduledAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  conversationId?: string;
};

type ClinicRow = { id: string; nameEn?: string; nameAr?: string };

const STATUS_META: Record<string, { cls: string; labelEn: string; labelAr: string }> = {
  open:             { cls: "status-pill-pending",               labelEn: "Open",             labelAr: "مفتوح" },
  request_received: { cls: "status-pill-pending",               labelEn: "Request Received", labelAr: "تم استلام الطلب" },
  slot_assigned:    { cls: "status-pill bg-blue-50 text-blue-700", labelEn: "Slot Assigned",    labelAr: "تم تحديد الوقت" },
  scheduled:        { cls: "status-pill-active",                labelEn: "Scheduled",        labelAr: "مجدول" },
  checked_in:       { cls: "status-pill bg-teal-50 text-teal-700", labelEn: "Checked In",       labelAr: "تم الحضور" },
  in_progress:      { cls: "status-pill bg-purple-50 text-purple-700", labelEn: "In Progress", labelAr: "قيد التنفيذ" },
  completed:        { cls: "status-pill bg-gray-50 text-gray-700", labelEn: "Completed",        labelAr: "مكتمل" },
  no_show:          { cls: "status-pill bg-red-50 text-red-700",  labelEn: "No Show",          labelAr: "لم يحضر" },
  cancelled:        { cls: "status-pill-locked",                labelEn: "Cancelled",        labelAr: "ملغى" },
  rescheduled:      { cls: "status-pill bg-orange-50 text-orange-700", labelEn: "Rescheduled", labelAr: "تمت إعادة الجدولة" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { cls: "status-pill-locked", labelEn: status, labelAr: status };
  return (
    <span className={meta.cls}>
      {ar() ? meta.labelAr : meta.labelEn}
    </span>
  );
}

export default function AdminRequestHistoryTab() {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState<BookingRow[]>([]);
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: "all" });
      if (clinicId) qs.set("clinicId", clinicId);
      const data = (await apiFetch(`/scheduling/admin/requests?${qs.toString()}`, {
        headers: getAuthHeader()
      })) as { items: BookingRow[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch("/clinics/admin", { headers: getAuthHeader() })
      .then((d) => setClinics(((d as { clinics?: ClinicRow[] }).clinics ?? []).map((c) => ({ id: c.id, nameEn: c.nameEn, nameAr: c.nameAr }))))
      .catch(() => setClinics([]));
  }, [getAuthHeader]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (it.status === "cancelled" || it.status === "rejected") return false;
      
      if (statusFilter !== "all" && it.status !== statusFilter) return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = (it.userName || "").toLowerCase().includes(q) || (it.userId || "").toLowerCase().includes(q);
        const matchesNotes = (it.notes || "").toLowerCase().includes(q);
        if (!matchesName && !matchesNotes) return false;
      }
      
      if (fromDate) {
        const f = new Date(fromDate).getTime();
        if (new Date(it.createdAt).getTime() < f) return false;
      }
      if (toDate) {
        const t = new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (new Date(it.createdAt).getTime() > t) return false;
      }
      return true;
    });
  }, [items, fromDate, toDate, searchQuery, statusFilter]);

  const saveNote = async (requestId: string) => {
    try {
      await apiFetch(`/scheduling/admin/requests/${requestId}/update-notes`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ notes: editingNoteText }),
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === requestId ? { ...it, notes: editingNoteText } : it
        )
      );
      setEditingNoteId(null);
    } catch (e: any) {
      alert(e.message || "Failed to save");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-elevated bg-white border border-surface-200 p-5 space-y-4">
        <div className="editorial-header">
          <div className="flex items-center gap-3">
            <span className="accent" />
            <div>
              <h3>{ar() ? "سجل طلبات الحجز" : "Booking Request History"}</h3>
              <p className="meta">{ar() ? "عرض تاريخ الطلبات وتغييرات المواعيد للعيادات" : "View request history and appointment changes for clinics"}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-pink-100 text-brand-pink-700 px-3 py-1 text-xs font-bold">
            {filtered.length} {ar() ? "طلب" : "requests"}
          </span>
        </div>

        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">{ar() ? "بحث" : "Search"}</label>
              <div className="relative">
                <input 
                  type="text" 
                  className="input-field w-full pl-10" 
                  placeholder={ar() ? "ابحث عن عميل أو ملاحظة..." : "Search customer or notes..."} 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
                <svg className="w-5 h-5 absolute left-3 top-2.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">{ar() ? "العيادة" : "Clinic"}</label>
              <select className="select-field w-full" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                <option value="">{ar() ? "الكل" : "All"}</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{ar() ? (c.nameAr ?? c.nameEn) : (c.nameEn ?? c.nameAr)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">{ar() ? "الحالة" : "Status"}</label>
              <select className="select-field w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">{ar() ? "الكل" : "All"}</option>
                <option value="open">{ar() ? "مفتوح" : "Open"}</option>
                <option value="request_received">{ar() ? "تم استلام الطلب" : "Request Received"}</option>
                <option value="slot_assigned">{ar() ? "تم تحديد الوقت" : "Slot Assigned"}</option>
                <option value="scheduled">{ar() ? "مجدول" : "Scheduled"}</option>
                <option value="in_progress">{ar() ? "قيد التنفيذ" : "In Progress"}</option>
                <option value="completed">{ar() ? "مكتمل" : "Completed"}</option>
                <option value="no_show">{ar() ? "لم يحضر" : "No Show"}</option>
              </select>
            </div>
            
            <div className="flex gap-2 lg:col-span-1">
              <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => load()} disabled={loading}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}>
                  <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                </svg>
                {ar() ? "تحديث" : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">{ar() ? "من تاريخ الطلب" : "From Request Date"}</label>
              <DatePicker className="input-field w-full" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-600 mb-1.5 uppercase tracking-wider">{ar() ? "إلى تاريخ الطلب" : "To Request Date"}</label>
              <DatePicker className="input-field w-full" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="overflow-auto border border-surface-200 rounded-xl">
          <table className="data-table whitespace-nowrap min-w-full">
            <thead>
              <tr>
                <th>{ar() ? "العيادة" : "Clinic"}</th>
                <th>{ar() ? "العميل" : "Customer"}</th>
                <th>{ar() ? "موعد مقترح من الإدارة" : "Admin Suggested Date"}</th>
                <th>{ar() ? "الموعد المعدل من العيادة" : "Clinic Scheduled Date"}</th>
                <th>{ar() ? "ملاحظات الإدارة" : "Admin Notes"}</th>
                <th>{ar() ? "تاريخ الطلب" : "Request Date"}</th>
                <th>{ar() ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td>{ar() ? (it.clinicNameAr ?? it.clinicNameEn ?? it.clinicId) : (it.clinicNameEn ?? it.clinicNameAr ?? it.clinicId)}</td>
                  <td className="font-medium text-surface-700">{it.userName ?? it.userId}</td>
                  <td>{it.adminSuggestedAt ? <span className="text-amber-700 font-medium">{fmtDateTime(it.adminSuggestedAt)}</span> : "—"}</td>
                  <td>{it.clinicScheduledAt ? <span className="text-emerald-700 font-medium">{fmtDateTime(it.clinicScheduledAt)}</span> : "—"}</td>
                  <td className="max-w-[250px]">
                    {editingNoteId === it.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          className="input-field text-xs py-1 px-2 w-full"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveNote(it.id); if (e.key === "Escape") setEditingNoteId(null); }}
                          autoFocus
                        />
                        <button onClick={() => saveNote(it.id)} className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shrink-0" title="Save">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button onClick={() => setEditingNoteId(null)} className="p-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0" title="Cancel">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className="truncate" title={it.notes}>{it.notes || "—"}</span>
                        <button
                          onClick={() => { setEditingNoteId(it.id); setEditingNoteText(it.notes || ""); }}
                          className="p-1 rounded-lg text-surface-400 hover:text-brand-pink-600 hover:bg-brand-pink-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          title={ar() ? "تعديل" : "Edit"}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-surface-500">{fmtDateTime(it.createdAt)}</td>
                  <td><StatusPill status={it.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state py-12">
                      <p className="empty-state-title">{ar() ? "لا توجد نتائج" : "No results found"}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
