import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../app/AuthContext";
import { apiFetch } from "../lib/api";
import ChatWidget from "./ChatWidget";
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

const STATUSES = ["all", "open", "under_review", "slot_proposed", "slot_accepted", "confirmed", "rejected", "cancelled"] as const;

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
      <div className="card-elevated bg-white border border-surface-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">{ar() ? "الحالة" : "Status"}</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">{ar() ? "العيادة" : "Clinic"}</label>
            <select className="input" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
              <option value="">{ar() ? "كل العيادات" : "All clinics"}</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>{ar() ? (c.nameAr ?? c.nameEn) : (c.nameEn ?? c.nameAr)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">{ar() ? "من تاريخ" : "From"}</label>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1">{ar() ? "إلى تاريخ" : "To"}</label>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={() => load()} disabled={loading}>
            {loading ? (ar() ? "..." : "...") : ar() ? "تحديث" : "Refresh"}
          </button>
          <div className="ms-auto text-xs text-surface-500">{filtered.length} {ar() ? "طلب" : "requests"}</div>
        </div>

        <div className="overflow-auto border border-surface-200 rounded-lg" style={{ maxHeight: 320 }}>
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-600 text-xs uppercase">
              <tr>
                <th className="text-start px-3 py-2">{ar() ? "الحالة" : "Status"}</th>
                <th className="text-start px-3 py-2">{ar() ? "العيادة" : "Clinic"}</th>
                <th className="text-start px-3 py-2">{ar() ? "العميل" : "Customer"}</th>
                <th className="text-start px-3 py-2">{ar() ? "موعد مقترح" : "Proposed"}</th>
                <th className="text-start px-3 py-2">{ar() ? "أُنشئ" : "Created"}</th>
                <th className="text-start px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-t border-surface-100 hover:bg-surface-50">
                  <td className="px-3 py-2"><span className="badge">{it.status}</span></td>
                  <td className="px-3 py-2">{ar() ? (it.clinicNameAr ?? it.clinicNameEn ?? it.clinicId) : (it.clinicNameEn ?? it.clinicNameAr ?? it.clinicId)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{it.userId}</td>
                  <td className="px-3 py-2">{it.proposedAt ? new Date(it.proposedAt).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2">{new Date(it.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-end">
                    {it.conversationId && (
                      <button className="btn-secondary btn-xs" onClick={() => setSelectedConvId(it.conversationId!)}>
                        {ar() ? "عرض المحادثة" : "View chat"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-surface-400 py-8">{ar() ? "لا توجد نتائج" : "No results"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ChatWidget adminMode conversationId={selectedConvId ?? undefined} />
    </div>
  );
}
