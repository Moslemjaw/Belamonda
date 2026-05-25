import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mongoose from "mongoose";
import { z } from "zod";
import puppeteer from "puppeteer";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { UserModel } from "../../models/user.model.js";
import {
  EFORM_FIELD_TYPES,
  EFormModel,
  EFormSubmissionModel,
  type EFormDoc,
  type EFormSubmissionDoc
} from "../../models/eform.model.js";
import { notifyFormSignatureRequired } from "../notifications/notifications.service.js";

export const EFORMS_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "eforms");
if (!fs.existsSync(EFORMS_UPLOAD_DIR)) fs.mkdirSync(EFORMS_UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, EFORMS_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      cb(null, `${Date.now()}_${Math.random().toString(16).slice(2, 8)}_${safe}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const FieldSchema = z.object({
  key: z.string().min(1).max(64),
  type: z.enum(EFORM_FIELD_TYPES),
  labelEn: z.string().min(1),
  labelAr: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional().default([]),
  order: z.number().int().optional().default(0)
});

const TargetSchema = z.object({
  kind: z.enum(["offer", "installment_plan", "session_type"]),
  refId: z.string().min(1)
});

const FormCreateSchema = z.object({
  title: z.string().min(1),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  fields: z.array(FieldSchema).min(1),
  targets: z.array(TargetSchema).optional().default([]),
  requireBeforeBooking: z.boolean().optional().default(false),
  requireBeforeFirstPayment: z.boolean().optional().default(false)
});

const FormUpdateSchema = FormCreateSchema.partial().extend({
  archived: z.boolean().optional()
});

function serializeForm(doc: EFormDoc | (Record<string, unknown> & { _id: mongoose.Types.ObjectId })) {
  const d = doc as any;
  return {
    id: String(d._id),
    title: d.title,
    titleAr: d.titleAr,
    description: d.description,
    descriptionAr: d.descriptionAr,
    fields: (d.fields ?? []).map((f: any) => ({
      key: f.key,
      type: f.type,
      labelEn: f.labelEn,
      labelAr: f.labelAr,
      helpText: f.helpText,
      required: !!f.required,
      options: f.options ?? [],
      order: f.order ?? 0
    })),
    targets: (d.targets ?? []).map((t: any) => ({ kind: t.kind, refId: t.refId })),
    requireBeforeBooking: !!d.requireBeforeBooking,
    requireBeforeFirstPayment: !!d.requireBeforeFirstPayment,
    archived: !!d.archived,
    version: d.version ?? 1,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : undefined
  };
}

function serializeSubmission(doc: EFormSubmissionDoc | (Record<string, unknown> & { _id: mongoose.Types.ObjectId })) {
  const d = doc as any;
  return {
    id: String(d._id),
    formId: String(d.formId),
    formVersion: d.formVersion,
    formTitle: d.formTitle,
    formSnapshot: (d.formSnapshot ?? []).map((f: any) => ({
      key: f.key,
      type: f.type,
      labelEn: f.labelEn,
      labelAr: f.labelAr,
      required: !!f.required,
      options: f.options ?? [],
      order: f.order ?? 0
    })),
    userId: d.userId,
    userOfferId: d.userOfferId,
    targetKind: d.targetKind,
    targetRefId: d.targetRefId,
    answers: (d.answers ?? []).map((a: any) => ({ key: a.key, value: a.value })),
    signatureRef: d.signatureRef,
    uploadedFileRefs: d.uploadedFileRefs ?? [],
    ip: d.ip,
    userAgent: d.userAgent,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined
  };
}

function saveSignatureDataUrl(dataUrl: string): string | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 2 * 1024 * 1024) return null; // 2MB max signature
  // Store the base64 string directly in the database to persist it across ephemeral server restarts
  return dataUrl;
}

/**
 * Notify all customers who have an active (or pending) user-offer for any of the given offerIds.
 * Skips users who have already submitted this form at the current version.
 */
async function notifyAffectedCustomers(formId: string, formTitle: string, offerIds: string[], formVersion: number) {
  if (!offerIds.length) return;
  const mongoOfferIds = offerIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!mongoOfferIds.length) return;

  const userOffers = await UserOfferModel.find({
    offerId: { $in: mongoOfferIds },
    status: { $in: ["active", "pending_payment", "reserved"] }
  })
    .select("userId")
    .lean<{ userId: string }[]>();

  const userIds = Array.from(new Set(userOffers.map((u) => u.userId)));
  if (!userIds.length) return;

  const alreadySigned = await EFormSubmissionModel.find({
    formId: new mongoose.Types.ObjectId(formId),
    formVersion,
    userId: { $in: userIds }
  })
    .select("userId")
    .lean<{ userId: string }[]>();

  const signedSet = new Set(alreadySigned.map((s) => s.userId));

  for (const userId of userIds) {
    if (!signedSet.has(userId)) {
      notifyFormSignatureRequired(userId, formId, formTitle);
    }
  }
}

/** List forms whose targets include any of the given targets. */
async function listFormsForTargets(targets: Array<{ kind: string; refId: string }>) {
  if (targets.length === 0) return [];
  const orCondition = targets.map(t => ({
    targets: { $elemMatch: { kind: t.kind, refId: t.refId } }
  }));
  const docs = await EFormModel.find({
    archived: false,
    $or: orCondition
  })
    .sort({ createdAt: -1 })
    .lean<EFormDoc[]>();
  return docs;
}

/** Find unsigned forms for a given user + targets. Returns serialized form list. */
export async function listRequiredFormsForUser(
  userId: string,
  targets: Array<{ kind: string; refId: string }>,
  gate: "booking" | "first_payment" | "any" = "any"
) {
  const forms = await listFormsForTargets(targets);
  const filtered = forms.filter((f) => {
    if (gate === "booking") return f.requireBeforeBooking;
    if (gate === "first_payment") return f.requireBeforeFirstPayment;
    return f.requireBeforeBooking || f.requireBeforeFirstPayment;
  });
  if (!filtered.length) return [] as any[];
  const ids = filtered.map((f) => f._id);
  const submissions = await EFormSubmissionModel.find({ formId: { $in: ids }, userId })
    .select("formId")
    .lean<{ formId: mongoose.Types.ObjectId }[]>();
  const signed = new Set(submissions.map((s) => String(s.formId)));
  return filtered.filter((f) => !signed.has(String(f._id))).map((f) => serializeForm(f as EFormDoc));
}

export const eformsRouter = Router();

// ── Admin: list / create / update / archive forms ──
eformsRouter.get("/admin/forms", authRequired, requireRole(["admin", "legal"]), async (_req, res, next) => {
  try {
    const rows = await EFormModel.find({}).sort({ createdAt: -1 }).lean<EFormDoc[]>();
    return res.json({ items: rows.map((r) => serializeForm(r)) });
  } catch (e) {
    next(e);
  }
});

eformsRouter.post("/admin/forms", authRequired, requireRole(["admin", "legal"]), async (req, res, next) => {
  try {
    const parsed = FormCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const doc = await EFormModel.create({
      ...parsed.data,
      createdBy: req.auth!.userId,
      version: 1
    });
    const serialized = serializeForm(doc.toObject() as EFormDoc);

    const offerTargetIds = (parsed.data.targets ?? [])
      .filter((t) => t.kind === "offer")
      .map((t) => t.refId);
    notifyAffectedCustomers(serialized.id, serialized.title, offerTargetIds, 1).catch((err) =>
      console.error("[eforms] notifyAffectedCustomers (create):", err)
    );

    return res.status(201).json({ form: serialized });
  } catch (e) {
    next(e);
  }
});

eformsRouter.patch("/admin/forms/:id", authRequired, requireRole(["admin", "legal"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    const parsed = FormUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const prevDoc = await EFormModel.findById(req.params.id).lean<EFormDoc | null>();
    if (!prevDoc) return res.status(404).json({ error: "NOT_FOUND" });

    const update: any = { $set: { ...parsed.data } };
    const fieldsChanged = !!parsed.data.fields;
    if (fieldsChanged) update.$inc = { version: 1 };
    const doc = await EFormModel.findByIdAndUpdate(req.params.id, update, { new: true }).lean<EFormDoc | null>();
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });

    const serialized = serializeForm(doc);

    const prevOfferIds = new Set(
      (prevDoc.targets ?? []).filter((t: any) => t.kind === "offer").map((t: any) => String(t.refId))
    );
    const currentOfferIds = (doc.targets ?? [])
      .filter((t: any) => t.kind === "offer")
      .map((t: any) => String(t.refId));

    const newlyLinkedOfferIds = currentOfferIds.filter((id) => !prevOfferIds.has(id));

    if (fieldsChanged) {
      notifyAffectedCustomers(serialized.id, serialized.title, currentOfferIds, serialized.version).catch((err) =>
        console.error("[eforms] notifyAffectedCustomers (fields changed):", err)
      );
    } else if (newlyLinkedOfferIds.length > 0) {
      notifyAffectedCustomers(serialized.id, serialized.title, newlyLinkedOfferIds, serialized.version).catch((err) =>
        console.error("[eforms] notifyAffectedCustomers (new targets):", err)
      );
    }

    return res.json({ form: serialized });
  } catch (e) {
    next(e);
  }
});

eformsRouter.delete("/admin/forms/:id", authRequired, requireRole(["admin", "legal"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    await EFormModel.findByIdAndUpdate(req.params.id, { $set: { archived: true } }).lean();
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin: list submissions ──
eformsRouter.get("/admin/submissions", authRequired, requireRole(["admin", "legal"]), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.formId === "string" && mongoose.isValidObjectId(req.query.formId)) {
      filter.formId = new mongoose.Types.ObjectId(req.query.formId);
    }
    if (typeof req.query.userId === "string") filter.userId = req.query.userId;
    const rows = await EFormSubmissionModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean<EFormSubmissionDoc[]>();

    const userIds = [...new Set(rows.map(r => r.userId).filter(Boolean))];
    const users = await UserModel.find({ _id: { $in: userIds } }).select("username fullName phone email").lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const items = rows.map((r) => {
      const s = serializeSubmission(r);
      const u = userMap.get(s.userId);
      return {
        ...s,
        userName: u ? (u.fullName || u.username) : "—",
        userPhone: u ? u.phone : "—",
        userEmail: u ? u.email : "—",
      };
    });

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ── Public read (auth required): fetch a form to fill ──
eformsRouter.get("/forms/:id", authRequired, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    const doc = await EFormModel.findById(req.params.id).lean<EFormDoc | null>();
    if (!doc || doc.archived) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ form: serializeForm(doc) });
  } catch (e) {
    next(e);
  }
});

// ── Customer: required forms for an offer ──
eformsRouter.get("/required-for-offer/:offerId", authRequired, async (req, res, next) => {
  try {
    const gate = (typeof req.query.gate === "string" ? req.query.gate : "any") as "booking" | "first_payment" | "any";
    const targets = [{ kind: "offer", refId: req.params.offerId }];
    const items = await listRequiredFormsForUser(req.auth!.userId, targets, gate);
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ── Customer: list available forms (linked to any of my user-offers, not yet submitted at current version) ──
eformsRouter.get("/me/available", authRequired, async (req, res, next) => {
  try {
    const userOffers = await UserOfferModel.find({ userId: req.auth!.userId }).lean();
    const offerIds = Array.from(new Set(userOffers.map((u: any) => u.offerId)));
    if (offerIds.length === 0) return res.json({ items: [] });

    const forms = await EFormModel.find({
      archived: { $ne: true },
      "targets.kind": "offer",
      "targets.refId": { $in: offerIds }
    }).lean<EFormDoc[]>();

    const submitted = await EFormSubmissionModel.find({
      userId: req.auth!.userId,
      formId: { $in: forms.map((f) => String(f._id)) }
    }).select({ formId: 1, formVersion: 1 }).lean();

    const subKey = new Set(submitted.map((s) => `${s.formId}:${s.formVersion}`));
    const items = forms
      .filter((f) => !subKey.has(`${String(f._id)}:${f.version}`))
      .map((f) => serializeForm(f));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ── Customer: list my submissions ──
eformsRouter.get("/me/submissions", authRequired, async (req, res, next) => {
  try {
    const rows = await EFormSubmissionModel.find({ userId: req.auth!.userId })
      .sort({ createdAt: -1 })
      .lean<EFormSubmissionDoc[]>();
    return res.json({ items: rows.map((r) => serializeSubmission(r)) });
  } catch (e) {
    next(e);
  }
});

// ── Customer: file upload ──
eformsRouter.post("/uploads", authRequired, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });
  return res.status(201).json({
    ref: `eforms/${req.file.filename}`,
    name: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype
  });
});

// ── Customer: submit a form ──
const SubmissionSchema = z.object({
  formId: z.string().min(1),
  userOfferId: z.string().optional(),
  targetKind: z.enum(["offer", "installment_plan", "session_type", "ad_hoc"]).optional(),
  targetRefId: z.string().optional(),
  answers: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional()
      })
    )
    .default([]),
  signatureDataUrl: z.string().optional(),
  uploadedFileRefs: z.array(z.string()).optional().default([])
});

eformsRouter.post("/submit", authRequired, async (req, res, next) => {
  try {
    const parsed = SubmissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    if (!mongoose.isValidObjectId(parsed.data.formId)) return res.status(404).json({ error: "FORM_NOT_FOUND" });
    const form = await EFormModel.findById(parsed.data.formId).lean<EFormDoc | null>();
    if (!form || form.archived) return res.status(404).json({ error: "FORM_NOT_FOUND" });

    // Validate required fields
    const answersByKey = new Map(parsed.data.answers.map((a) => [a.key, a.value]));
    const fields = (form.fields ?? []) as Array<any>;
    for (const f of fields) {
      if (!f.required) continue;
      if (f.type === "signature") continue; // handled separately
      if (f.type === "file_upload") continue; // handled separately
      if (f.type === "static_text") continue; // static text is display only
      const v = answersByKey.get(f.key);
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) return res.status(400).json({ error: "MISSING_REQUIRED_FIELD", field: f.key });
    }

    // Signature handling
    let signatureRef: string | undefined;
    const needsSig = fields.some((f) => f.type === "signature" && f.required);
    if (parsed.data.signatureDataUrl) {
      const ref = saveSignatureDataUrl(parsed.data.signatureDataUrl);
      if (!ref) return res.status(400).json({ error: "INVALID_SIGNATURE" });
      signatureRef = ref;
    } else if (needsSig) {
      return res.status(400).json({ error: "MISSING_SIGNATURE" });
    }

    // File upload required check
    const reqFiles = fields.filter((f) => f.type === "file_upload" && f.required);
    if (reqFiles.length && (parsed.data.uploadedFileRefs?.length ?? 0) === 0) {
      return res.status(400).json({ error: "MISSING_FILE_UPLOAD" });
    }

    const snapshot = fields.map((f) => ({
      key: f.key,
      type: f.type,
      labelEn: f.labelEn,
      labelAr: f.labelAr,
      required: !!f.required,
      options: f.options ?? [],
      order: f.order ?? 0
    }));

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "";
    const userAgent = req.headers["user-agent"]?.toString() || "";

    const doc = await EFormSubmissionModel.create({
      formId: form._id,
      formVersion: form.version ?? 1,
      formTitle: form.title,
      formSnapshot: snapshot,
      userId: req.auth!.userId,
      userOfferId: parsed.data.userOfferId,
      targetKind: parsed.data.targetKind ?? "ad_hoc",
      targetRefId: parsed.data.targetRefId,
      answers: parsed.data.answers,
      signatureRef,
      uploadedFileRefs: parsed.data.uploadedFileRefs ?? [],
      ip,
      userAgent
    });

    return res.status(201).json({ submission: serializeSubmission(doc.toObject() as EFormSubmissionDoc) });
  } catch (e) {
    next(e);
  }
});

// ── PDF export of a submission ──
eformsRouter.get("/submissions/:id/pdf", authRequired, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    const sub = await EFormSubmissionModel.findById(req.params.id).lean<EFormSubmissionDoc | null>();
    if (!sub) return res.status(404).json({ error: "NOT_FOUND" });

    const isOwner = sub.userId === req.auth!.userId;
    const isStaff = req.auth!.role === "admin" || req.auth!.role === "legal";
    if (!isOwner && !isStaff) return res.status(403).json({ error: "FORBIDDEN" });

    const lang = req.query.lang === "en" ? "en" : req.query.lang === "ar" ? "ar" : "both";
    const isRtl = lang === "ar" || lang === "both";

    const answersByKey = new Map((sub.answers ?? []).map((a: any) => [a.key, a.value]));
    const fields = ((sub.formSnapshot ?? []) as any[]).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let fieldsHtml = "";
    for (const f of fields) {
      if (f.type === "static_text") {
        const textEn = f.labelEn || "";
        const textAr = f.labelAr || "";
        let content = textEn;
        if (lang === "ar") content = textAr || textEn;
        else if (lang === "en") content = textEn || textAr;
        else content = textAr ? `${textAr}\n\n${textEn}` : textEn;
        
        const safeContent = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        fieldsHtml += `<div class="static-text">${safeContent.replace(/\n/g, "<br>")}</div>`;
        continue;
      }
      
      const value = answersByKey.get(f.key);
      let display = "—";
      if (Array.isArray(value)) display = value.join(", ");
      else if (value !== undefined && value !== null && value !== "") display = String(value);
      if (f.type === "signature" || f.type === "file_upload") display = lang === "ar" ? "(مرفق)" : "(see attached)";
      
      let label = f.labelEn;
      if (lang === "ar" && f.labelAr) label = f.labelAr;
      else if (lang === "both" && f.labelAr) label = `${f.labelAr} / ${f.labelEn}`;
      
      const safeLabel = label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeDisplay = display.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      fieldsHtml += `
        <div class="field-row">
          <div class="field-label">${safeLabel}${f.required ? " *" : ""}</div>
          <div class="field-value">${safeDisplay}</div>
        </div>
      `;
    }

    let signatureHtml = "";
    const sigTitle = lang === "en" ? "Customer Signature" : lang === "ar" ? "توقيع المشترك" : "Customer Signature / توقيع المشترك";
    const sigMissing = lang === "en" ? "Signature stored electronically." : lang === "ar" ? "تم حفظ التوقيع إلكترونياً" : "Signature stored electronically.<br/><span style=\"font-size: 11px;\">تم حفظ التوقيع إلكترونياً</span>";

    if (sub.signatureRef) {
      if (sub.signatureRef.startsWith("data:image/")) {
        signatureHtml = `
          <div class="signature-box">
            <div class="signature-title">${sigTitle}</div>
            <img class="signature-img" src="${sub.signatureRef}" alt="Signature" />
            <div class="signature-meta">
              Date: ${sub.createdAt ? new Date(sub.createdAt).toUTCString() : "—"}<br>
              IP: ${sub.ip ?? "—"} | User Agent: ${sub.userAgent ?? "—"}
            </div>
          </div>
        `;
      } else {
        const sigPath = path.resolve(process.cwd(), "uploads", sub.signatureRef.replace(/^\/?uploads\//, ""));
        if (fs.existsSync(sigPath)) {
          try {
            const base64 = fs.readFileSync(sigPath).toString("base64");
            const ext = sigPath.endsWith(".jpg") || sigPath.endsWith(".jpeg") ? "jpeg" : "png";
            signatureHtml = `
              <div class="signature-box">
                <div class="signature-title">${sigTitle}</div>
                <img class="signature-img" src="data:image/${ext};base64,${base64}" alt="Signature" />
                <div class="signature-meta">
                  Date: ${sub.createdAt ? new Date(sub.createdAt).toUTCString() : "—"}<br>
                  IP: ${sub.ip ?? "—"} | User Agent: ${sub.userAgent ?? "—"}
                </div>
              </div>
            `;
          } catch (e) {
            signatureHtml = `<div class="signature-box">Signature image could not be embedded</div>`;
          }
        } else {
          signatureHtml = `<div class="signature-box">
            <div class="signature-title">${sigTitle}</div>
            <div style="padding: 20px 0; color: #64748b; font-weight: 500;">
              <svg style="width: 32px; height: 32px; margin: 0 auto 10px; color: #94a3b8;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <br/>
              ${sigMissing}
            </div>
            <div class="signature-meta">
              Date: ${sub.createdAt ? new Date(sub.createdAt).toUTCString() : "—"}<br>
              IP: ${sub.ip ?? "—"} | User Agent: ${sub.userAgent ?? "—"}
            </div>
          </div>`;
        }
      }
    }

    let attachmentsHtml = "";
    if ((sub.uploadedFileRefs ?? []).length) {
      const attachTitle = lang === "en" ? "Attached Files" : lang === "ar" ? "الملفات المرفقة" : "Attached Files / الملفات المرفقة";
      attachmentsHtml += `
        <div class="section" style="margin-top: 30px;">
          <div class="section-title">${attachTitle}</div>
      `;
      for (const r of sub.uploadedFileRefs ?? []) {
        const basename = path.basename(r);
        const underscoreIdx = basename.indexOf("_", basename.indexOf("_") + 1);
        const displayName = underscoreIdx !== -1 ? basename.slice(underscoreIdx + 1) : basename;
        attachmentsHtml += `<div class="field-row" style="font-size: 12px; color: #475569;">• ${displayName}</div>`;
      }
      attachmentsHtml += `</div>`;
    }

    const formTitle = sub.formTitle || "Form Submission";
    const metaCustomer = lang === "ar" ? "رقم العميل" : "Customer ID";
    const metaSubmission = lang === "ar" ? "رقم النموذج" : "Submission ID";
    const metaDate = lang === "ar" ? "التاريخ" : "Date";
    const metaVersion = lang === "ar" ? "الإصدار" : "Version";

    const html = `
    <!DOCTYPE html>
    <html lang="${isRtl ? "ar" : "en"}" dir="${isRtl ? "rtl" : "ltr"}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: ${isRtl ? "'Tajawal'" : "'Inter'"}, sans-serif;
          color: #1e293b; line-height: 1.7; margin: 0; padding: 0; background: #fff;
        }
        .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }

        /* ── Header ── */
        .header {
          text-align: center; margin-bottom: 36px; padding-bottom: 28px;
          border-bottom: 3px solid #db2777;
          background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%);
          margin: -48px -40px 36px -40px; padding: 40px 40px 28px 40px;
          border-radius: 0 0 24px 24px;
        }
        .logo {
          color: #db2777; font-size: 36px; font-weight: 800;
          letter-spacing: -1.5px; margin-bottom: 4px;
          text-shadow: 0 1px 2px rgba(219,39,119,0.1);
        }
        .logo-sub { font-size: 11px; color: #9ca3af; letter-spacing: 3px; text-transform: uppercase; font-weight: 600; margin-bottom: 16px; }
        .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 8px; }

        /* ── Meta Box ── */
        .meta-box {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
          padding: 18px 24px; margin-bottom: 32px;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          font-size: 12px; color: #475569; direction: ltr; text-align: left;
        }
        .meta-item { display: flex; flex-direction: column; gap: 2px; }
        .meta-label { font-weight: 700; color: #0f172a; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta-value { font-weight: 500; color: #334155; font-size: 12px; word-break: break-all; }

        /* ── Content ── */
        .section { margin-bottom: 30px; }
        .section-title { font-size: 15px; font-weight: 700; color: #db2777; border-bottom: 2px solid #fce7f3; padding-bottom: 6px; margin-bottom: 16px; }

        .field-row {
          display: flex; border-bottom: 1px solid #f1f5f9; padding: 12px 0;
          page-break-inside: avoid; align-items: flex-start;
        }
        .field-row:last-child { border-bottom: none; }
        .field-label { flex: 0 0 38%; font-weight: 600; color: #475569; font-size: 13px; ${isRtl ? "padding-left: 16px;" : "padding-right: 16px;"} }
        .field-value { flex: 1; font-size: 14px; font-weight: 500; color: #0f172a; }

        .static-text {
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
          padding: 24px; border-radius: 12px; font-size: 14px; color: #334155;
          margin: 24px 0; white-space: pre-line; line-height: 1.9;
          page-break-inside: auto;
          ${isRtl ? "border-right: 4px solid #db2777;" : "border-left: 4px solid #db2777;"}
          text-align: start; unicode-bidi: plaintext;
        }

        /* ── Signature ── */
        .signature-box {
          border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px;
          text-align: center; margin-top: 40px; page-break-inside: avoid;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        }
        .signature-title { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
        .signature-img {
          max-height: 140px; max-width: 340px; display: block; margin: 0 auto;
          mix-blend-mode: multiply; border-radius: 8px;
          padding: 12px; background: #fff; border: 1px solid #e2e8f0;
        }
        .signature-meta { font-size: 11px; color: #94a3b8; margin-top: 16px; direction: ltr; line-height: 1.5; }

        /* ── Footer ── */
        .footer {
          text-align: center; font-size: 10px; color: #94a3b8;
          margin-top: 48px; padding-top: 20px;
          border-top: 2px solid #f1f5f9; direction: ltr;
        }

        @media print {
          body { padding: 0; }
          .page { padding: 24px; }
          .header { margin: -24px -24px 24px -24px; padding: 24px 24px 20px 24px; border-radius: 0; }
          .no-print { display: none !important; }
        }
        @media screen and (max-width: 600px) {
          .page { padding: 20px 16px; }
          .header { margin: -20px -16px 24px -16px; padding: 24px 16px 20px 16px; }
          .meta-box { grid-template-columns: repeat(2, 1fr); }
          .field-row { flex-direction: column; gap: 4px; }
          .field-label { flex: none; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="logo">Belamonda</div>
          <div class="logo-sub">Beauty & Wellness</div>
          <div class="title">${formTitle}</div>
        </div>

        <div class="meta-box">
          <div class="meta-item">
            <span class="meta-label">${metaCustomer}</span>
            <span class="meta-value">${sub.userId}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${metaSubmission}</span>
            <span class="meta-value">${String(sub._id)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${metaDate}</span>
            <span class="meta-value">${sub.createdAt ? new Date(sub.createdAt).toLocaleString("en-GB") : "—"}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${metaVersion}</span>
            <span class="meta-value">v${sub.formVersion}</span>
          </div>
        </div>

        <div class="content">
          ${fieldsHtml}
        </div>

        ${signatureHtml}
        ${attachmentsHtml}

        <div class="footer">
          Generated by Belamonda System • ${new Date().toISOString()}<br>
          IP: ${sub.ip ?? "—"} • UA: ${sub.userAgent ?? "—"}
        </div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(() => { window.print(); }, 500);
        };
      </script>
    </body>
    </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (e) {
    console.error("PDF generation error:", e);
    next(e);
  }
});
