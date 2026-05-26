import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { kycStore } from "./kyc.store.js";
import { notifyKycApproved, notifyKycRejected, notifyKycSubmitted } from "../notifications/notifications.service.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: "dyxzbgiic",
  api_key: "525168948871956",
  api_secret: "q4Qf-Y32H9yVJYm-G-m1ufJ15Ns"
});

async function uploadToCloudinary(base64Image: string): Promise<string> {
  if (!base64Image.startsWith("data:image")) return base64Image;
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: "kyc_documents"
  });
  return result.secure_url;
}
const CheckboxesSchema = z.object({
  termsAndConditions: z.literal(true),
  dataPrivacyConsent: z.literal(true),
  serviceLiabilityWaiver: z.literal(true),
  age18Plus: z.literal(true),
  paymentTermsAcknowledgment: z.literal(true)
});

const SubmitKycSchema = z.object({
  civilIdNumber: z.string().regex(/^\d{12}$/),
  civilIdFrontRef: z.string().min(1),
  civilIdBackRef: z.string().min(1),
  checkboxes: CheckboxesSchema
});

const RejectSchema = z.object({
  reason: z.string().min(3)
});

export const kycRouter = Router();

// Customer submits KYC inline at purchase gate (SRS FR-02, FR-04)
kycRouter.post("/submit", authRequired, async (req, res, next) => {
  try {
    const parsed = SubmitKycSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    // Ensure user exists in store (local MVP)
    await kycStore.ensureUser(req.auth!.userId, req.auth!.role);

    // Upload to Cloudinary if they are base64
    const frontUrl = await uploadToCloudinary(parsed.data.civilIdFrontRef);
    const backUrl = await uploadToCloudinary(parsed.data.civilIdBackRef);

    const submission = await kycStore.createSubmission({ 
      userId: req.auth!.userId, 
      civilIdNumber: parsed.data.civilIdNumber,
      civilIdFrontRef: frontUrl,
      civilIdBackRef: backUrl,
      checkboxes: parsed.data.checkboxes 
    });
    notifyKycSubmitted(req.auth!.userId);
    return res.status(201).json({ submission });
  } catch (e) {
    next(e);
  }
});

// CS queue view (SRS FR-03)
kycRouter.get("/cs/queue", authRequired, requireRole(["legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const status = req.query.status;
    const parsedStatus =
      status === "pending" || status === "approved" || status === "rejected" ? status : undefined;
    const items = await kycStore.listSubmissions(parsedStatus);
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// CS approve (SRS FR-03) + wallet init (FR-10)
kycRouter.post("/cs/:submissionId/approve", authRequired, requireRole(["legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const updated = await kycStore.approveSubmission(req.params.submissionId, req.auth!.userId);
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    notifyKycApproved(updated.userId);
    const { logAuditAction } = await import("../../services/audit.service.js");
    await logAuditAction({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role as any,
      actionType: "approve_kyc",
      targetEntityType: "KycSubmission",
      targetEntityId: req.params.submissionId,
      afterState: { status: "approved" },
      metadata: { userId: updated.userId },
    });
    return res.json({ submission: updated });
  } catch (e) {
    next(e);
  }
});

// CS reject with mandatory reason (SRS §4.1.2)
kycRouter.post("/cs/:submissionId/reject", authRequired, requireRole(["legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = RejectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const updated = await kycStore.rejectSubmission(req.params.submissionId, req.auth!.userId, parsed.data.reason);
    if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
    notifyKycRejected(updated.userId, parsed.data.reason);
    const { logAuditAction } = await import("../../services/audit.service.js");
    await logAuditAction({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role as any,
      actionType: "reject_kyc",
      targetEntityType: "KycSubmission",
      targetEntityId: req.params.submissionId,
      afterState: { status: "rejected" },
      metadata: { userId: updated.userId, reason: parsed.data.reason },
    });
    return res.json({ submission: updated });
  } catch (e) {
    next(e);
  }
});

// Customer wallet view (SRS FR-12). For now returns wallet only when approved.
kycRouter.get("/me/wallet", authRequired, async (req, res, next) => {
  try {
    const wallet = await kycStore.getWallet(req.auth!.userId);
    if (!wallet) return res.json({ wallet: null });
    const txns = await kycStore.listWalletTxns(req.auth!.userId);
    return res.json({ wallet, txns });
  } catch (e) {
    next(e);
  }
});

