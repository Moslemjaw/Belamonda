import { useState } from "react";
import { useComplaints } from "../../../hooks/useApi";
import { fmtDate } from "../../../lib/dateFormat";
import { ar, translateComplaintStatus } from "./shared";
import { ComplaintModal } from "./ComplaintModal";

export function ComplaintsView() {
  const { data, refetch } = useComplaints();
  const [selectedId, setSelectedId] = useState<string|null>(null);
  
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const filteredItems = (data?.items || []).filter((c: any) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterCategory !== "all" && c.category !== filterCategory) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const subject = c.subject || "";
      const userName = c.userName || c.userId || "";
      if (!subject.toLowerCase().includes(q) && !userName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "الشكاوى" : "Complaints"}</h3>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto bg-surface-50/50 p-2 rounded-2xl border border-surface-100">
          <div className="relative w-full sm:w-64">
            <svg className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder={ar() ? "بحث بالاسم أو الموضوع..." : "Search name or subject..."}
              className={`input-field text-sm py-1.5 w-full ${ar() ? 'pr-9' : 'pl-9'}`}
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">{ar() ? "جميع الحالات" : "All Statuses"}</option>
              <option value="open">{ar() ? "مفتوح" : "Open"}</option>
              <option value="in_progress">{ar() ? "قيد المعالجة" : "In Progress"}</option>
              <option value="escalated">{ar() ? "تم التصعيد" : "Escalated"}</option>
              <option value="resolved">{ar() ? "محلول" : "Resolved"}</option>
              <option value="closed">{ar() ? "مغلق" : "Closed"}</option>
            </select>
            <select 
              className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">{ar() ? "جميع الفئات" : "All Categories"}</option>
              <option value="clinic">{ar() ? "عيادة" : "Clinic"}</option>
              <option value="booking">{ar() ? "حجز" : "Booking"}</option>
              <option value="payment">{ar() ? "دفع" : "Payment"}</option>
              <option value="technical">{ar() ? "تقني" : "Technical"}</option>
              <option value="other">{ar() ? "أخرى" : "Other"}</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "المرسل" : "From"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
            <tbody>
              {filteredItems.map((c: any) => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="cursor-pointer hover:bg-surface-50 transition-colors">
                  <td className="font-medium">{c.subject}</td>
                  <td className="text-sm font-bold text-surface-700">{c.userName || c.userId}</td>
                  <td><span className="badge-sage">{c.category}</span></td>
                  <td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{translateComplaintStatus(c.status)}</span></td>
                  <td className="text-xs">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد شكاوى" : "No complaints"}</div><div className="empty-state-sub">{ar() ? "لم يتم العثور على نتائج للفلتر الحالي." : "No results found for the current filters."}</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {selectedId && <ComplaintModal id={selectedId} onClose={() => setSelectedId(null)} onUpdated={refetch} />}
    </div>
  );
}
