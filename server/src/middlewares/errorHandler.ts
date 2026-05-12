import type { NextFunction, Request, Response } from "express";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error(err);

  // Express JSON parser error (invalid JSON)
  if (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    (err as { type?: unknown }).type === "entity.parse.failed"
  ) {
    return res.status(400).json({ error: "INVALID_JSON" });
  }

  if (err instanceof Error && err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS_FORBIDDEN" });
  }

  return res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
}

