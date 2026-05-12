import mongoose, { Schema } from "mongoose";

/**
 * Tracks the last time an SMS form-signature reminder was sent to a user for a
 * specific form+version. Used by the form-signature reminder background job to
 * avoid spamming users within the 24-hour cooldown window — survives server
 * restarts unlike an in-memory Map.
 */
const FormReminderLogSchema = new Schema(
  {
    userId: { type: String, required: true },
    formId: { type: Schema.Types.ObjectId, ref: "EForm", required: true },
    formVersion: { type: Number, required: true },
    sentAt: { type: Date, required: true }
  },
  { timestamps: false }
);

FormReminderLogSchema.index({ userId: 1, formId: 1 }, { unique: true });
FormReminderLogSchema.index({ sentAt: 1 });

export const FormReminderLogModel =
  mongoose.models.FormReminderLog ??
  mongoose.model("FormReminderLog", FormReminderLogSchema);
