import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { kycStore } from "./kyc.store.js";
import { notifyKycApproved, notifyKycRejected, notifyKycSubmitted } from "../notifications/notifications.service.js";

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
  signatureRef: z.string().min(1),
  checkboxes: CheckboxesSchema
});

const RejectSchema = z.object({
  reason: z.string().min(3)
});

export const kycRouter = Router();

// Customer submits KYC inline at purchase gate (SRS FR-02, FR-04)
kycRouter.post("/submit", authRequired, (req, res) => {
  const parsed = SubmitKycSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  // Ensure user exists in store (local MVP)
  kycStore.ensureUser(req.auth!.userId, req.auth!.role);

  const submission = kycStore.createSubmission({ userId: req.auth!.userId, ...parsed.data });
  notifyKycSubmitted(req.auth!.userId);
  return res.status(201).json({ submission });
});

// CS queue view (SRS FR-03)
kycRouter.get("/cs/queue", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const status = req.query.status;
  const parsedStatus =
    status === "pending" || status === "approved" || status === "rejected" ? status : undefined;
  const items = kycStore.listSubmissions(parsedStatus);
  return res.json({ items });
});

// CS approve (SRS FR-03) + wallet init (FR-10)
kycRouter.post("/cs/:submissionId/approve", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const updated = kycStore.approveSubmission(req.params.submissionId, req.auth!.userId);
  if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
  notifyKycApproved(updated.userId);
  return res.json({ submission: updated });
});

// CS reject with mandatory reason (SRS §4.1.2)
kycRouter.post("/cs/:submissionId/reject", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const parsed = RejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const updated = kycStore.rejectSubmission(req.params.submissionId, req.auth!.userId, parsed.data.reason);
  if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
  notifyKycRejected(updated.userId, parsed.data.reason);
  return res.json({ submission: updated });
});

// Customer wallet view (SRS FR-12). For now returns wallet only when approved.
kycRouter.get("/me/wallet", authRequired, (req, res) => {
  const wallet = kycStore.getWallet(req.auth!.userId);
  if (!wallet) return res.json({ wallet: null });
  const txns = kycStore.listWalletTxns(req.auth!.userId);
  return res.json({ wallet, txns });
});

