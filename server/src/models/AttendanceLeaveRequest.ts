import { Schema, model } from 'mongoose';

const leaveRequestStatusValues = ['pending', 'submitted', 'approved', 'rejected', 'cancelled'] as const;
const leaveRequestTypeValues = [
  'CL',
  'HCL',
  'HPL',
  'PL',
  'HSL',
  'SL',
  'COF',
  'HCO',
  'HOD',
  'OD',
  'OH',
  'HWFH',
  'WFH',
  'SPL'
] as const;
const leaveDurationValues = ['full_day', 'first_half', 'second_half'] as const;

const leaveRequestAuditSchema = new Schema(
  {
    action: {
      type: String,
      enum: ['created', 'saved', 'submitted', 'approved', 'rejected', 'cancelled'],
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

const attendanceLeaveRequestSchema = new Schema(
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
    approverUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    leaveType: {
      type: String,
      enum: leaveRequestTypeValues,
      required: true
    },
    durationType: {
      type: String,
      enum: leaveDurationValues,
      default: 'full_day'
    },
    fromDate: {
      type: String,
      required: true
    },
    toDate: {
      type: String,
      required: true
    },
    noOfDays: {
      type: Number,
      min: 0.5,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2000
    },
    workLocation: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: leaveRequestStatusValues,
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
      type: [leaveRequestAuditSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

attendanceLeaveRequestSchema.index({ organization: 1, requestedBy: 1, createdAt: -1 });
attendanceLeaveRequestSchema.index({ organization: 1, approverUser: 1, status: 1, createdAt: -1 });
attendanceLeaveRequestSchema.index({ organization: 1, employee: 1, fromDate: 1, toDate: 1, status: 1 });

export type AttendanceLeaveRequest = any;

export const AttendanceLeaveRequestModel = model<any>(
  'AttendanceLeaveRequest',
  attendanceLeaveRequestSchema
);
