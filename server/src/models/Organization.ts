import { Schema, model, type InferSchemaType } from 'mongoose';

import { getDefaultOrganizationSettings } from '../config/defaultOrganizationSettings';

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
    logoDataUrl: {
      type: String,
      default: ''
    },
    settings: {
      type: Schema.Types.Mixed,
      default: getDefaultOrganizationSettings
    }
  },
  {
    timestamps: true
  }
);

export type Organization = InferSchemaType<typeof organizationSchema>;

export const OrganizationModel = model<Organization>('Organization', organizationSchema);
