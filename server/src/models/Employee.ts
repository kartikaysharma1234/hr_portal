import { Schema, model, type InferSchemaType } from 'mongoose';

const employeeStatusValues = ['active', 'inactive', 'terminated'] as const;
const employmentTypeValues = ['full_time', 'part_time', 'contract', 'intern'] as const;

const employeeSchema = new Schema(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    employeeCode: {
      type: String,
      required: true,
      trim: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    workEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    designation: {
      type: String,
      trim: true,
      default: ''
    },
    dateOfJoining: {
      type: Date,
      required: true
    },
    employmentType: {
      type: String,
      enum: employmentTypeValues,
      default: 'full_time'
    },
    status: {
      type: String,
      enum: employeeStatusValues,
      default: 'active'
    },
    managerUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

employeeSchema.index({ organization: 1, employeeCode: 1 }, { unique: true });
employeeSchema.index({ organization: 1, workEmail: 1 }, { unique: true });
employeeSchema.index({ organization: 1, status: 1 });

export type Employee = InferSchemaType<typeof employeeSchema>;
export type EmployeeStatus = Employee['status'];
export type EmploymentType = Employee['employmentType'];

export const EmployeeModel = model<Employee>('Employee', employeeSchema);
