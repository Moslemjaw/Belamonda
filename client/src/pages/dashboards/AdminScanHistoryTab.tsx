import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { fmtDateTime } from "../../lib/dateFormat";

const ar = () => i18n.language === "ar";

interface ScanLogItem {
  id: string;
  userId: string;
  userName: string;
  userPhone?: string;
  clinicId: string;
  clinicNameEn?: string;
  clinicNameAr?: string;
  userOfferId?: string;
  offerName?: string;
  scannedAt?: string;
  createdAt: string;
  hadScheduledSession?: boolean;
  status: "attended" | "no_scheduled_session" | string;
  scannedByUserId?: string;
  scannedByName?: string;
}

export default function AdminScanHistoryTab() {
  const { getAuthHeader } = useAuth();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClinic, setSelectedClinic] = useState("all");
  const [selectedMembership, setSelectedMembership] = useState("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Data fetching: Clinics & Offers
  const { data: clinicsData } = useApi<{ clinics?: any[]; items?: any[] }>("/clinics/admin");
  const clinics = clinicsData?.clinics || clinicsData?.items || [];

  const { data: offersData } = useApi<{ items?: any[] }>("/offers/admin");
  const offers = offersData?.items || [];

  // Data fetching: Scan History
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScanHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await apiFetch("/scheduling/admin/scan-logs", {
        headers: getAuthHeader(),
      })) as { items: ScanLogItem[] };
      setScanLogs(res.items || []);
    } catch {
      setScanLogs([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchScanHistory();
  }, [fetchScanHistory]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClinic, selectedMembership]);

  // Filtered Scan Logs
  const filteredLogs = useMemo(() => {
    return scanLogs.filter((item) => {
      // Clinic filter
      if (selectedClinic !== "all" && String(item.clinicId) !== selectedClinic) {
        return false;
      }
      // Membership filter
      if (selectedMembership !== "all" && String(item.userOfferId) !== selectedMembership) {
        return false;
      }
      // Search query (Customer Name / Phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (item.userName || "").toLowerCase();
        const phone = (item.userPhone || "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [scanLogs, selectedClinic, selectedMembership, searchQuery]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-surface-900">
            {ar() ? "سجل المسح" : "Scan History"}
          </h3>
          <p className="text-sm text-surface-500 mt-1">
            {ar()
              ? "عرض سجل المسح الضوئي لبطاقات العضوية بالعيادات"
              : "View QR scan logs and membership verifications across clinics"}
          </p>
        </div>
        <button
          onClick={fetchScanHistory}
          className="btn-secondary shrink-0 hidden sm:flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {ar() ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex flex-wrap gap-3 items-center">
        {/* Search Input */}
        <div className="flex-1 min-w-[240px] relative">
          <svg
            className={`w-5 h-5 text-surface-400 absolute top-1/2 -translate-y-1/2 ${
              ar() ? "right-3" : "left-3"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={ar() ? "بحث باسم العميل أو رقم الهاتف..." : "Search by Customer Name or Phone..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`input-field w-full ${ar() ? "pr-10" : "pl-10"}`}
          />
        </div>

        {/* Clinic Filter Dropdown */}
        <div className="w-full sm:w-auto min-w-[180px]">
          <select
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="input-field w-full font-medium text-surface-700"
          >
            <option value="all">{ar() ? "جميع العيادات" : "All Clinics"}</option>
            {clinics.map((c: any) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {ar() ? c.nameAr || c.nameEn : c.nameEn || c.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* Membership Filter Dropdown */}
        <div className="w-full sm:w-auto min-w-[180px]">
          <select
            value={selectedMembership}
            onChange={(e) => setSelectedMembership(e.target.value)}
            className="input-field w-full font-medium text-surface-700"
          >
            <option value="all">{ar() ? "جميع العضويات" : "All Memberships"}</option>
            {offers.map((o: any) => (
              <option key={o.id || o._id} value={o.id || o._id}>
                {ar() ? o.nameAr || o.name : o.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchScanHistory}
          className="btn-secondary w-full sm:hidden flex justify-center items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {ar() ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* Table & Loading / Empty State */}
      <div className="card-elevated overflow-hidden border border-surface-200">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="w-8 h-8 animate-spin text-brand-pink-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-surface-600">
              <thead className="bg-surface-50 border-b border-surface-200 text-surface-700 uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="px-5 py-4">{ar() ? "العميل" : "Customer"}</th>
                  <th className="px-5 py-4">{ar() ? "العيادة" : "Clinic"}</th>
                  <th className="px-5 py-4">{ar() ? "العضوية" : "Membership"}</th>
                  <th className="px-5 py-4">{ar() ? "تاريخ ووقت المسح" : "Scan Date & Time"}</th>
                  <th className="px-5 py-4">{ar() ? "الحالة / النتيجة" : "Status / Result"}</th>
                  <th className="px-5 py-4">{ar() ? "بواسطة" : "Scanned By"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-surface-500">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-10 h-10 text-surface-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        <p className="font-bold text-surface-700">{ar() ? "لا توجد سجلاّت مسح." : "No scan logs found."}</p>
                        <p className="text-xs text-surface-400 mt-1">{ar() ? "حاول تغيير خيارات البحث أو الفلترة." : "Try adjusting your search query or filters."}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const isAttended = log.status === "attended" || log.hadScheduledSession;
                    return (
                      <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                        {/* Customer */}
                        <td className="px-5 py-4">
                          <div className="font-bold text-surface-900">{log.userName || "—"}</div>
                          <div className="text-xs text-surface-500" dir="ltr">{log.userPhone || "—"}</div>
                        </td>

                        {/* Clinic */}
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-800">
                            {ar() ? log.clinicNameAr || log.clinicNameEn : log.clinicNameEn || log.clinicNameAr}
                          </span>
                        </td>

                        {/* Membership */}
                        <td className="px-5 py-4 font-medium text-surface-700">
                          {log.offerName || "—"}
                        </td>

                        {/* Scan Date & Time */}
                        <td className="px-5 py-4 whitespace-nowrap text-xs font-medium text-surface-600">
                          {fmtDateTime(log.scannedAt || log.createdAt)}
                        </td>

                        {/* Status / Result */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isAttended ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {ar() ? "تم الحضور" : "Attended"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {ar() ? "لا توجد جلسة مجدولة" : "No Scheduled Session"}
                            </span>
                          )}
                        </td>

                        {/* Scanned By */}
                        <td className="px-5 py-4 text-xs font-medium text-surface-700">
                          {log.scannedByName || "Clinic Staff"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredLogs.length > 0 && (
          <div className="px-5 py-4 bg-surface-50 border-t border-surface-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-surface-500 font-medium">
              {ar()
                ? `عرض ${(currentPage - 1) * itemsPerPage + 1} إلى ${Math.min(
                    currentPage * itemsPerPage,
                    filteredLogs.length
                  )} من أصل ${filteredLogs.length} سجل`
                : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(
                    currentPage * itemsPerPage,
                    filteredLogs.length
                  )} of ${filteredLogs.length} entries`}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-xs font-bold text-surface-700 hover:bg-surface-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ar() ? "السابق" : "Previous"}
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((page, idx, arr) => {
                  const prevPage = arr[idx - 1];
                  const showEllipsis = prevPage && page - prevPage > 1;
                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsis && <span className="px-1 text-xs text-surface-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          currentPage === page
                            ? "bg-brand-pink-500 text-white"
                            : "border border-surface-200 bg-white text-surface-700 hover:bg-surface-100"
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-xs font-bold text-surface-700 hover:bg-surface-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ar() ? "التالي" : "Next"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
