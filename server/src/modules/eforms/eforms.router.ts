import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mongoose from "mongoose";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
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

/** Save a base64 data URL (image/png or image/jpeg) to disk. Returns relative file ref. */
function saveSignatureDataUrl(dataUrl: string): string | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const ext = match[1].toLowerCase().startsWith("jp") ? "jpg" : "png";
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 2 * 1024 * 1024) return null; // 2MB max signature
  const filename = `sig_${Date.now()}_${Math.random().toString(16).slice(2, 8)}.${ext}`;
  const fullPath = path.join(EFORMS_UPLOAD_DIR, filename);
  fs.writeFileSync(fullPath, buffer);
  return `eforms/${filename}`;
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
eformsRouter.get("/admin/forms", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const rows = await EFormModel.find({}).sort({ createdAt: -1 }).lean<EFormDoc[]>();
    return res.json({ items: rows.map((r) => serializeForm(r)) });
  } catch (e) {
    next(e);
  }
});

eformsRouter.post("/admin/forms", authRequired, requireRole(["admin"]), async (req, res, next) => {
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

eformsRouter.patch("/admin/forms/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
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

eformsRouter.delete("/admin/forms/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    await EFormModel.findByIdAndUpdate(req.params.id, { $set: { archived: true } }).lean();
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin: list submissions ──
eformsRouter.get("/admin/submissions", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
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
    return res.json({ items: rows.map((r) => serializeSubmission(r)) });
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
    const isStaff = req.auth!.role === "admin" || req.auth!.role === "cs";
    if (!isOwner && !isStaff) return res.status(403).json({ error: "FORBIDDEN" });

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="form-${String(sub._id)}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor("#0f172a").text(sub.formTitle, { align: "left" });
    doc
      .moveDown(0.2)
      .fontSize(10)
      .fillColor("#64748b")
      .text(`Submission ID: ${String(sub._id)}`)
      .text(`Customer: ${sub.userId}`)
      .text(`Submitted: ${sub.createdAt ? new Date(sub.createdAt).toISOString() : "—"}`)
      .text(`Form version: ${sub.formVersion}`);
    doc.moveDown(0.6);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
    doc.moveDown(0.8);

    const answersByKey = new Map((sub.answers ?? []).map((a: any) => [a.key, a.value]));
    const fields = ((sub.formSnapshot ?? []) as any[]).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const f of fields) {
      doc.fontSize(11).fillColor("#0f172a").text(`${f.labelEn}${f.required ? " *" : ""}`);
      const value = answersByKey.get(f.key);
      let display = "—";
      if (Array.isArray(value)) display = value.join(", ");
      else if (value !== undefined && value !== null && value !== "") display = String(value);
      if (f.type === "signature" || f.type === "file_upload") display = "(see attached)";
      doc.fontSize(11).fillColor("#334155").text(display, { indent: 10 });
      doc.moveDown(0.6);
    }

    if (sub.signatureRef) {
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e2e8f0").stroke();
      doc.moveDown(0.6);
      doc.fontSize(13).fillColor("#0f172a").text("Signed by");
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor("#475569")
        .text(`Customer ID: ${sub.userId}`)
        .text(`Date: ${sub.createdAt ? new Date(sub.createdAt).toUTCString() : "—"}`)
        .text(`IP: ${sub.ip ?? "—"}`)
        .text(`User Agent: ${sub.userAgent ?? "—"}`);
      doc.moveDown(0.5);
      const sigPath = path.resolve(process.cwd(), "uploads", sub.signatureRef.replace(/^\/?uploads\//, ""));
      if (fs.existsSync(sigPath)) {
        try {
          doc.image(sigPath, { fit: [220, 90] });
        } catch {
          doc.fontSize(10).fillColor("#94a3b8").text("(signature image could not be embedded)");
        }
      } else {
        doc.fontSize(10).fillColor("#94a3b8").text("(signature file not found)");
      }
    }

    if ((sub.uploadedFileRefs ?? []).length) {
      doc.moveDown(0.6);
      doc.fontSize(11).fillColor("#0f172a").text("Attached files:");
      for (const r of sub.uploadedFileRefs ?? []) {
        // Stored ref format: eforms/{timestamp}_{random}_{safe_original_name}
        const basename = path.basename(r);
        const underscoreIdx = basename.indexOf("_", basename.indexOf("_") + 1);
        const displayName = underscoreIdx !== -1 ? basename.slice(underscoreIdx + 1) : basename;
        doc.fontSize(10).fillColor("#475569").text(`• ${displayName}`, { indent: 10 });
      }
    }

    doc.moveDown(1);
    if (!sub.signatureRef) {
      doc.fontSize(8).fillColor("#94a3b8").text(`IP: ${sub.ip ?? "—"}  •  UA: ${sub.userAgent ?? "—"}`);
    }

    doc.end();
  } catch (e) {
    next(e);
  }
});
