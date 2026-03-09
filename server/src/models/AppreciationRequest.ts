import { Schema, model } from 'mongoose';

const appreciationStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
const appreciationAuditActionValues = [
  'created',
  'saved',
  'submitted',
  'approved',
  'rejected',
  'cancelled'
] as const;

const appreciationAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: appreciationAuditActionValues,
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

const appreciationRequestSchema = new Schema(
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
    appreciationToUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    appreciationToEmployee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null
    },
    appreciationCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    appreciationTitle: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 240
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 3000
    },
    approverUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: appreciationStatusValues,
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
      type: [appreciationAuditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

appreciationRequestSchema.index({ organization: 1, requestedBy: 1, createdAt: -1 });
appreciationRequestSchema.index({ organization: 1, approverUser: 1, status: 1, createdAt: -1 });
appreciationRequestSchema.index({ organization: 1, appreciationToUser: 1, createdAt: -1 });

export type AppreciationRequest = any;

export const AppreciationRequestModel = model<any>('AppreciationRequest', appreciationRequestSchema);
