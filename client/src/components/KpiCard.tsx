import React from "react";

export function KpiCard({ 
  label, 
  value, 
  sub, 
  icon, 
  isHighlighted, 
  trend, 
  accent = "pink",
  onClick,
  className = ""
}: { 
  label: string; 
  value: string | number; 
  sub?: string; 
  icon: React.ReactNode; 
  isHighlighted?: boolean; 
  trend?: string; 
  accent?: "pink" | "teal" | "amber" | "blue" | "violet" | "emerald" | "rose" | "red" | "indigo";
  onClick?: () => void;
  className?: string;
}) {
  const accentMap: Record<string, { iconBg: string; iconText: string; border: string }> = {
    pink:    { iconBg: "bg-brand-pink-50",  iconText: "text-brand-pink-600",  border: "border-b-brand-pink-400" },
    teal:    { iconBg: "bg-brand-sage-50",  iconText: "text-brand-sage-700",  border: "border-b-brand-sage-400" },
    amber:   { iconBg: "bg-amber-50",       iconText: "text-amber-600",       border: "border-b-amber-400" },
    blue:    { iconBg: "bg-blue-50",        iconText: "text-blue-600",        border: "border-b-blue-400" },
    violet:  { iconBg: "bg-violet-50",      iconText: "text-violet-600",      border: "border-b-violet-400" },
    emerald: { iconBg: "bg-emerald-50",     iconText: "text-emerald-600",     border: "border-b-emerald-400" },
    rose:    { iconBg: "bg-rose-50",        iconText: "text-rose-600",        border: "border-b-rose-400" },
    red:     { iconBg: "bg-red-50",         iconText: "text-red-600",         border: "border-b-red-400" },
    indigo:  { iconBg: "bg-indigo-50",      iconText: "text-indigo-600",      border: "border-b-indigo-400" },
  };

  const a = accentMap[accent] || accentMap.pink;

  return (
    <div onClick={onClick} className={`relative p-4 rounded-2xl border-b-[3px] border border-surface-200 ${isHighlighted ? 'bg-gradient-to-br from-brand-pink-500 to-brand-pink-600 border-brand-pink-500 border-b-brand-pink-300 text-white shadow-xl shadow-brand-pink-500/20' : `bg-white ${a.border}`} group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      <div className="flex items-center gap-3.5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${isHighlighted ? 'bg-white/20 text-white backdrop-blur-md' : `${a.iconBg} ${a.iconText}`}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isHighlighted ? 'text-brand-pink-100' : 'text-surface-400'}`}>{label}</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-black leading-none ${isHighlighted ? 'text-white' : 'text-surface-900'}`}>{value}</div>
            {trend && (
              <div className={`flex items-center gap-0.5 text-[10px] font-bold ${isHighlighted ? 'text-brand-pink-200' : 'text-emerald-600'}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                {trend}
              </div>
            )}
          </div>
          {sub && <div className={`text-[11px] font-medium mt-0.5 ${isHighlighted ? 'text-brand-pink-200' : 'text-surface-400'}`}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
