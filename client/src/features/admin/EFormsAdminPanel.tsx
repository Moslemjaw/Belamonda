import { useMemo, useState } from "react";
import html2pdf from "html2pdf.js";
import i18n from "../../app/i18n";
import { useAuth } from "../../app/AuthContext";
import { useApi } from "../../hooks/useApi";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import { FormRenderer, FormDefinition } from "../../components/FormRenderer";

const ar = () => i18n.language === "ar";

const FIELD_TYPES = [
  { v: "short_text", labelEn: "Short text", labelAr: "نص قصير" },
  { v: "long_text", labelEn: "Long text", labelAr: "نص طويل" },
  { v: "single_choice", labelEn: "Single choice", labelAr: "اختيار واحد" },
  { v: "multi_choice", labelEn: "Multi choice", labelAr: "اختيار متعدد" },
  { v: "date", labelEn: "Date", labelAr: "تاريخ" },
  { v: "signature", labelEn: "Signature", labelAr: "توقيع" },
  { v: "file_upload", labelEn: "File upload", labelAr: "رفع ملف" },
  { v: "static_text", labelEn: "Static text (Display)", labelAr: "نص ثابت (للعرض)" }
] as const;

type FieldType = (typeof FIELD_TYPES)[number]["v"];

type FieldDraft = {
  key: string;
  type: FieldType;
  labelEn: string;
  labelAr?: string;
  helpText?: string;
  required: boolean;
  options: string[];
  order: number;
};

type Target = { kind: "offer" | "installment_plan" | "session_type"; refId: string };

type FormItem = {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  fields: FieldDraft[];
  targets: Target[];
  requireBeforeBooking: boolean;
  requireBeforeFirstPayment: boolean;
  archived: boolean;
  version: number;
  createdAt?: string;
};

type SubmissionItem = {
  id: string;
  formId: string;
  formTitle: string;
  formVersion: number;
  userId: string;
  userOfferId?: string;
  signatureRef?: string;
  uploadedFileRefs: string[];
  answers: Array<{ key: string; value: unknown }>;
  formSnapshot: Array<{ key: string; labelEn: string; type: FieldType; order?: number }>;
  createdAt?: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
};

const newFieldKey = () => `f_${Math.random().toString(16).slice(2, 7)}`;

const blankField = (): FieldDraft => ({
  key: newFieldKey(),
  type: "short_text",
  labelEn: "",
  labelAr: "",
  required: false,
  options: [],
  order: 0
});

const blankForm = (): Omit<FormItem, "id" | "archived" | "version"> => ({
  title: "",
  titleAr: "",
  description: "",
  descriptionAr: "",
  fields: [blankField()],
  targets: [],
  requireBeforeBooking: false,
  requireBeforeFirstPayment: false
});

function formItemToDefinition(f: FormItem): FormDefinition {
  return {
    id: f.id,
    title: f.title,
    titleAr: f.titleAr,
    description: f.description,
    descriptionAr: f.descriptionAr,
    fields: f.fields.map((field) => ({
      key: field.key,
      type: field.type,
      labelEn: field.labelEn,
      labelAr: field.labelAr,
      helpText: field.helpText,
      required: field.required,
      options: field.options,
      order: field.order
    }))
  };
}

function SubmissionDetailModal({
  submission,
  onClose,
  onDownload
}: {
  submission: SubmissionItem;
  onClose: () => void;
  onDownload: (s: SubmissionItem) => void;
}) {
  const answerMap = new Map(submission.answers.map((a) => [a.key, a.value]));
  const fields = [...submission.formSnapshot].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-surface-50 rounded-2xl shadow-2xl overflow-hidden">
        <header className="bg-white border-b border-surface-200 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-surface-900 truncate">
              {submission.formTitle}
              <span className="ml-2 text-xs font-normal text-surface-400">v{submission.formVersion}</span>
            </h2>
            <span className="text-xs text-surface-400 font-mono">{submission.id}</span>
          </div>
          <button
            type="button"
            className="text-surface-400 hover:text-surface-700 text-xl font-bold leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs text-surface-500 bg-white rounded-xl border border-surface-100 p-3">
            <div><span className="font-medium text-surface-700">{ar() ? "العميلة" : "Customer"}:</span> <span className="font-mono">{submission.userName || submission.userId}</span></div>
            <div><span className="font-medium text-surface-700">{ar() ? "التاريخ" : "Submitted"}:</span> {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "—"}</div>
            {submission.userOfferId && (
              <div className="col-span-2"><span className="font-medium text-surface-700">Offer:</span> <span className="font-mono">{submission.userOfferId}</span></div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-surface-500">{ar() ? "الإجابات" : "Answers"}</h4>
            {fields.length === 0 && (
              <p className="text-sm text-surface-400">{ar() ? "لا توجد إجابات" : "No answers recorded"}</p>
            )}
            {fields.map((f) => {
              const val = answerMap.get(f.key);
              let display = "—";
              if (f.type === "signature") {
                display = ar() ? "(توقيع مُرفق)" : "(signature attached)";
              } else if (f.type === "file_upload") {
                display = ar() ? "(ملف مُرفق)" : "(file attached)";
              } else if (Array.isArray(val)) {
                display = val.join(", ");
              } else if (val !== undefined && val !== null && val !== "") {
                display = String(val);
              }
              return (
                <div key={f.key} className="bg-white rounded-xl border border-surface-100 px-3 py-2">
                  <div className="text-xs font-medium text-surface-500 mb-0.5">{f.labelEn}</div>
                  <div className="text-sm text-surface-800">{display}</div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2 border-t border-surface-100">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => onDownload(submission)}
            >
              {ar() ? "تنزيل PDF" : "Download PDF"}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
              {ar() ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ form, onClose }: { form: FormItem; onClose: () => void }) {
  const definition = formItemToDefinition(form);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-surface-50 rounded-2xl shadow-2xl overflow-hidden">
        <header className="bg-white border-b border-surface-200 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-base font-bold text-surface-900 truncate">
              {ar() && form.titleAr ? form.titleAr : form.title}
            </h2>
            <span className="text-xs text-surface-400">
              {ar() ? "معاينة النموذج" : "Form preview"}
            </span>
          </div>
          <button
            type="button"
            className="text-surface-400 hover:text-surface-700 text-xl font-bold leading-none"
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </button>
        </header>
        <div className="p-5">
          <FormRenderer form={definition} readOnly />
          <div className="mt-6">
            <button
              type="button"
              className="btn-primary w-full opacity-40 cursor-not-allowed"
              disabled
            >
              {ar() ? "مراجعة وإرسال (معاينة فقط)" : "Review & sign (preview only)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EFormsAdminPanel() {
  const { getAuthHeader, auth } = useAuth();
  const { data: formsData, refetch, loading } = useApi<{ items: FormItem[] }>("/eforms/admin/forms");
  const { data: offersData } = useApi<{ items: Array<{ id: string; name: string }> }>("/offers/admin");
  const { data: subsData, refetch: refetchSubs } = useApi<{ items: SubmissionItem[] }>("/eforms/admin/submissions");

  const isCsDirector = auth?.role === "cs_director";

  const offers = offersData?.items ?? [];
  const forms = formsData?.items ?? [];
  const submissions = subsData?.items ?? [];

  const [view, setView] = useState<"forms" | "submissions">(isCsDirector ? "submissions" : "forms");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<FormItem, "id" | "archived" | "version">>(blankForm());
  const [showEditor, setShowEditor] = useState(false);
  const [filterFormId, setFilterFormId] = useState<string>("");
  const [previewForm, setPreviewForm] = useState<FormItem | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionItem | null>(null);

  const offersById = useMemo(() => new Map(offers.map((o) => [o.id, o.name])), [offers]);
  const filteredSubs = filterFormId ? submissions.filter((s) => s.formId === filterFormId) : submissions;

  const startCreate = () => {
    setEditingId(null);
    setDraft(blankForm());
    setShowEditor(true);
  };
  const startEdit = (f: FormItem) => {
    setEditingId(f.id);
    setDraft({
      title: f.title,
      titleAr: f.titleAr ?? "",
      description: f.description ?? "",
      descriptionAr: f.descriptionAr ?? "",
      fields: f.fields.length ? f.fields : [blankField()],
      targets: f.targets ?? [],
      requireBeforeBooking: f.requireBeforeBooking,
      requireBeforeFirstPayment: f.requireBeforeFirstPayment
    });
    setShowEditor(true);
  };

  const updateField = (idx: number, patch: Partial<FieldDraft>) => {
    setDraft((d) => ({ ...d, fields: d.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)) }));
  };
  const removeField = (idx: number) => setDraft((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== idx) }));
  const addField = () => setDraft((d) => ({ ...d, fields: [...d.fields, { ...blankField(), order: d.fields.length }] }));
  const moveField = (idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d.fields];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return d;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, fields: next.map((f, i) => ({ ...f, order: i })) };
    });
  };

  const addTarget = (val: string) => {
    if (!val) return;
    const [kind, refId] = val.split(":");
    setDraft((d) => {
      if (d.targets.some((t) => t.kind === kind && t.refId === refId)) return d;
      return { ...d, targets: [...d.targets, { kind: kind as Target["kind"], refId }] };
    });
  };
  const removeTarget = (refId: string) =>
    setDraft((d) => ({ ...d, targets: d.targets.filter((t) => t.refId !== refId) }));

  const save = async () => {
    if (!draft.title.trim()) return alert(ar() ? "العنوان مطلوب" : "Title required");
    if (!draft.fields.length) return alert(ar() ? "أضيفي حقلاً واحداً على الأقل" : "Add at least one field");
    const payload = {
      title: draft.title.trim(),
      titleAr: draft.titleAr || undefined,
      description: draft.description || undefined,
      descriptionAr: draft.descriptionAr || undefined,
      fields: draft.fields.map((f, i) => ({
        key: f.key,
        type: f.type,
        labelEn: f.labelEn.trim() || `Field ${i + 1}`,
        labelAr: f.labelAr || undefined,
        helpText: f.helpText || undefined,
        required: !!f.required,
        options: ["single_choice", "multi_choice"].includes(f.type)
          ? f.options.map((o) => o.trim()).filter(Boolean)
          : [],
        order: i
      })),
      targets: draft.targets,
      requireBeforeBooking: !!draft.requireBeforeBooking,
      requireBeforeFirstPayment: !!draft.requireBeforeFirstPayment
    };
    try {
      if (editingId) {
        await apiFetch(`/eforms/admin/forms/${editingId}`, {
          method: "PATCH",
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/eforms/admin/forms", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });
      }
      setShowEditor(false);
      setEditingId(null);
      await refetch();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const archive = async (f: FormItem) => {
    if (!confirm(ar() ? "أرشفة النموذج؟" : "Archive this form?")) return;
    try {
      await apiFetch(`/eforms/admin/forms/${f.id}`, { method: "DELETE", headers: getAuthHeader() });
      await refetch();
    } catch (e: any) { alert(e.message); }
  };

  const downloadPdf = async (s: SubmissionItem) => {
    try {
      const token = (getAuthHeader() as any)?.Authorization?.replace("Bearer ", "");
      const langParam = ar() ? "ar" : "en";
      const url = `${API_BASE_URL}/eforms/submissions/${s.id}/pdf?token=${encodeURIComponent(token || "")}&lang=${langParam}`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load PDF data");
      const htmlText = await res.text();
      
      const container = document.createElement("div");
      container.innerHTML = htmlText;
      document.body.appendChild(container);
      
      // Fix for empty PDF: Ensure container has dimensions and is rendered, but invisible to the user.
      container.style.position = "absolute";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "800px"; // A4 approximate width in pixels
      container.style.zIndex = "-9999";
      container.style.visibility = "hidden";
      container.style.background = "white";

      // Wait a moment for the DOM and fonts to apply
      await new Promise((resolve) => setTimeout(resolve, 500));

      const opt = {
        margin: [0, 0],
        filename: `form-${s.id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      await html2pdf().set(opt).from(container).save();
      container.remove();
    } catch (e: any) {
      alert("Error generating PDF: " + e.message);
    }
  };

  return (
    <div className="space-y-4">
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onDownload={downloadPdf}
        />
      )}
      {previewForm && (
        <PreviewModal form={previewForm} onClose={() => setPreviewForm(null)} />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "النماذج الإلكترونية" : "E-Forms"}</h3>
        <div className="flex gap-2">
          {!isCsDirector && (
            <div className="inline-flex rounded-lg border border-surface-200 overflow-hidden text-xs font-bold">
              <button
                type="button"
                className={`px-3 py-1.5 ${view === "forms" ? "bg-brand-pink-500 text-white" : "bg-white text-surface-600"}`}
                onClick={() => setView("forms")}
              >
                {ar() ? "النماذج" : "Forms"}
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 ${view === "submissions" ? "bg-brand-pink-500 text-white" : "bg-white text-surface-600"}`}
                onClick={() => { setView("submissions"); void refetchSubs(); }}
              >
                {ar() ? "التعبئات" : "Submissions"}
              </button>
            </div>
          )}
          {view === "forms" && !isCsDirector && (
            <button type="button" className="btn-primary btn-sm" onClick={startCreate}>
              + {ar() ? "نموذج جديد" : "New form"}
            </button>
          )}
        </div>
      </div>

      {view === "forms" && (
        <>
          {showEditor && (
            <div className="card-elevated p-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-surface-500">{ar() ? "العنوان (EN)" : "Title (EN)"}</span>
                  <input className="input-field mt-1" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-surface-500">{ar() ? "العنوان (AR)" : "Title (AR)"}</span>
                  <input className="input-field mt-1" dir="rtl" value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-surface-500">{ar() ? "الوصف (EN)" : "Description (EN)"}</span>
                  <textarea className="input-field mt-1" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-surface-500">{ar() ? "الوصف (AR)" : "Description (AR)"}</span>
                  <textarea className="input-field mt-1" dir="rtl" rows={2} value={draft.descriptionAr || ""} onChange={(e) => setDraft({ ...draft, descriptionAr: e.target.value })} />
                </label>
              </div>

              <div className="border-t border-surface-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-surface-900">{ar() ? "الحقول" : "Fields"}</h4>
                  <button type="button" className="btn-secondary btn-sm" onClick={addField}>+ {ar() ? "إضافة حقل" : "Add field"}</button>
                </div>
                <div className="space-y-3">
                  {draft.fields.map((f, i) => (
                    <div key={f.key} className="border border-surface-200 rounded-xl p-3 bg-surface-50">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-surface-400">#{i + 1}</span>
                        <div className="flex gap-1">
                          <button type="button" className="text-xs px-2 py-1 rounded bg-white border" onClick={() => moveField(i, -1)}>↑</button>
                          <button type="button" className="text-xs px-2 py-1 rounded bg-white border" onClick={() => moveField(i, 1)}>↓</button>
                          <button type="button" className="text-xs px-2 py-1 rounded bg-red-50 text-red-600" onClick={() => removeField(i)}>✕</button>
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <label className="block">
                          <span className="text-[10px] font-medium text-surface-500 uppercase">{ar() ? "النوع" : "Type"}</span>
                          <select className="select-field mt-1" value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldType })}>
                            {FIELD_TYPES.map((t) => (
                              <option key={t.v} value={t.v}>{ar() ? t.labelAr : t.labelEn}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-medium text-surface-500 uppercase">{ar() ? "تسمية/النص (EN)" : "Label/Text (EN)"}</span>
                          {f.type === "static_text" ? (
                             <textarea className="input-field mt-1" rows={3} value={f.labelEn} onChange={(e) => updateField(i, { labelEn: e.target.value })} />
                          ) : (
                             <input className="input-field mt-1" value={f.labelEn} onChange={(e) => updateField(i, { labelEn: e.target.value })} />
                          )}
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-medium text-surface-500 uppercase">{ar() ? "تسمية/النص (AR)" : "Label/Text (AR)"}</span>
                          {f.type === "static_text" ? (
                             <textarea className="input-field mt-1" dir="rtl" rows={3} value={f.labelAr ?? ""} onChange={(e) => updateField(i, { labelAr: e.target.value })} />
                          ) : (
                             <input className="input-field mt-1" dir="rtl" value={f.labelAr ?? ""} onChange={(e) => updateField(i, { labelAr: e.target.value })} />
                          )}
                        </label>
                      </div>
                      {(f.type === "single_choice" || f.type === "multi_choice") && (
                        <label className="block mt-2">
                          <span className="text-[10px] font-medium text-surface-500 uppercase">{ar() ? "الخيارات (مفصولة بفاصلة)" : "Options (comma separated)"}</span>
                          <input className="input-field mt-1" value={f.options.join(", ")} onChange={(e) => updateField(i, { options: e.target.value.split(",").map((s) => s.trim()) })} />
                        </label>
                      )}
                      <label className="flex items-center gap-2 text-xs mt-2">
                        <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                        {ar() ? "مطلوب" : "Required"}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-surface-100 pt-4">
                <h4 className="text-sm font-bold text-surface-900 mb-2">{ar() ? "العروض المرتبطة" : "Linked offers"}</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {draft.targets.length === 0 && <span className="text-xs text-surface-400">{ar() ? "لا توجد روابط — النموذج اختياري." : "No links — form is ad-hoc."}</span>}
                  {draft.targets.map((t) => {
                    let label = offersById.get(t.refId) ?? t.refId;
                    if (t.kind === "installment_plan") {
                      if (t.refId === "deposit") label = ar() ? "عربون" : "Deposit";
                      else if (t.refId === "4_enet") label = ar() ? "خطة 4 أقساط (ENET)" : "4 Installments Plan (ENET)";
                      else label = ar() ? `خطة ${t.refId} أقساط` : `${t.refId} Installments Plan`;
                    }
                    return (
                      <span key={`${t.kind}:${t.refId}`} className="inline-flex items-center gap-2 bg-brand-pink-50 text-brand-pink-700 text-xs font-bold px-2 py-1 rounded-lg">
                        {label}
                        <button type="button" className="text-brand-pink-500" onClick={() => removeTarget(t.refId)}>✕</button>
                      </span>
                    );
                  })}
                </div>
                <select className="select-field" defaultValue="" onChange={(e) => { addTarget(e.target.value); e.target.value = ""; }}>
                  <option value="">{ar() ? "أضيفي ربطاً..." : "Add a link..."}</option>
                  <optgroup label={ar() ? "العروض" : "Offers"}>
                    {offers.map((o) => (
                      <option key={o.id} value={`offer:${o.id}`}>{o.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label={ar() ? "خطط الدفع" : "Payment Plans"}>
                    <option value="installment_plan:2">{ar() ? "خطة القسطين" : "2 Installments Plan"}</option>
                    <option value="installment_plan:3">{ar() ? "خطة 3 أقساط" : "3 Installments Plan"}</option>
                    <option value="installment_plan:4_enet">{ar() ? "خطة 4 أقساط (ENET)" : "4 Installments Plan (ENET)"}</option>
                    <option value="installment_plan:deposit">{ar() ? "عربون" : "Deposit"}</option>
                  </optgroup>
                </select>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.requireBeforeBooking} onChange={(e) => setDraft({ ...draft, requireBeforeBooking: e.target.checked })} />
                    {ar() ? "مطلوب قبل الحجز" : "Required before booking"}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.requireBeforeFirstPayment} onChange={(e) => setDraft({ ...draft, requireBeforeFirstPayment: e.target.checked })} />
                    {ar() ? "مطلوب قبل أول دفعة" : "Required before first payment"}
                  </label>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button type="button" className="btn-primary btn-sm" onClick={() => void save()}>
                  {editingId ? (ar() ? "حفظ التعديلات" : "Save changes") : ar() ? "إنشاء" : "Create"}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() =>
                    setPreviewForm({
                      ...draft,
                      id: editingId || "draft",
                      archived: false,
                      version: 0
                    })
                  }
                >
                  {ar() ? "معاينة المسودة" : "Preview draft"}
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => { setShowEditor(false); setEditingId(null); }}>
                  {ar() ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {loading && <div className="text-sm text-surface-500">{ar() ? "جاري التحميل…" : "Loading…"}</div>}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {forms.map((f) => (
              <div key={f.id} className={`card-elevated p-4 ${f.archived ? "opacity-60" : ""}`}>
                <div className="flex justify-between gap-2 mb-1">
                  <div className="font-bold text-surface-900 line-clamp-2">{f.title}</div>
                  <span className="text-[10px] uppercase font-bold text-surface-400">v{f.version}</span>
                </div>
                <div className="text-xs text-surface-500 mb-2">{f.fields.length} {ar() ? "حقل" : "fields"} • {f.targets.length} {ar() ? "ربط" : "links"}</div>
                <div className="flex flex-wrap gap-1 mb-3 text-[10px]">
                  {f.requireBeforeBooking && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">REQ-BOOKING</span>}
                  {f.requireBeforeFirstPayment && <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold">REQ-PAYMENT</span>}
                  {f.archived && <span className="px-2 py-0.5 rounded bg-surface-200 text-surface-600 font-bold">ARCHIVED</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" className="btn-primary btn-sm text-xs" onClick={() => startEdit(f)}>{ar() ? "تعديل" : "Edit"}</button>
                  <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => setPreviewForm(f)}>
                    {ar() ? "معاينة" : "Preview"}
                  </button>
                  {!f.archived && (
                    <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => archive(f)}>{ar() ? "أرشفة" : "Archive"}</button>
                  )}
                </div>
              </div>
            ))}
            {!loading && forms.length === 0 && (
              <div className="md:col-span-3 text-center text-surface-400 py-12 card-elevated">
                {ar() ? "لا توجد نماذج بعد" : "No forms yet"}
              </div>
            )}
          </div>
        </>
      )}

      {view === "submissions" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-surface-500">{ar() ? "تصفية حسب النموذج" : "Filter by form"}:</span>
            <select className="select-field max-w-xs" value={filterFormId} onChange={(e) => setFilterFormId(e.target.value)}>
              <option value="">{ar() ? "كل النماذج" : "All forms"}</option>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
            <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => void refetchSubs()}>↻</button>
          </div>
          <div className="card-elevated overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-xs uppercase text-surface-500">
                <tr>
                  <th className="text-left p-3">{ar() ? "النموذج" : "Form"}</th>
                  <th className="text-left p-3">{ar() ? "العميلة" : "Customer"}</th>
                  <th className="text-left p-3">{ar() ? "التاريخ" : "Submitted"}</th>
                  <th className="text-left p-3">{ar() ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map((s) => (
                  <tr key={s.id} className="border-t border-surface-100">
                    <td className="p-3 font-medium">{s.formTitle} <span className="text-xs text-surface-400">v{s.formVersion}</span></td>
                    <td className="p-3 text-xs text-surface-500 font-mono">{s.userName || s.userId}</td>
                    <td className="p-3 text-xs text-surface-500">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => setSelectedSubmission(s)}>{ar() ? "عرض" : "View"}</button>
                        <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => downloadPdf(s)}>{ar() ? "تنزيل PDF" : "Download PDF"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSubs.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-surface-400">{ar() ? "لا توجد تعبئات" : "No submissions yet"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
