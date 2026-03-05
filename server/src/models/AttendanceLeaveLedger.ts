import { Schema, model } from 'mongoose';

const leaveTypeValues = ['PL', 'CL', 'SL', 'OH'] as const;

const monthlyLedgerSchema = new Schema(
  {
    month: {
      type: Number,
      min: 1,
      max: 12,
      required: true
    },
    days: {
      type: Number,
      min: 28,
      max: 31,
      required: true
    },
    credit: {
      type: Number,
      default: 0
    },
    availed: {
      type: Number,
      default: 0
    },
    availedDates: {
      type: [Date],
      default: []
    }
  },
  {
    _id: false
  }
);

const attendanceLeaveLedgerSchema = new Schema(
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
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
      index: true
    },
    leaveType: {
      type: String,
      enum: leaveTypeValues,
      required: true,
      index: true
    },
    openingBalance: {
      type: Number,
      default: 0
    },
    openingBalanceDate: {
      type: Date,
      required: true
    },
    monthly: {
      type: [monthlyLedgerSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

attendanceLeaveLedgerSchema.index(
  { organization: 1, employee: 1, year: 1, leaveType: 1 },
  { unique: true }
);

export type AttendanceLeaveLedger = any;

export const AttendanceLeaveLedgerModel = model<any>(
  'AttendanceLeaveLedger',
  attendanceLeaveLedgerSchema
);
