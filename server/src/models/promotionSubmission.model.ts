import mongoose, { Schema } from "mongoose";

const AnswerSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const PromotionSubmissionSchema = new Schema(
  {
    promotionId: { type: Schema.Types.ObjectId, ref: "Promotion", required: true, index: true },
    promotionTitle: { type: String, required: true },
    userId: { type: String, index: true }, // Optional if guest
    guestName: { type: String },
    guestPhone: { type: String },
    guestEmail: { type: String },
    answers: { type: [AnswerSchema], default: [] },
    ip: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

PromotionSubmissionSchema.index({ promotionId: 1, createdAt: -1 });

export type PromotionSubmissionDoc = mongoose.InferSchemaType<typeof PromotionSubmissionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PromotionSubmissionModel =
  mongoose.models.PromotionSubmission ?? mongoose.model("PromotionSubmission", PromotionSubmissionSchema);
