import { useEffect, useState } from "react";
import DatePicker from "../../../components/DatePicker";
import { ar } from "./shared";

export function FilterBar({
  from, to,
  onCustomDateChange,
}: {
  from: string; to: string;
  onCustomDateChange: (from: string, to: string) => void;
}) {
  const [localFrom, setLocalFrom] = useState(from.slice(0, 10));
  const [localTo, setLocalTo] = useState(to.slice(0, 10));

  useEffect(() => {
    setLocalFrom(from.slice(0, 10));
    setLocalTo(to.slice(0, 10));
  }, [from, to]);

  const invalid = !!localFrom && !!localTo && localFrom > localTo;

  // Applies as soon as both dates make sense, so there is no extra button to press.
  const change = (nextFrom: string, nextTo: string) => {
    setLocalFrom(nextFrom);
    setLocalTo(nextTo);
    if (nextFrom && nextTo && nextFrom <= nextTo) {
      onCustomDateChange(`${nextFrom}T00:00:00.000Z`, `${nextTo}T23:59:59.999Z`);
    }
  };

  return (
    <div className="text-xs">
      <div className="flex items-center gap-2">
        <label className="text-surface-500 font-medium">{ar() ? "من" : "From"}</label>
        <div className="flex-1 min-w-0 sm:flex-none sm:w-[130px]">
          <DatePicker className="input-field text-xs py-1.5 px-2 h-auto w-full" value={localFrom} onChange={e => change(e.target.value, localTo)} />
        </div>
        <label className="text-surface-500 font-medium">{ar() ? "إلى" : "To"}</label>
        <div className="flex-1 min-w-0 sm:flex-none sm:w-[130px]">
          <DatePicker className="input-field text-xs py-1.5 px-2 h-auto w-full" value={localTo} onChange={e => change(localFrom, e.target.value)} />
        </div>
      </div>
      {invalid && <p className="mt-1 text-[11px] font-medium text-red-600">{ar() ? "تاريخ البداية يجب أن يكون قبل تاريخ النهاية" : "The From date must be before the To date"}</p>}
    </div>
  );
}
