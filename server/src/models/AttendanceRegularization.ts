import { Schema, model } from 'mongoose';

const regularizationStatusValues = ['pending', 'approved', 'rejected', 'cancelled'] as const;
const regularizationTypeValues = ['missed_punch', 'invalid_punch', 'manual_correction'] as const;

const regularizationRequestSchema = new Schema(
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
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    relatedPunch: {
      type: Schema.Types.ObjectId,
      ref: 'AttendancePunch',
      default: null
    },
    requestType: {
      type: String,
      enum: regularizationTypeValues,
      required: true
    },
    targetDate: {
      type: String,
      required: true,
      index: true
    },
    requestedPunchType: {
      type: String,
      enum: ['IN', 'OUT'],
      default: null
    },
    requestedPunchTime: {
      type: Date,
      default: null
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1500
    },
    supportingDocuments: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: regularizationStatusValues,
      default: 'pending',
      index: true
    },
    managerApproval: {
      required: { type: Boolean, default: true },
      status: { type: String, enum: ['pending', 'approved', 'rejected', 'not_required'], default: 'pending' },
      actedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      actedAt: { type: Date, default: null },
      comment: { type: String, default: '' }
    },
    hrApproval: {
      required: { type: Boolean, default: false },
      status: { type: String, enum: ['pending', 'approved', 'rejected', 'not_required'], default: 'not_required' },
      actedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      actedAt: { type: Date, default: null },
      comment: { type: String, default: '' }
    },
    finalDecisionBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    finalDecisionAt: {
      type: Date,
      default: null
    },
    finalDecisionComment: {
      type: String,
      default: ''
    },
    auditTrail: {
      type: [
        new Schema(
          {
            action: {
              type: String,
              enum: ['created', 'manager_approved', 'manager_rejected', 'hr_approved', 'hr_rejected', 'closed'],
              required: true
            },
            byUser: {
              type: Schema.Types.ObjectId,
              ref: 'User',
              required: true
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
  {
    timestamps: true
  }
);

regularizationRequestSchema.index({ organization: 1, employee: 1, createdAt: -1 });
regularizationRequestSchema.index({ organization: 1, status: 1, createdAt: -1 });
regularizationRequestSchema.index({ organization: 1, requestedBy: 1, targetDate: 1 });

export type AttendanceRegularization = any;

export const AttendanceRegularizationModel = model<any>(
  'AttendanceRegularization',
  regularizationRequestSchema
);
