import { Router } from "express";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import {
  getOrCreateReferralCode,
  getReferralStats,
  getAllStaffReferralStats
} from "./referral.service.js";

export const referralRouter = Router();

const STAFF_ROLES = ["admin", "cs", "finance", "clinicStaff", "legal", "cs_director"] as const;
const STAFF_ROLES_MUT = [...STAFF_ROLES] as ("admin" | "cs" | "finance" | "clinicStaff" | "legal" | "cs_director")[];
const ALL_AUTHED_ROLES = ["customer", ...STAFF_ROLES] as ("customer" | "admin" | "cs" | "finance" | "clinicStaff" | "legal" | "cs_director")[];

referralRouter.get(
  "/my-code",
  authRequired,
  requireRole(ALL_AUTHED_ROLES),
  async (req, res, next) => {
    try {
      const code = await getOrCreateReferralCode(req.auth!.userId);
      return res.json({ code });
    } catch (e) {
      next(e);
    }
  }
);

referralRouter.get(
  "/stats",
  authRequired,
  requireRole(ALL_AUTHED_ROLES),
  async (req, res, next) => {
    try {
      const stats = await getReferralStats(req.auth!.userId);
      return res.json(stats);
    } catch (e) {
      next(e);
    }
  }
);

referralRouter.get(
  "/admin/all",
  authRequired,
  requireRole(["admin", "finance", "cs", "legal", "cs_director"]),
  async (req, res, next) => {
    try {
      const items = await getAllStaffReferralStats();
      return res.json({ items });
    } catch (e) {
      next(e);
    }
  }
);

