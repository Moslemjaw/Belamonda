// Which websites may call the API from a browser, and how large a JSON body may be.
import express, { type RequestHandler } from "express";

/** Our own Vercel project: production alias plus the team's preview/branch URLs. */
const VERCEL_PROJECT = /^https:\/\/belamonda(-[a-z0-9-]+-ctrlteam)?\.vercel\.app$/;

export function isAllowedOrigin(
  origin: string,
  opts: { production: boolean; extraOrigins?: string[] }
): boolean {
  if (!opts.production) {
    // Vite dev server on any localhost port, and Replit dev proxy domains
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
    if (/\.replit\.dev(:\d+)?$/.test(origin)) return true;
  }
  if (/^https?:\/\/(www\.)?belamondokw\.com$/.test(origin)) return true;
  if (VERCEL_PROJECT.test(origin)) return true;
  if (origin === "https://belamonda.onrender.com") return true; // same-origin SPA on Render
  return (opts.extraOrigins ?? []).includes(origin);
}

/**
 * Routes whose JSON bodies carry images as base64 (KYC Civil ID photos, cashback invoices,
 * offer/promotion images, e-form signatures). Phone photos are sent uncompressed, so these
 * keep the large limit; every other route gets JSON_LIMIT_DEFAULT.
 */
const UPLOAD_ROUTES: Array<{ method: string; path: RegExp }> = [
  { method: "POST", path: /^\/kyc\/submit\/?$/ },
  { method: "POST", path: /^\/cashback-requests\/submit\/?$/ },
  { method: "POST", path: /^\/offers\/admin\/?$/ },
  { method: "PATCH", path: /^\/offers\/admin\/[^/]+\/?$/ },
  { method: "POST", path: /^\/promotions\/admin\/?$/ },
  { method: "PUT", path: /^\/promotions\/admin\/[^/]+\/?$/ },
  { method: "POST", path: /^\/eforms\/submit\/?$/ }
];

export const JSON_LIMIT_UPLOADS = "50mb";
export const JSON_LIMIT_DEFAULT = "2mb";

export function isUploadRoute(method: string, path: string) {
  return UPLOAD_ROUTES.some((r) => r.method === method && r.path.test(path));
}

export function jsonBodyParser(): RequestHandler {
  const large = express.json({ limit: JSON_LIMIT_UPLOADS });
  const normal = express.json({ limit: JSON_LIMIT_DEFAULT });
  return (req, res, next) => (isUploadRoute(req.method, req.path) ? large : normal)(req, res, next);
}
