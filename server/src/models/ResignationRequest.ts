import { Schema, model } from 'mongoose';

const resignationStatusValues = ['submitted', 'approved', 'rejected', 'cancelled'] as const;
const resignationAuditActionValues = ['submitted', 'approved', 'rejected', 'cancelled'] as const;

const resignationAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: resignationAuditActionValues,
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

const resignationRequestSchema = new Schema(
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
    dateOfResignation: {
      type: String,
      required: true
    },
    noticePeriodDays: {
      type: Number,
      required: true,
      min: 0,
      default: 90
    },
    lastDateAsPerPolicy: {
      type: String,
      required: true
    },
    expectedLastDate: {
      type: String,
      required: true
    },
    reportingManagerUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    hrManagerUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reasonForExit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 3000
    },
    status: {
      type: String,
      enum: resignationStatusValues,
      default: 'submitted',
      index: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
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
      type: [resignationAuditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

resignationRequestSchema.index({ organization: 1, requestedBy: 1, createdAt: -1 });
resignationRequestSchema.index({ organization: 1, hrManagerUser: 1, status: 1, createdAt: -1 });
resignationRequestSchema.index({ organization: 1, reportingManagerUser: 1, status: 1, createdAt: -1 });

export type ResignationRequest = any;

export const ResignationRequestModel = model<any>('ResignationRequest', resignationRequestSchema);
