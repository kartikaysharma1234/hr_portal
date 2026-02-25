import { Schema, model } from 'mongoose';

const geofenceModeValues = ['strict', 'flexible', 'warning_only'] as const;

const officeLocationSchema = new Schema(
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
      trim: true,
      maxlength: 120
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240
    },
    addressLine2: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    state: {
      type: String,
      trim: true,
      default: ''
    },
    postalCode: {
      type: String,
      trim: true,
      default: ''
    },
    country: {
      type: String,
      trim: true,
      default: ''
    },
    geoPoint: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value: number[]): boolean => value.length === 2,
          message: 'geoPoint.coordinates must be [longitude, latitude]'
        }
      }
    },
    geofenceRadiusMeters: {
      type: Number,
      required: true,
      min: 10,
      max: 10000
    },
    geofenceMode: {
      type: String,
      enum: geofenceModeValues,
      default: 'strict'
    },
    departmentRestrictions: {
      type: [String],
      default: []
    },
    shiftRestrictions: {
      type: [String],
      default: []
    },
    isPrimary: {
      type: Boolean,
      default: false
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

officeLocationSchema.index({ organization: 1, isActive: 1 });
officeLocationSchema.index({ organization: 1, name: 1 }, { unique: true });
officeLocationSchema.index({ organization: 1, isPrimary: 1 });
officeLocationSchema.index({ geoPoint: '2dsphere' });

export type OfficeLocation = any;

export const OfficeLocationModel = model<any>('OfficeLocation', officeLocationSchema);
