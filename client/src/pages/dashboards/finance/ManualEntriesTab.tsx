import React, { useState, useEffect } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { KpiCard } from "../../../components/KpiCard";
import { fmtDate } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { ar, fmt, parseKwd, METHOD_LABELS, METHOD_COLORS, MANUAL_METHODS, MANUAL_PURPOSES, MANUAL_STATUSES } from "./shared";
import type { ManualEntry } from "./shared";

export function ManualEntriesTab({ from, to }: { from?: string; to?: string }) {
  const { getAuthHeader } = useAuth();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [purpose, setPurpose] = useState("manual_entry");
  const [status, setStatus] = useState("completed");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [clinicId, setClinicId] = useState("");
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const clinics = clinicsData?.items ?? [];
  const [ref, setRef] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── List state ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () => {
    setLoadingList(true);
    let url = "/reporting/finance/manual-payments?";
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}`;
    apiFetch(url, { headers: getAuthHeader() })
      .then((d: any) => setEntries(d.items || []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  };

  useEffect(() => { load(); }, [from, to]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setSaveMsg({ type: "err", text: ar() ? "يرجى إدخال مبلغ صحيح" : "Please enter a valid amount" });
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = {
        amountKwd: parseFloat(amount).toFixed(3),
        method, purpose, status,
        paymentDate: new Date(paymentDate).toISOString(),
      };
      if (clinicId) body.clinicId = clinicId;
      if (label.trim()) body.manualLabel = label.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (ref.trim()) body.providerRef = ref.trim();

      await apiFetch("/reporting/finance/manual-payment", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaveMsg({ type: "ok", text: ar() ? "تم إضافة القيد بنجاح" : "Entry added successfully" });
      setAmount(""); setLabel(""); setNotes(""); setRef(""); setClinicId("");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      load();
    } catch (err: any) {
      setSaveMsg({ type: "err", text: err?.message || "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiFetch(`/reporting/finance/manual-payment/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      setEntries(prev => prev.filter(e => e.id !== id));
      setConfirmDelete(null);
    } catch {
      alert(ar() ? "فشل الحذف" : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  // KPI summary of entries
  const totalCompleted = entries
    .filter(e => e.status === "completed")
    .reduce((s, e) => s + parseKwd(e.amountKwd), 0);

  const purposeLabel = (p: string) =>
    MANUAL_PURPOSES.find(x => x.value === p)?.label ?? p;
  const methodLabel = (m: string) =>
    MANUAL_METHODS.find(x => x.value === m)?.label ?? m;
  const statusBadge: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    refunded: "bg-surface-100 text-surface-500",
    failed: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label={ar() ? "إجمالي القيود المسجّلة" : "Total Manual Entries"} value={String(entries.length)} accent="pink" icon="📋" />
        <KpiCard label={ar() ? "إجمالي المبالغ المكتملة" : "Total Completed Amount"} value={`${fmt(totalCompleted / 1000)} KWD`} accent="emerald" icon="✅" />
        <KpiCard
          label={ar() ? "معلّقة" : "Pending Entries"}
          value={String(entries.filter(e => e.status === "pending").length)}
          accent="amber"
          icon="⏳"
        />
      </div>

      {/* Add Entry Form */}
      <div className="card-elevated p-6">
        <h4 className="font-bold text-surface-900 mb-1 flex items-center gap-2 text-base">
          <span className="w-7 h-7 rounded-lg bg-brand-pink-100 text-brand-pink-600 flex items-center justify-center text-sm">＋</span>
          {ar() ? "إضافة قيد دفع يدوي" : "Add Manual Payment Entry"}
        </h4>
        <p className="text-xs text-surface-400 mb-5">
          {ar()
            ? "استخدم هذا النموذج لتسجيل دفعات لم تُسجَّل تلقائياً في النظام. ستظهر في جميع التقارير المالية."
            : "Use this form to record payments that were not automatically captured by the system. They will appear in all financial reports."}
        </p>
        {saveMsg && (
          <div className={`text-xs mb-4 px-3 py-2 rounded-lg font-medium ${saveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {saveMsg.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "المبلغ (KWD)" : "Amount (KWD)"} <span className="text-red-500">*</span></label>
            <input
              type="number" step="0.001" min="0.001"
              className="input-field"
              placeholder="0.000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"} <span className="text-red-500">*</span></label>
            <select className="select-field" value={method} onChange={e => setMethod(e.target.value)}>
              {MANUAL_METHODS.map(m => <option key={m.value} value={m.value}>{ar() ? METHOD_LABELS[m.value] ?? m.label : m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "نوع الدفعة" : "Purpose"}</label>
            <select className="select-field" value={purpose} onChange={e => setPurpose(e.target.value)}>
              {MANUAL_PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الحالة" : "Status"}</label>
            <select className="select-field" value={status} onChange={e => setStatus(e.target.value)}>
              {MANUAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "العيادة" : "Clinic"}</label>
            <select className="select-field" value={clinicId} onChange={e => setClinicId(e.target.value)}>
              <option value="">{ar() ? "بدون عيادة (الشركة)" : "No Clinic (Corporate)"}</option>
              {clinics.map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "تاريخ الدفعة" : "Payment Date"}</label>
            <DatePicker
              className="input-field"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم المرجع / الإيصال" : "Reference / Receipt #"}</label>
            <input type="text" className="input-field" placeholder="TXN-0001" value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "التسمية / الوصف" : "Label / Description"}</label>
            <input type="text" className="input-field" placeholder={ar() ? "مثال: دفعة عميل أحمد" : "e.g. Payment from customer Ahmed"} value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "ملاحظات إضافية" : "Additional Notes"}</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder={ar() ? "أي معلومات إضافية عن هذه الدفعة..." : "Any extra context about this payment..."}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary px-8">
              {saving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "إضافة القيد" : "Add Entry")}
            </button>
          </div>
        </form>
      </div>

      {/* Entries List */}
      <div className="card-elevated overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div>
            <div className="font-bold text-surface-900 text-sm">{ar() ? "القيود اليدوية المسجّلة" : "Recorded Manual Entries"}</div>
            <div className="text-xs text-surface-400 mt-0.5">{ar() ? "جميع هذه القيود مُدرجة في التقارير المالية الشاملة" : "All entries below are included in all financial reports"}</div>
          </div>
          <button onClick={load} className="btn-ghost btn-sm text-xs border border-surface-200 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {ar() ? "تحديث" : "Refresh"}
          </button>
        </div>

        {loadingList ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : entries.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">📋</div>
            <div className="text-sm font-bold text-surface-700">{ar() ? "لا توجد قيود بعد" : "No manual entries yet"}</div>
            <div className="text-xs text-surface-400 mt-1">{ar() ? "استخدم النموذج أعلاه لإضافة أول قيد" : "Use the form above to add your first entry"}</div>
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-surface-100">
            {entries.map(e => (
              <div key={e.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-emerald-700 text-lg">{e.amountKwd} KWD</div>
                    <div className="text-[11px] text-surface-400 mt-0.5 font-mono">{fmtDate(e.createdAt)} • {new Date(e.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${statusBadge[e.status] ?? "bg-surface-100 text-surface-500"}`}>{e.status}</span>
                </div>
                {(e as any).clinicNameEn && <div className="text-xs text-surface-700 font-medium">🏥 {(e as any).clinicNameEn}</div>}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${METHOD_COLORS[e.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>{methodLabel(e.method)}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">{purposeLabel(e.purpose)}</span>
                </div>
                {e.manualLabel && <div className="text-xs text-surface-600"><span className="text-surface-400 font-medium">{ar() ? "الوصف:" : "Label:"}</span> {e.manualLabel}</div>}
                {e.providerRef && <div className="text-xs text-surface-500 font-mono"><span className="text-surface-400 font-medium">{ar() ? "المرجع:" : "Ref:"}</span> {e.providerRef}</div>}
                {e.notes && <div className="text-xs text-surface-500"><span className="text-surface-400 font-medium">{ar() ? "ملاحظات:" : "Notes:"}</span> {e.notes}</div>}
                <div className="flex justify-end pt-1">
                  {confirmDelete === e.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg">{deleting === e.id ? "…" : (ar() ? "تأكيد الحذف" : "Confirm Delete")}</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-surface-500 hover:text-surface-700 px-3 py-1.5 rounded-lg border border-surface-200">{ar() ? "إلغاء" : "Cancel"}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(e.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      {ar() ? "حذف" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                  <th>{ar() ? "العيادة" : "Clinic"}</th>
                  <th>{ar() ? "المبلغ" : "Amount"}</th>
                  <th>{ar() ? "الطريقة" : "Method"}</th>
                  <th>{ar() ? "النوع" : "Purpose"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                  <th>{ar() ? "الوصف" : "Label"}</th>
                  <th>{ar() ? "المرجع" : "Ref"}</th>
                  <th>{ar() ? "ملاحظات" : "Notes"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-xs font-mono text-surface-500 whitespace-nowrap">
                      {fmtDate(e.createdAt)}<br />
                      <span className="text-[10px]">{new Date(e.createdAt).toLocaleTimeString()}</span>
                    </td>
                    <td className="font-medium text-surface-900 whitespace-nowrap text-xs">
                      {(e as any).clinicNameEn || "—"}
                    </td>
                    <td className="font-black text-emerald-700 whitespace-nowrap">{e.amountKwd} KWD</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${METHOD_COLORS[e.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                        {methodLabel(e.method)}
                      </span>
                    </td>
                    <td className="text-xs text-surface-600">{purposeLabel(e.purpose)}</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge[e.status] ?? "bg-surface-100 text-surface-500"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="text-xs max-w-[140px] truncate" title={e.manualLabel}>{e.manualLabel || <span className="text-surface-300">—</span>}</td>
                    <td className="text-xs font-mono text-surface-500">{e.providerRef || <span className="text-surface-300">—</span>}</td>
                    <td className="text-xs max-w-[160px] truncate text-surface-500" title={e.notes}>{e.notes || <span className="text-surface-300">—</span>}</td>
                    <td>
                      {confirmDelete === e.id ? (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(e.id)}
                            disabled={deleting === e.id}
                            className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg"
                          >
                            {deleting === e.id ? "…" : (ar() ? "تأكيد" : "Confirm")}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-surface-500 hover:text-surface-700 px-2 py-1 rounded-lg border border-surface-200">
                            {ar() ? "إلغاء" : "Cancel"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(e.id)}
                          className="text-surface-400 hover:text-red-500 transition-colors p-1"
                          title={ar() ? "حذف" : "Delete"}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// EFORMS VIEWER
// ===========================================================================
