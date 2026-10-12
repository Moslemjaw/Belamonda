import { useMemo, useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { invalidateCache } from "../../../hooks/useApi";
import { ar } from "./shared";

type Offer = {
  id: string;
  name: string;
  subscriptionPriceKwd?: string;
  validityDays?: number;
  maxSessions?: number | null;
  enrolledCount?: number;
  fullPaymentEFormId?: string | null;
  allowDeposit?: boolean;
  createdAt?: string;
  status?: string;
};

type Report = {
  keep: { id: string; name: string };
  duplicates: { id: string; name: string }[];
  moves: Record<string, number>;
  differences: { affectsExisting: Diff[]; purchaseOnly: Diff[] };
  newBookingForms: { id: string; title: string }[];
  needsConfirmation: boolean;
};
type Diff = { field: string; kept: unknown; duplicate: unknown; offerId: string };

const MOVE_LABELS: Record<string, [string, string]> = {
  memberships: ["Memberships", "العضويات"],
  activeMemberships: ["…of which active / awaiting payment", "…منها نشطة / بانتظار الدفع"],
  bookingRequests: ["Booking requests", "طلبات الحجز"],
  sessions: ["Sessions", "الجلسات"],
  payments: ["Payments", "المدفوعات"],
  clinicChanges: ["Clinic change requests", "طلبات تغيير العيادة"],
  promotions: ["Promotions listing it", "العروض الترويجية"],
  formsTargeting: ["E-forms attached", "النماذج المرتبطة"],
  submissions: ["Signed e-forms", "النماذج الموقعة"]
};

/** Default copy to keep: most customers, then the one with an e-form, then the oldest. */
function defaultKeep(copies: Offer[]) {
  return [...copies].sort(
    (a, b) =>
      (b.enrolledCount ?? 0) - (a.enrolledCount ?? 0) ||
      Number(!!b.fullPaymentEFormId) - Number(!!a.fullPaymentEFormId) ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  )[0].id;
}

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function MergeDuplicatesPanel({ offers, onClose, onMerged }: { offers: Offer[]; onClose: () => void; onMerged: () => void }) {
  const { getAuthHeader } = useAuth();
  const groups = useMemo(() => {
    const m = new Map<string, Offer[]>();
    for (const o of offers) {
      const k = (o.name || "").trim().toLowerCase();
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  }, [offers]);

  const [keepBy, setKeepBy] = useState<Record<string, string>>({});
  const [report, setReport] = useState<{ key: string; data: Report } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const keyOf = (g: Offer[]) => g[0].name.trim().toLowerCase();
  const keepFor = (g: Offer[]) => keepBy[keyOf(g)] ?? defaultKeep(g);

  const call = async (g: Offer[], dryRun: boolean) => {
    const keepId = keepFor(g);
    const mergeIds = g.map((o) => o.id).filter((id) => id !== keepId);
    return apiFetch<any>("/offers/admin/merge", {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ keepId, mergeIds, dryRun, acceptDifferences: !dryRun && accepted })
    });
  };

  const preview = async (g: Offer[]) => {
    setBusy(true); setMsg(null); setAccepted(false);
    try { setReport({ key: keyOf(g), data: await call(g, true) }); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  const doMerge = async (g: Offer[]) => {
    setBusy(true); setMsg(null);
    try {
      await call(g, false);
      invalidateCache("/offers");
      setReport(null);
      setMsg(ar() ? `تم دمج "${g[0].name}".` : `Merged "${g[0].name}" into one.`);
      onMerged();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="card p-5 mb-6 border border-brand-pink-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "دمج العضويات المكررة" : "Merge duplicate memberships"}</h3>
        <button className="btn-secondary btn-sm" onClick={onClose}>{ar() ? "إغلاق" : "Close"}</button>
      </div>
      <p className="text-xs text-surface-500 mb-4">
        {ar()
          ? "اختر النسخة التي ستبقى. كل العضويات والحجوزات والمدفوعات والنماذج تنتقل إليها، وتُخفى النسخ الأخرى (لا تُحذف). اعرض المعاينة أولاً."
          : "Choose the copy to keep. Every membership, booking, payment and e-form moves to it; the other copies are hidden (not deleted). Preview first."}
      </p>
      {msg && <div className="mb-3 text-sm font-semibold text-brand-pink-700">{msg}</div>}
      {groups.length === 0 && <div className="text-sm text-surface-500">{ar() ? "لا توجد عضويات مكررة." : "No duplicate memberships found."}</div>}

      {groups.map((g) => {
        const k = keyOf(g);
        const keepId = keepFor(g);
        const r = report?.key === k ? report.data : null;
        return (
          <div key={k} className="rounded-xl border border-surface-200 p-4 mb-4">
            <div className="font-bold text-surface-900 mb-2">{g[0].name} <span className="text-xs text-surface-400">· {g.length} {ar() ? "نسخ" : "copies"}</span></div>
            <table className="w-full text-xs mb-3">
              <thead><tr className="text-surface-400 text-left">
                <th className="py-1">{ar() ? "إبقاء" : "Keep"}</th><th>ID</th><th>{ar() ? "أُنشئ" : "Created"}</th><th>{ar() ? "السعر" : "Price"}</th>
                <th>{ar() ? "الجلسات" : "Sessions"}</th><th>{ar() ? "مشتركون" : "Enrolled"}</th><th>{ar() ? "نموذج" : "E-form"}</th><th>{ar() ? "عربون" : "Deposit"}</th>
              </tr></thead>
              <tbody>
                {g.map((o) => (
                  <tr key={o.id} className={o.id === keepId ? "bg-brand-pink-50" : ""}>
                    <td className="py-1"><input type="radio" name={`keep-${k}`} checked={o.id === keepId} onChange={() => { setKeepBy((s) => ({ ...s, [k]: o.id })); setReport(null); }} /></td>
                    <td className="font-mono">…{o.id.slice(-6)}</td>
                    <td>{o.createdAt ? o.createdAt.slice(0, 10) : "—"}</td>
                    <td>{o.subscriptionPriceKwd ?? "—"}</td>
                    <td>{o.maxSessions ?? "∞"}</td>
                    <td>{o.enrolledCount ?? 0}</td>
                    <td>{o.fullPaymentEFormId ? "✓" : "—"}</td>
                    <td>{o.allowDeposit ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!r ? (
              <button className="btn-secondary btn-sm" disabled={busy} onClick={() => void preview(g)}>{busy ? "…" : (ar() ? "معاينة الدمج" : "Preview merge")}</button>
            ) : (
              <div className="rounded-lg bg-surface-50 p-3 text-xs space-y-2">
                <div className="font-bold text-surface-800">{ar() ? "ما سينتقل إلى النسخة المحتفظ بها:" : "What will move to the kept copy:"}</div>
                <ul className="grid grid-cols-2 gap-x-4">
                  {Object.entries(r.moves).map(([key, n]) => (
                    <li key={key}>{(MOVE_LABELS[key] ?? [key, key])[ar() ? 1 : 0]}: <b>{n}</b></li>
                  ))}
                </ul>
                {r.differences.affectsExisting.length > 0 && (
                  <div className="text-red-700">
                    <div className="font-bold">{ar() ? "إعدادات مختلفة تؤثر على العملاء الحاليين:" : "Different settings that affect existing customers:"}</div>
                    {r.differences.affectsExisting.map((d, i) => <div key={i}>{d.field}: {ar() ? "المحتفظ بها" : "kept"} {fmt(d.kept)} · {ar() ? "المكررة" : "duplicate"} {fmt(d.duplicate)}</div>)}
                  </div>
                )}
                {r.differences.purchaseOnly.length > 0 && (
                  <div className="text-surface-600">
                    <div className="font-bold">{ar() ? "اختلافات تخص الشراء الجديد فقط:" : "Differences that only apply to new purchases:"}</div>
                    {r.differences.purchaseOnly.map((d, i) => <div key={i}>{d.field}: {ar() ? "المحتفظ بها" : "kept"} {fmt(d.kept)} · {ar() ? "المكررة" : "duplicate"} {fmt(d.duplicate)}</div>)}
                  </div>
                )}
                {r.newBookingForms.length > 0 && (
                  <div className="text-red-700">{ar() ? "نماذج مطلوبة قبل الحجز على النسخة المحتفظ بها:" : "E-forms the kept copy requires before booking:"} {r.newBookingForms.map((f) => f.title).join(", ")}</div>
                )}
                {r.needsConfirmation && (
                  <label className="flex items-start gap-2 text-red-700 font-semibold">
                    <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                    {ar() ? "أفهم أن عضويات العملاء المنقولة ستتبع إعدادات النسخة المحتفظ بها." : "I understand moved customers' memberships will follow the kept copy's settings."}
                  </label>
                )}
                <div className="flex gap-2 pt-1">
                  <button className="btn-secondary btn-sm" disabled={busy} onClick={() => setReport(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
                  <button className="btn-primary btn-sm" disabled={busy || (r.needsConfirmation && !accepted)} onClick={() => void doMerge(g)}>
                    {busy ? "…" : (ar() ? `دمج ${r.duplicates.length} نسخ` : `Merge ${r.duplicates.length} ${r.duplicates.length === 1 ? "copy" : "copies"} into the kept one`)}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
