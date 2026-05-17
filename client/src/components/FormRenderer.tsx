import { useEffect, useRef, useState } from "react";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

export type FieldType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multi_choice"
  | "date"
  | "signature"
  | "file_upload"
  | "static_text";

export type FormField = {
  key: string;
  type: FieldType;
  labelEn: string;
  labelAr?: string;
  helpText?: string;
  required: boolean;
  options: string[];
  order: number;
};

export type FormDefinition = {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  fields: FormField[];
};

export type FormRendererValues = {
  answers: Record<string, any>;
  signature: string | null;
  files: string[];
};

function SignaturePad({
  onChange,
  readOnly,
  initialDataUrl,
}: {
  onChange: (dataUrl: string | null) => void;
  readOnly?: boolean;
  initialDataUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#0f172a";
      ctx.fillStyle = readOnly ? "#f8fafc" : "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      if (initialDataUrl) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = initialDataUrl;
        setHasDrawn(true);
      }
    }
  }, [readOnly, initialDataUrl]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    drawingRef.current = true;
    lastRef.current = pos(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || readOnly) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = pos(e);
    if (ctx && lastRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastRef.current.x, lastRef.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastRef.current = p;
    if (!hasDrawn) setHasDrawn(true);
  };
  const end = () => {
    if (readOnly) return;
    drawingRef.current = false;
    lastRef.current = null;
    const url = canvasRef.current?.toDataURL("image/png") ?? null;
    onChange(url);
  };
  const clear = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div>
      <div className={`border-2 border-dashed rounded-xl ${readOnly ? "border-surface-200 bg-surface-50" : "border-surface-300 bg-white"}`}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: 160,
            touchAction: readOnly ? "auto" : "none",
            display: "block",
            cursor: readOnly ? "default" : "crosshair",
          }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-surface-400">
          {readOnly
            ? ar() ? "حقل التوقيع (معاينة فقط)" : "Signature field (preview only)"
            : hasDrawn
            ? ar() ? "تم التوقيع" : "Signed"
            : ar() ? "وقّعي هنا" : "Sign here"}
        </span>
        {!readOnly && (
          <button type="button" className="text-xs font-bold text-surface-500" onClick={clear}>
            {ar() ? "مسح" : "Clear"}
          </button>
        )}
      </div>
    </div>
  );
}

type Props = {
  form: FormDefinition;
  readOnly?: boolean;
  values?: Record<string, any>;
  signature?: string | null;
  files?: string[];
  onValueChange?: (key: string, value: any) => void;
  onSignatureChange?: (dataUrl: string | null) => void;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function FormRenderer({
  form,
  readOnly = false,
  values = {},
  signature = null,
  files = [],
  onValueChange,
  onSignatureChange,
  onFileUpload,
}: Props) {
  const setVal = (key: string, v: any) => {
    if (!readOnly) onValueChange?.(key, v);
  };

  return (
    <div className="space-y-5">
      {form.description && !ar() && <p className="text-sm text-surface-500">{form.description}</p>}
      {form.descriptionAr && ar() && <p className="text-sm text-surface-500">{form.descriptionAr}</p>}
      {!form.descriptionAr && form.description && ar() && <p className="text-sm text-surface-500">{form.description}</p>}
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {ar() ? "وضع المعاينة — لن يتم حفظ أي بيانات" : "Preview mode — no data will be saved"}
        </div>
      )}
      {form.fields
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((f, idx) => {
          const fieldNumber = idx + 1;
          const fallback = ar() ? `الحقل ${fieldNumber}` : `Field ${fieldNumber}`;
          const labelEn = f.labelEn?.trim();
          const labelAr = f.labelAr?.trim();
          const label = (ar() && labelAr ? labelAr : labelEn) || fallback;
          return (
            <div key={f.key} className="card-elevated p-4">
              {f.type === "static_text" ? (
                <div className="text-sm text-surface-800 whitespace-pre-wrap leading-relaxed">
                  {label}
                </div>
              ) : (
                <>
                  <label className="block text-sm font-bold text-surface-900 mb-2">
                    {label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {f.helpText && <p className="text-xs text-surface-500 mb-2">{f.helpText}</p>}
                </>
              )}

              {f.type === "short_text" && (
                <input
                  className="input-field"
                  value={values[f.key] ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setVal(f.key, e.target.value)}
                />
              )}

              {f.type === "long_text" && (
                <textarea
                  className="input-field"
                  rows={4}
                  value={values[f.key] ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setVal(f.key, e.target.value)}
                />
              )}

              {f.type === "date" && (
                <input
                  type="date"
                  className="input-field"
                  value={values[f.key] ?? ""}
                  readOnly={readOnly}
                  disabled={readOnly}
                  onChange={(e) => setVal(f.key, e.target.value)}
                />
              )}

              {f.type === "single_choice" && (
                <div className="space-y-2">
                  {f.options.map((opt) => (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${readOnly ? "cursor-default opacity-70" : "cursor-pointer"} ${
                        values[f.key] === opt
                          ? "border-brand-pink-500 bg-brand-pink-50/50"
                          : "border-surface-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name={readOnly ? `preview_${f.key}` : f.key}
                        checked={values[f.key] === opt}
                        disabled={readOnly}
                        onChange={() => setVal(f.key, opt)}
                      />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {f.type === "multi_choice" && (
                <div className="space-y-2">
                  {f.options.map((opt) => {
                    const arr: string[] = Array.isArray(values[f.key]) ? values[f.key] : [];
                    const checked = arr.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${readOnly ? "cursor-default opacity-70" : "cursor-pointer"} ${
                          checked
                            ? "border-brand-pink-500 bg-brand-pink-50/50"
                            : "border-surface-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={readOnly}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...arr, opt]
                              : arr.filter((x) => x !== opt);
                            setVal(f.key, next);
                          }}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {f.type === "signature" && (
                <SignaturePad
                  onChange={onSignatureChange ?? (() => {})}
                  initialDataUrl={signature}
                  readOnly={readOnly}
                />
              )}

              {f.type === "file_upload" && (
                <div>
                  {readOnly ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-surface-300 bg-surface-50 text-xs text-surface-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {ar() ? "رفع ملف (معاينة فقط)" : "File upload (preview only)"}
                    </div>
                  ) : (
                    <div>
                      <input type="file" onChange={onFileUpload} className="text-sm" />
                      {files.length > 0 && (
                        <ul className="mt-2 text-xs text-surface-500 space-y-1">
                          {files.map((ref) => (
                            <li key={ref}>• {ref}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
