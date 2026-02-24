import { Schema, model, type InferSchemaType } from 'mongoose';

const tokenPurposeValues = ['email_verify', 'password_reset'] as const;

const authActionTokenSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    purpose: {
      type: String,
      enum: tokenPurposeValues,
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

authActionTokenSchema.index({ organization: 1, user: 1, purpose: 1 });

export type AuthActionToken = InferSchemaType<typeof authActionTokenSchema>;
export type AuthActionTokenPurpose = AuthActionToken['purpose'];

export const AuthActionTokenModel = model<AuthActionToken>('AuthActionToken', authActionTokenSchema);
