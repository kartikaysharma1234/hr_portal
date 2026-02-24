import { Schema, model, type InferSchemaType } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    settings: {
      timezone: {
        type: String,
        default: 'UTC'
      },
      currency: {
        type: String,
        default: 'USD'
      }
    }
  },
  {
    timestamps: true
  }
);

export type Organization = InferSchemaType<typeof organizationSchema>;

export const OrganizationModel = model<Organization>('Organization', organizationSchema);
