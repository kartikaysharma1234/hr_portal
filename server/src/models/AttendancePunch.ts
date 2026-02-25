import { Schema, model } from 'mongoose';

const punchTypeValues = ['IN', 'OUT'] as const;
const punchSourceValues = ['mobile_app', 'web', 'biometric', 'csv_import', 'api_sync'] as const;
const validationStatusValues = ['valid', 'invalid', 'pending_approval', 'warning'] as const;
const approvalStatusValues = ['not_required', 'pending', 'approved', 'rejected'] as const;

const reasonSchema = new Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'invalid'], required: true },
    meta: { type: Schema.Types.Mixed, default: undefined }
  },
  { _id: false }
);

const attendancePunchSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    punchDate: {
      type: String,
      required: true,
      index: true
    },
    punchTime: {
      type: Date,
      required: true,
      index: true
    },
    punchType: {
      type: String,
      enum: punchTypeValues,
      required: true,
      index: true
    },
    gps: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
      accuracy: { type: Number, required: true, min: 0 },
      address: { type: String, default: '' }
    },
    gpsPoint: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (value?: number[]): boolean => !value || value.length === 2,
          message: 'gpsPoint.coordinates must be [longitude, latitude]'
        }
      }
    },
    nearestOfficeLocation: {
      type: Schema.Types.ObjectId,
      ref: 'OfficeLocation',
      default: null,
      index: true
    },
    distanceFromOfficeMeters: {
      type: Number,
      default: null
    },
    punchSource: {
      type: String,
      enum: punchSourceValues,
      required: true,
      index: true
    },
    device: {
      deviceId: { type: String, required: true, trim: true },
      macAddress: { type: String, default: '' },
      ipAddress: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      platform: { type: String, default: '' },
      appVersion: { type: String, default: '' },
      fingerprint: { type: String, default: '' },
      isRooted: { type: Boolean, default: false },
      isJailBroken: { type: Boolean, default: false }
    },
    validation: {
      status: {
        type: String,
        enum: validationStatusValues,
        required: true,
        index: true
      },
      reasons: {
        type: [reasonSchema],
        default: []
      },
      colorHex: { type: String, required: true },
      colorClass: { type: String, required: true },
      modeApplied: { type: String, default: '' },
      checks: {
        geofence: { type: String, default: '' },
        time: { type: String, default: '' },
        device: { type: String, default: '' },
        photo: { type: String, default: '' }
      },
      evaluatedAt: { type: Date, default: Date.now }
    },
    photo: {
      url: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      sizeBytes: { type: Number, default: 0 },
      capturedAt: { type: Date, default: null }
    },
    approvalWorkflow: {
      required: { type: Boolean, default: false },
      status: {
        type: String,
        enum: approvalStatusValues,
        default: 'not_required',
        index: true
      },
      requestedAt: { type: Date, default: null },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      decidedAt: { type: Date, default: null },
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      decisionComment: { type: String, default: '' },
      auditTrail: {
        type: [
          new Schema(
            {
              action: {
                type: String,
                enum: ['created', 'approved', 'rejected', 'regularized', 'auto_approved'],
                required: true
              },
              byUser: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                default: null
              },
              at: {
                type: Date,
                default: Date.now
              },
              comment: {
                type: String,
                default: ''
              }
            },
            { _id: false }
          )
        ],
        default: []
      }
    },
    workMetrics: {
      pairedPunch: {
        type: Schema.Types.ObjectId,
        ref: 'AttendancePunch',
        default: null
      },
      workingMinutes: { type: Number, default: 0 },
      overtimeMinutes: { type: Number, default: 0 },
      lateMinutes: { type: Number, default: 0 },
      earlyExitMinutes: { type: Number, default: 0 },
      dayStatus: {
        type: String,
        default: 'present'
      },
      computedAt: { type: Date, default: null }
    },
    regularization: {
      requestId: {
        type: Schema.Types.ObjectId,
        ref: 'AttendanceRegularization',
        default: null
      },
      isRegularized: { type: Boolean, default: false },
      regularizedAt: { type: Date, default: null },
      regularizedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      comment: { type: String, default: '' }
    },
    syncMeta: {
      sourceBatchId: { type: String, default: '' },
      importedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      importedAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

attendancePunchSchema.index({ organization: 1, employee: 1, punchTime: -1 });
attendancePunchSchema.index({ organization: 1, user: 1, punchTime: -1 });
attendancePunchSchema.index({ organization: 1, punchDate: 1, employee: 1 });
attendancePunchSchema.index({ organization: 1, 'validation.status': 1, punchTime: -1 });
attendancePunchSchema.index({ organization: 1, 'approvalWorkflow.status': 1, punchTime: -1 });
attendancePunchSchema.index({ organization: 1, punchSource: 1, punchTime: -1 });
attendancePunchSchema.index({ gpsPoint: '2dsphere' });

export type AttendancePunch = any;

export const AttendancePunchModel = model<any>('AttendancePunch', attendancePunchSchema);
