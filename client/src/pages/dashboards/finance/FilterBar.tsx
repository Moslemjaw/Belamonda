import { useState, useEffect } from "react";
import DatePicker from "../../../components/DatePicker";
import { ar, isoDate } from "./shared";

export function FilterBar({
  from, to,
  onCustomDateChange,
}: {
  from: string; to: string;
  onCustomDateChange: (from: string, to: string) => void;
}) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);

  const handleApply = () => {
    let f = localFrom;
    let t = localTo;
    
    if (f) {
      const dFrom = new Date(f); dFrom.setUTCHours(0,0,0,0);
      // We assume isoDate is available globally or in this file
      f = dFrom.toISOString(); 
    }
    if (t) {
      const dTo = new Date(t); dTo.setUTCHours(23,59,59,999);
      t = dTo.toISOString();
    }
    
    onCustomDateChange(f, t);
  };

  return (
    <div className="flex items-center justify-center sm:justify-end gap-2 text-xs rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
      <label className="text-surface-500 font-medium">{ar() ? "من" : "From"}</label>
      <DatePicker className="input-field text-xs py-1.5 h-auto max-w-[130px]"
        value={localFrom.slice(0, 10)}
        onChange={e => setLocalFrom(e.target.value)} />
      <label className="text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
      <DatePicker className="input-field text-xs py-1.5 h-auto max-w-[130px]"
        value={localTo.slice(0, 10)}
        onChange={e => setLocalTo(e.target.value)} />
      <button 
        className="btn-primary text-xs py-1.5 px-4 rounded-xl ml-2 rtl:ml-0 rtl:mr-2"
        onClick={handleApply}
      >
        {ar() ? "بحث" : "Search"}
      </button>
    </div>
  );
}

// ===========================================================================
// KPI Card
// ===========================================================================



// ===========================================================================
// HOME / OVERVIEW TAB — KPIs, revenue trend, breakdowns
// ===========================================================================
