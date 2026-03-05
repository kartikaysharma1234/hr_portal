import { Schema, model, type InferSchemaType } from 'mongoose';

const roleValues = ['super_admin', 'admin', 'hr', 'manager', 'employee'] as const;
const authProviderValues = ['local', 'google'] as const;

const userSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: false,
      default: null,
      select: false
    },
    authProvider: {
      type: String,
      enum: authProviderValues,
      default: 'local'
    },
    googleId: {
      type: String,
      default: undefined
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: roleValues,
      default: 'employee'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ organization: 1, email: 1 }, { unique: true });
userSchema.index(
  { organization: 1, googleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      googleId: { $type: 'string' }
    }
  }
);

export type User = InferSchemaType<typeof userSchema>;
export type UserRole = User['role'];

export const UserModel = model<User>('User', userSchema);
