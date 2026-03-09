import { Schema, model } from 'mongoose';

const leaveEncashmentStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
const leaveEncashmentTypeValues = ['PL', 'CL', 'SL', 'OH'] as const;
const leaveEncashmentAuditActionValues = [
  'created',
  'saved',
  'submitted',
  'approved',
  'rejected',
  'cancelled'
] as const;

const leaveEncashmentAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: leaveEncashmentAuditActionValues,
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
);

const leaveEncashmentRequestSchema = new Schema(
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
    leaveType: {
      type: String,
      enum: leaveEncashmentTypeValues,
      required: true
    },
    daysToEncash: {
      type: Number,
      required: true,
      min: 0.5
    },
    approverUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 3000
    },
    encashableDaysPerYear: {
      type: Number,
      min: 0,
      default: 0
    },
    encashedDaysCurrentYear: {
      type: Number,
      min: 0,
      default: 0
    },
    currentLeaveBalance: {
      type: Number,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: leaveEncashmentStatusValues,
      default: 'pending',
      index: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    decidedAt: {
      type: Date,
      default: null
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    decisionComment: {
      type: String,
      default: ''
    },
    auditTrail: {
      type: [leaveEncashmentAuditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

leaveEncashmentRequestSchema.index({ organization: 1, requestedBy: 1, createdAt: -1 });
leaveEncashmentRequestSchema.index({ organization: 1, approverUser: 1, status: 1, createdAt: -1 });
leaveEncashmentRequestSchema.index({ organization: 1, employee: 1, leaveType: 1, createdAt: -1 });

export type LeaveEncashmentRequest = any;

export const LeaveEncashmentRequestModel = model<any>(
  'LeaveEncashmentRequest',
  leaveEncashmentRequestSchema
);
