import { Schema, model } from 'mongoose';

const helpDeskStatusValues = ['pending', 'submitted', 'responded', 'cancelled'] as const;
const helpDeskPriorityValues = ['high', 'medium', 'low'] as const;
const helpDeskTargetValues = ['support_owner', 'reporting_manager'] as const;
const helpDeskAuditActionValues = ['created', 'saved', 'submitted', 'responded', 'cancelled'] as const;

const helpDeskAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: helpDeskAuditActionValues,
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

const helpDeskRequestSchema = new Schema(
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
    ticketType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    targetType: {
      type: String,
      enum: helpDeskTargetValues,
      default: 'support_owner'
    },
    assignedToUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    priority: {
      type: String,
      enum: helpDeskPriorityValues,
      default: 'medium'
    },
    subject: {
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
    response: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000
    },
    attachments: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: helpDeskStatusValues,
      default: 'pending',
      index: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    auditTrail: {
      type: [helpDeskAuditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

helpDeskRequestSchema.index({ organization: 1, requestedBy: 1, createdAt: -1 });
helpDeskRequestSchema.index({ organization: 1, assignedToUser: 1, status: 1, createdAt: -1 });
helpDeskRequestSchema.index({ organization: 1, status: 1, createdAt: -1 });

export type HelpDeskRequest = any;

export const HelpDeskRequestModel = model<any>('HelpDeskRequest', helpDeskRequestSchema);
