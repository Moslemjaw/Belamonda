import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { verifyAccessToken } from "../modules/auth/token.js";
import { UserModel } from "../models/user.model.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: string; clinicId?: string };
    }
  }
}

// Tokens are long-lived, so every request re-checks that the account still exists,
// is active and still has the role baked into the token. Results are cached briefly
// so a disable/role change takes effect within ACCOUNT_CACHE_MS without a DB hit
// on every request.
const ACCOUNT_CACHE_MS = 15_000;
const accountCache = new Map<string, { ok: boolean; role?: string; at: number }>();

async function accountStatus(userId: string): Promise<{ ok: boolean; role?: string }> {
  const hit = accountCache.get(userId);
  if (hit && Date.now() - hit.at < ACCOUNT_CACHE_MS) return hit;
  const user = mongoose.isValidObjectId(userId)
    ? await UserModel.findById(userId).select("role isActive").lean<{ role: string; isActive?: boolean } | null>()
    : null;
  const status = { ok: !!user && user.isActive !== false, role: user?.role, at: Date.now() };
  accountCache.set(userId, status);
  return status;
}

/** True when the token's account still exists, is active and holds the token's role. */
export async function isTokenAccountValid(payload: { sub: string; role: string }): Promise<boolean> {
  if (payload.sub.startsWith("impersonated_")) return true;
  const status = await accountStatus(payload.sub);
  return status.ok && status.role === payload.role;
}

/** Drop the cached account status so the next request re-reads it (e.g. after disabling a user). */
export function forgetAccountStatus(userId: string) {
  accountCache.delete(userId);
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  let token = "";
  if (header?.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length);
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  // Admin "view as clinic" tokens carry a synthetic subject, not a real user id.
  if (!payload.sub.startsWith("impersonated_")) {
    try {
      const status = await accountStatus(payload.sub);
      if (!status.ok) return res.status(401).json({ error: "ACCOUNT_DISABLED" });
      if (status.role !== payload.role) return res.status(401).json({ error: "UNAUTHORIZED" });
    } catch (e) {
      return next(e);
    }
  }

  req.auth = { userId: payload.sub, role: payload.role, clinicId: payload.clinicId };
  return next();
}
