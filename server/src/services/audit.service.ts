import { AuditLogModel } from "../models/auditLog.model.js";
import type { Role } from "@belamonda/shared";
import type { Types } from "mongoose";

export async function logAuditAction(params: {
  actorId: Types.ObjectId | string;
  actorRole: Role | "system";
  actionType: string;
  targetEntityType: string;
  targetEntityId: Types.ObjectId | string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
}) {
  try {
    await AuditLogModel.create({
      actorId: params.actorId,
      actorRole: params.actorRole,
      actionType: params.actionType,
      targetEntityType: params.targetEntityType,
      targetEntityId: params.targetEntityId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      metadata: params.metadata
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
