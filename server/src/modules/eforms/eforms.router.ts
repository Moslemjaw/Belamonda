import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mongoose from "mongoose";
import { z } from "zod";
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

function doesFormMatchContext(formTargets: Array<{ kind: string; refId: string }>, contextTargets: Array<{ kind: string; refId: string }>) {
  if (!formTargets || formTargets.length === 0) return false;

  const formKinds = new Set(formTargets.map(t => t.kind));
  
  for (const kind of formKinds) {
    const allowedRefIdsForKind = new Set(formTargets.filter(t => t.kind === kind).map(t => String(t.refId)));
    const contextRefIdForKind = contextTargets.find(t => t.kind === kind)?.refId;
    if (!contextRefIdForKind || !allowedRefIdsForKind.has(String(contextRefIdForKind))) {
      return false;
    }
  }
  return true;
}

/**
 * Notify all customers whose UserOffers match the form's target context.
 * Skips users who have already submitted this form at the current version.
 */
async function notifyAffectedCustomers(formId: string, formTitle: string, formTargets: Array<{ kind: string; refId: string }>, formVersion: number) {
  const offerIds = formTargets.filter(t => t.kind === "offer").map(t => t.refId);
  if (!offerIds.length) return;
  const mongoOfferIds = offerIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!mongoOfferIds.length) return;

  const userOffers = await UserOfferModel.find({
    offerId: { $in: mongoOfferIds },
    status: { $in: ["active", "pending_payment", "reserved"] }
  })
    .select("userId offerId purchaseMode installmentCount")
    .lean<{ userId: string; offerId: mongoose.Types.ObjectId; purchaseMode: string; installmentCount?: number }[]>();

  const matchedUserIds = new Set<string>();
  for (const u of userOffers) {
    const ctx = [{ kind: "offer", refId: String(u.offerId) }];
    if (u.purchaseMode === "full") ctx.push({ kind: "installment_plan", refId: "full" });
    else if (u.purchaseMode === "deposit") ctx.push({ kind: "installment_plan", refId: "deposit" });
    else if (u.purchaseMode === "enet") ctx.push({ kind: "installment_plan", refId: "4_enet" });
    else if (u.purchaseMode === "installments" && u.installmentCount) ctx.push({ kind: "installment_plan", refId: String(u.installmentCount) });
    
    if (doesFormMatchContext(formTargets, ctx)) {
      matchedUserIds.add(u.userId);
    }
  }

  const userIds = Array.from(matchedUserIds);
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
  const allForms = await EFormModel.find({ archived: false }).sort({ createdAt: -1 }).lean<EFormDoc[]>();
  return allForms.filter(f => doesFormMatchContext(f.targets || [], targets));
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
eformsRouter.get("/admin/forms", authRequired, requireRole(["admin", "legal", "cs_director"]), async (_req, res, next) => {
  try {
    const rows = await EFormModel.find({}).sort({ createdAt: -1 }).lean<EFormDoc[]>();
    return res.json({ items: rows.map((r) => serializeForm(r)) });
  } catch (e) {
    next(e);
  }
});

eformsRouter.post("/admin/forms", authRequired, requireRole(["admin", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = FormCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const doc = await EFormModel.create({
      ...parsed.data,
      createdBy: req.auth!.userId,
      version: 1
    });
    const serialized = serializeForm(doc.toObject() as EFormDoc);

    notifyAffectedCustomers(serialized.id, serialized.title, parsed.data.targets ?? [], 1).catch((err) =>
      console.error("[eforms] notifyAffectedCustomers (create):", err)
    );

    return res.status(201).json({ form: serialized });
  } catch (e) {
    next(e);
  }
});

eformsRouter.patch("/admin/forms/:id", authRequired, requireRole(["admin", "legal", "cs_director"]), async (req, res, next) => {
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
      notifyAffectedCustomers(serialized.id, serialized.title, doc.targets ?? [], serialized.version).catch((err) =>
        console.error("[eforms] notifyAffectedCustomers (fields changed):", err)
      );
    } else if (newlyLinkedOfferIds.length > 0) {
      notifyAffectedCustomers(serialized.id, serialized.title, doc.targets ?? [], serialized.version).catch((err) =>
        console.error("[eforms] notifyAffectedCustomers (new targets):", err)
      );
    }

    return res.json({ form: serialized });
  } catch (e) {
    next(e);
  }
});

eformsRouter.delete("/admin/forms/:id", authRequired, requireRole(["admin", "legal", "cs_director"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    await EFormModel.findByIdAndUpdate(req.params.id, { $set: { archived: true } }).lean();
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin: list submissions ──
eformsRouter.get("/admin/submissions", authRequired, requireRole(["admin", "legal", "cs_director"]), async (req, res, next) => {
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
    if (userOffers.length === 0) return res.json({ items: [] });

    const contexts = userOffers.map((u: any) => {
      const ctx = [{ kind: "offer", refId: String(u.offerId) }];
      if (u.purchaseMode === "full") ctx.push({ kind: "installment_plan", refId: "full" });
      else if (u.purchaseMode === "deposit") ctx.push({ kind: "installment_plan", refId: "deposit" });
      else if (u.purchaseMode === "enet") ctx.push({ kind: "installment_plan", refId: "4_enet" });
      else if (u.purchaseMode === "installments" && u.installmentCount) ctx.push({ kind: "installment_plan", refId: String(u.installmentCount) });
      return ctx;
    });

    const allForms = await EFormModel.find({ archived: { $ne: true } }).lean<EFormDoc[]>();
    const forms = allForms.filter(f => contexts.some(ctx => doesFormMatchContext(f.targets || [], ctx)));

    const submitted = await EFormSubmissionModel.find({
      userId: req.auth!.userId,
      formId: { $in: forms.map((f) => String(f._id)) }
    }).select({ formId: 1, formVersion: 1 }).lean();

    const subKey = new Set(submitted.map((s) => `${s.formId}:${s.formVersion}`));
    const items = forms
      .filter((f) => !subKey.has(`${String(f._id)}:${f.version}`))
      .map((f) => serializeForm(f as EFormDoc));
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
    const isStaff = req.auth!.role === "admin" || req.auth!.role === "legal" || req.auth!.role === "cs_director";
    if (!isOwner && !isStaff) return res.status(403).json({ error: "FORBIDDEN" });

    const lang = req.query.lang === "en" ? "en" : req.query.lang === "ar" ? "ar" : "both";
    const isRtl = lang === "ar" || lang === "both";

    const answersByKey = new Map((sub.answers ?? []).map((a: any) => [a.key, a.value]));
    const fields = ((sub.formSnapshot ?? []) as any[]).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let fieldsHtml = "";
    for (const f of fields) {
      if (f.type === "signature") continue;

      if (f.type === "static_text") {
        const textEn = f.labelEn || "";
        const textAr = f.labelAr || "";
        let content = textEn;
        if (lang === "ar") content = textAr || textEn;
        else if (lang === "en") content = textEn || textAr;
        else content = textAr ? `${textAr}\n\n${textEn}` : textEn;
        
        const safeContent = String(content || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        fieldsHtml += `<div class="item-wrapper"><div class="static-text">${safeContent.replace(/\n/g, "<br>")}</div></div>`;
      } else {
        const value = answersByKey.get(f.key);
        let display = "—";
        if (Array.isArray(value)) display = value.join(", ");
        else if (value !== undefined && value !== null && value !== "") display = String(value);

        if (f.type === "file_upload") display = lang === "ar" ? "(مرفق)" : "(see attached)";
        
        let label = f.labelEn || "";
        if (lang === "ar" && f.labelAr) label = f.labelAr;
        else if (lang === "both" && f.labelAr) label = `${f.labelAr} / ${f.labelEn || ""}`;
        
        const safeLabel = String(label || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeDisplay = String(display || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        fieldsHtml += `
          <div class="item-wrapper">
            <div class="field-row">
              <div class="field-label">${safeLabel}${f.required ? " <span class='req'>*</span>" : ""}</div>
              <div class="field-value">${safeDisplay}</div>
            </div>
          </div>
        `;
      }
    }

    // ── Signature block ──
    let signatureHtml = "";
    const sigTitle = lang === "en" ? "Customer Signature" : lang === "ar" ? "توقيع المشترك" : "توقيع المشترك / Customer Signature";
    const sigMissing = lang === "en"
      ? "Signature stored electronically."
      : lang === "ar"
        ? "تم حفظ التوقيع إلكترونياً"
        : "تم حفظ التوقيع إلكترونياً<br/>Signature stored electronically.";

    if (sub.signatureRef) {
      let imgSrc = "";
      if (sub.signatureRef.startsWith("data:image/")) {
        imgSrc = sub.signatureRef;
      } else {
        const sigPath = path.resolve(process.cwd(), "uploads", sub.signatureRef.replace(/^\/?uploads\//, ""));
        if (fs.existsSync(sigPath)) {
          try {
            const base64 = fs.readFileSync(sigPath).toString("base64");
            const ext = sigPath.endsWith(".jpg") || sigPath.endsWith(".jpeg") ? "jpeg" : "png";
            imgSrc = `data:image/${ext};base64,${base64}`;
          } catch { /* ignore */ }
        }
      }

      const formattedDate = sub.createdAt ? new Date(sub.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }) : "—";
      if (imgSrc) {
        signatureHtml = `
          <div class="signature-box">
            <div class="signature-title">${sigTitle}</div>
            <img class="signature-img" src="${imgSrc}" alt="Signature" />
            <div class="signature-meta">
              ${lang !== "ar" ? "Date" : "التاريخ"}: ${formattedDate}
            </div>
          </div>
        `;
      } else {
        signatureHtml = `
          <div class="signature-box">
            <div class="signature-title">${sigTitle}</div>
            <div class="sig-placeholder">${sigMissing}</div>
            <div class="signature-meta">
              ${lang !== "ar" ? "Date" : "التاريخ"}: ${formattedDate}
            </div>
          </div>
        `;
      }
    }

    // ── Attachments ──
    let attachmentsHtml = "";
    if ((sub.uploadedFileRefs ?? []).length) {
      const attachTitle = lang === "en" ? "Attached Files" : lang === "ar" ? "الملفات المرفقة" : "Attached Files / الملفات المرفقة";
      attachmentsHtml += `<div class="attachments-section"><div class="attachments-title">${attachTitle}</div><ul class="attachments-list">`;
      for (const r of sub.uploadedFileRefs ?? []) {
        if (!r) continue;
        const basename = path.basename(r);
        const underscoreIdx = basename.indexOf("_", basename.indexOf("_") + 1);
        const displayName = underscoreIdx !== -1 ? basename.slice(underscoreIdx + 1) : basename;
        attachmentsHtml += `<li>${String(displayName || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</li>`;
      }
      attachmentsHtml += `</ul></div>`;
    }

    const formTitle = sub.formTitle || "Form Submission";
    const metaCustomer = lang === "ar" ? "رقم العميل" : "Customer ID";
    const metaSubmission = lang === "ar" ? "رقم النموذج" : "Submission";
    const metaDate = lang === "ar" ? "التاريخ" : "Date";
    const metaVersion = lang === "ar" ? "الإصدار" : "Version";
    const safeTitle = String(formTitle || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeIp = String(sub.ip || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!DOCTYPE html>
<html lang="${isRtl ? "ar" : "en"}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; margin: 0; padding: 0;
      font-family: ${isRtl ? "'Tajawal'" : "'Inter'"}, 'Segoe UI', sans-serif;
      color: #1e293b; line-height: 1.6; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }

    .page { width: 100%; padding: 0; }

    .header {
      background: linear-gradient(135deg, #831843 0%, #be185d 40%, #db2777 100%);
      color: #fff; text-align: center;
      padding: 24px 28px 20px; position: relative; overflow: hidden;
    }
    .header::before {
      content: ''; position: absolute; inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .header-inner { position: relative; z-index: 1; }
    .logo { font-size: 26px; font-weight: 800; letter-spacing: -1px; margin-bottom: 2px; }
    .logo-sub { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; opacity: 0.7; font-weight: 500; margin-bottom: 8px; }
    .header-divider { width: 36px; height: 2px; background: rgba(255,255,255,0.4); margin: 0 auto 8px; }
    .title { font-size: 14px; font-weight: 700; }

    .meta-strip {
      display: flex; background: #fdf2f8; border-bottom: 1px solid #fce7f3;
      font-size: 8px; direction: ltr; text-align: left;
    }
    .meta-cell { flex: 1; padding: 6px 10px; border-${isRtl ? "left" : "right"}: 1px solid #fce7f3; }
    .meta-cell:last-child { border: none; }
    .meta-lbl { font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9d174d; font-size: 7px; margin-bottom: 1px; }
    .meta-val { color: #1e293b; font-weight: 600; word-break: break-all; font-size: 8px; }

    .body { padding: 16px 24px 12px; }

    .item-wrapper {
      padding: 12px 0;
      page-break-inside: avoid;
      break-inside: avoid;
      display: inline-block;
      width: 100%;
    }

    .static-text {
      background: #fafafa; border: 1px solid #f1f5f9;
      ${isRtl ? "border-right: 3px solid #db2777;" : "border-left: 3px solid #db2777;"}
      border-radius: 4px; padding: 12px 14px; margin: 0;
      font-size: 10px; color: #334155; line-height: 1.7;
      white-space: pre-line; text-align: start; unicode-bidi: plaintext;
    }

    .field-row {
      display: flex; align-items: baseline;
      padding: 6px 0; border-bottom: 1px solid #f1f5f9;
    }
    .field-row:last-child { border-bottom: none; }
    .field-label { flex: 0 0 35%; font-weight: 600; font-size: 10px; color: #64748b; ${isRtl ? "padding-left: 8px;" : "padding-right: 8px;"} }
    .field-value { flex: 1; font-size: 11px; font-weight: 600; color: #0f172a; }
    .req { color: #db2777; }

    .html2pdf__page-break {
      display: block; clear: both; page-break-before: always;
    }

    .signature-box {
      margin: 16px 0 0; border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 16px; text-align: center; page-break-inside: avoid;
      background: #fafafa;
    }
    .signature-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9d174d; margin-bottom: 10px; }
    .signature-img { max-height: 80px; max-width: 200px; display: block; margin: 0 auto; mix-blend-mode: multiply; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px; }
    .sig-placeholder { color: #94a3b8; font-size: 9px; padding: 10px 0; }
    .signature-meta { font-size: 7px; color: #94a3b8; margin-top: 8px; direction: ltr; }

    .attachments-section { margin-top: 12px; page-break-inside: avoid; }
    .attachments-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9d174d; margin-bottom: 4px; }
    .attachments-list { list-style: none; padding: 0; font-size: 9px; color: #475569; }
    .attachments-list li { padding: 2px 0; }

    .footer {
      text-align: center; font-size: 7px; color: #cbd5e1;
      padding: 10px 24px 40px; border-top: 1px solid #f1f5f9; direction: ltr;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-inner">
        <div class="logo">Belamonda</div>
        <div class="logo-sub">Beauty & Wellness</div>
        <div class="header-divider"></div>
        <div class="title">${safeTitle}</div>
      </div>
    </div>
    <div class="meta-strip">
      <div class="meta-cell"><div class="meta-lbl">${metaCustomer}</div><div class="meta-val">${sub.userId}</div></div>
      <div class="meta-cell"><div class="meta-lbl">${metaSubmission}</div><div class="meta-val">${String(sub._id)}</div></div>
      <div class="meta-cell"><div class="meta-lbl">${metaDate}</div><div class="meta-val">${sub.createdAt ? new Date(sub.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}</div></div>
      <div class="meta-cell"><div class="meta-lbl">${metaVersion}</div><div class="meta-val">v${sub.formVersion}</div></div>
    </div>
    <div class="body">
      ${fieldsHtml}
      ${signatureHtml ? `<div class="item-wrapper">${signatureHtml}</div>` : ""}
      ${attachmentsHtml ? `<div class="item-wrapper">${attachmentsHtml}</div>` : ""}
    </div>
    <div class="footer">
      Belamonda System &bull; Generated ${new Date().toISOString()} &bull; IP: ${safeIp}
    </div>
  </div>
</body>
</html>`;

    // ── Generate actual PDF with Puppeteer ──
    const format = req.query.format;
    
    // We return HTML and the client uses html2pdf.js to convert it to a file silently.
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (e) {
    console.error("PDF generation error:", e);
    next(e);
  }
});
