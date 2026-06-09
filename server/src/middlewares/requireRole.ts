import type { NextFunction, Request, Response } from "express";
import type { Role } from "@belamonda/shared";

export function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.auth?.role as Role | undefined;
    if (!role) return res.status(401).json({ error: "UNAUTHORIZED" });
    if (!roles.includes(role)) return res.status(403).json({ error: "FORBIDDEN" });
    return next();
  };
}

