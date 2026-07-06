import { fmtDateTime } from "../lib/dateFormat";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { apiFetch } from "../lib/api";
import ChatWidget from "./ChatWidget";
import DatePicker from "./DatePicker";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

type BookingRow = {
  id: string;
  status: string;
  clinicId: string;
  clinicNameEn?: string;
  clinicNameAr?: string;
  userId: string;
  userOfferId: string;
  preferredAt?: string;
  proposedAt?: string;
  createdAt: string;
  updatedAt: string;
  conversationId?: string;
};

type ClinicRow = { id: string; nameEn?: string; nameAr?: string };

const STATUSES = ["all", "open", "request_received", "slot_assigned", "scheduled", "checked_in", "in_progress", "completed", "no_show", "cancelled", "rescheduled"] as const;

type StatusMeta = { cls: string; dotCls: string; labelEn: string; labelAr: string };

const STATUS_META: Record<string, StatusMeta> = {
  open:             { cls: "status-pill-pending",               dotCls: "dot bg-amber-500",   labelEn: "Open",             labelAr: "مفتوح" },
  request_received: { cls: "status-pill-pending",               dotCls: "dot bg-amber-500",   labelEn: "Request Received", labelAr: "تم استلام الطلب" },
  slot_assigned:    { cls: "status-pill bg-blue-50 text-blue-700", dotCls: "dot bg-blue-500", labelEn: "Slot Assigned",    labelAr: "تم تحديد الوقت" },
  scheduled:        { cls: "status-pill-active",                dotCls: "dot bg-emerald-500", labelEn: "Scheduled",        labelAr: "مجدول" },
  checked_in:       { cls: "status-pill bg-teal-50 text-teal-700", dotCls: "dot bg-teal-500", labelEn: "Checked In",       labelAr: "تم الحضور" },
  in_progress:      { cls: "status-pill bg-purple-50 text-purple-700", dotCls: "dot bg-purple-500", labelEn: "In Progress", labelAr: "قيد التنفيذ" },
  completed:        { cls: "status-pill bg-gray-50 text-gray-700", dotCls: "dot bg-gray-500", labelEn: "Completed",        labelAr: "مكتمل" },
  no_show:          { cls: "status-pill bg-red-50 text-red-700",  dotCls: "dot bg-red-500",   labelEn: "No Show",          labelAr: "لم يحضر" },
  cancelled:        { cls: "status-pill-locked",                dotCls: "dot bg-surface-400", labelEn: "Cancelled",        labelAr: "ملغى" },
  rescheduled:      { cls: "status-pill bg-orange-50 text-orange-700", dotCls: "dot bg-orange-500", labelEn: "Rescheduled", labelAr: "تمت إعادة الجدولة" },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { cls: "status-pill-locked", dotCls: "dot bg-surface-400", labelEn: status, labelAr: status };
  return (
    <span className={meta.cls}>
      <span className={meta.dotCls} />
      {ar() ? meta.labelAr : meta.labelEn}
    </span>
  );
}

export default function AdminBookingsMonitor() {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState<BookingRow[]>([]);
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [status, setStatus] = useState<string>("open");
  const [clinicId, setClinicId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status });
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
  }, [getAuthHeader, status, clinicId]);

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
  }, [items, fromDate, toDate]);

  return (
    <div className="space-y-4">
      <div className="card-elevated bg-white border border-surface-200 p-5 space-y-4">
        <div className="editorial-header">
          <div className="flex items-center gap-3">
            <span className="accent" />
            <div>
              <h3>{ar() ? "الحجوزات والمحادثات" : "Bookings & Conversations"}</h3>
              <p className="meta">{ar() ? "عرض للقراءة فقط لجميع محادثات الحجز وحالاتها" : "Read-only view of all booking conversations and their state"}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-pink-100 text-brand-pink-700 px-3 py-1 text-xs font-bold">
            {filtered.length} {ar() ? "طلب" : "requests"}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1.5">{ar() ? "الحالة" : "Status"}</label>
            <select className="select-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1.5">{ar() ? "العيادة" : "Clinic"}</label>
            <select className="select-field" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
              <option value="">{ar() ? "كل العيادات" : "All clinics"}</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{ar() ? (c.nameAr ?? c.nameEn) : (c.nameEn ?? c.nameAr)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1.5">{ar() ? "من تاريخ" : "From"}</label>
            <DatePicker className="input-field w-36" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-500 mb-1.5">{ar() ? "إلى تاريخ" : "To"}</label>
            <DatePicker className="input-field w-36" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={() => load()} disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}>
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
            </svg>
            {ar() ? "تحديث" : "Refresh"}
          </button>
        </div>

        <div className="overflow-auto border border-surface-200 rounded-xl" style={{ maxHeight: 340 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{ar() ? "الحالة" : "Status"}</th>
                <th>{ar() ? "العيادة" : "Clinic"}</th>
                <th>{ar() ? "العميل" : "Customer"}</th>
                <th>{ar() ? "موعد مقترح" : "Proposed"}</th>
                <th>{ar() ? "أُنشئ" : "Created"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td><StatusPill status={it.status} /></td>
                  <td>{ar() ? (it.clinicNameAr ?? it.clinicNameEn ?? it.clinicId) : (it.clinicNameEn ?? it.clinicNameAr ?? it.clinicId)}</td>
                  <td className="font-mono text-xs">{it.userId}</td>
                  <td>{it.proposedAt ? fmtDateTime(it.proposedAt) : "—"}</td>
                  <td>{fmtDateTime(it.createdAt)}</td>
                  <td className="text-end">
                    {it.conversationId && (
                      <button className="btn-primary btn-sm" onClick={() => setSelectedConvId(it.conversationId!)}>
                        {ar() ? "عرض المحادثة" : "View chat"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                          <path fillRule="evenodd" d="M6.912 3a3 3 0 00-2.868 2.118l-2.411 7.838a3 3 0 00-.133.882V18a3 3 0 003 3h15a3 3 0 003-3v-4.162c0-.299-.045-.596-.133-.882l-2.412-7.838A3 3 0 0017.088 3H6.912zm13.823 9.75l-2.213-7.191A1.5 1.5 0 0017.088 4.5H6.912a1.5 1.5 0 00-1.434 1.059L3.265 12.75H6.11a3 3 0 012.684 1.658l.256.513a1.5 1.5 0 001.342.829h3.218a1.5 1.5 0 001.342-.83l.256-.512a3 3 0 012.684-1.658h2.844z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="empty-state-title">{ar() ? "لا توجد نتائج" : "No results found"}</p>
                      <p className="empty-state-sub">{ar() ? "جرّب تغيير الفلاتر للعثور على طلبات الحجز" : "Try adjusting your filters to find booking requests"}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ChatWidget adminMode conversationId={selectedConvId ?? undefined} />
    </div>
  );
}
