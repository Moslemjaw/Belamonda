import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { AccessTokenPayload } from "./auth.types.js";

const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 365 * 100; // ~100 years (effectively unlimited)

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TTL_SECONDS
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

