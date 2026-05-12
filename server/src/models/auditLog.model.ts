import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { Role } from "@belamonda/shared";

export interface AuditLogDoc extends Document {
  actorId: Types.ObjectId | string;
  actorRole: Role;
  actionType: string;
  targetEntityType: string;
  targetEntityId: Types.ObjectId | string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    actorId: { type: Schema.Types.Mixed, required: true }, // Can be 'system' or ObjectId
    actorRole: { type: String, required: true },
    actionType: { type: String, required: true }, // e.g. 'update_offer', 'create_booking'
    targetEntityType: { type: String, required: true }, // e.g. 'Offer', 'Booking'
    targetEntityId: { type: Schema.Types.Mixed, required: true },
    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ actionType: 1, createdAt: -1 });
AuditLogSchema.index({ targetEntityType: 1, targetEntityId: 1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = mongoose.model<AuditLogDoc>("AuditLog", AuditLogSchema);
