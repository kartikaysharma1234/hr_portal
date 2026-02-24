import type { Request, Response } from 'express';
import createHttpError from 'http-errors';

import {
  EmployeeModel,
  type EmployeeStatus,
  type EmploymentType
} from '../models/Employee';
import { asyncHandler } from '../utils/asyncHandler';

const employeeStatusValues: EmployeeStatus[] = ['active', 'inactive', 'terminated'];
const employmentTypeValues: EmploymentType[] = ['full_time', 'part_time', 'contract', 'intern'];

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseDateField = (rawValue: unknown, fieldName: string): Date => {
  const date = new Date(String(rawValue));
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} is invalid`);
  }

  return date;
};

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '').trim();
  const department = String(req.query.department ?? '').trim();

  const filters: Record<string, unknown> = {
    organization: req.tenant.organizationId
  };

  if (status) {
    if (!employeeStatusValues.includes(status as EmployeeStatus)) {
      throw createHttpError(400, 'status must be active, inactive or terminated');
    }

    filters.status = status;
  }

  if (department) {
    filters.department = department;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filters.$or = [
      { firstName: regex },
      { lastName: regex },
      { employeeCode: regex },
      { workEmail: regex }
    ];
  }

  const [items, total] = await Promise.all([
    EmployeeModel.find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    EmployeeModel.countDocuments(filters)
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    }
  });
});

export const getEmployeeById = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const employee = await EmployeeModel.findOne({
    _id: req.params.id,
    organization: req.tenant.organizationId
  }).lean();

  if (!employee) {
    throw createHttpError(404, 'Employee not found');
  }

  res.json({
    success: true,
    data: employee
  });
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const employeeCode = String(req.body.employeeCode ?? '').trim();
  const firstName = String(req.body.firstName ?? '').trim();
  const lastName = String(req.body.lastName ?? '').trim();
  const workEmail = String(req.body.workEmail ?? '').trim().toLowerCase();
  const dateOfJoiningRaw = req.body.dateOfJoining;
  const phone = String(req.body.phone ?? '').trim();
  const department = String(req.body.department ?? '').trim();
  const designation = String(req.body.designation ?? '').trim();
  const status = String(req.body.status ?? 'active').trim() as EmployeeStatus;
  const employmentType = String(req.body.employmentType ?? 'full_time').trim() as EmploymentType;
  const managerUser = req.body.managerUser ?? null;

  if (!employeeCode || !firstName || !lastName || !workEmail || !dateOfJoiningRaw) {
    throw createHttpError(
      400,
      'employeeCode, firstName, lastName, workEmail and dateOfJoining are required'
    );
  }

  if (!employeeStatusValues.includes(status)) {
    throw createHttpError(400, 'status must be active, inactive or terminated');
  }

  if (!employmentTypeValues.includes(employmentType)) {
    throw createHttpError(400, 'employmentType must be full_time, part_time, contract or intern');
  }

  const dateOfJoining = parseDateField(dateOfJoiningRaw, 'dateOfJoining');

  const duplicateEmployee = await EmployeeModel.findOne({
    organization: req.tenant.organizationId,
    $or: [{ employeeCode }, { workEmail }]
  }).lean();

  if (duplicateEmployee) {
    throw createHttpError(409, 'employeeCode or workEmail already exists in this tenant');
  }

  const employee = await EmployeeModel.create({
    organization: req.tenant.organizationId,
    employeeCode,
    firstName,
    lastName,
    workEmail,
    dateOfJoining,
    phone,
    department,
    designation,
    status,
    employmentType,
    managerUser,
    createdBy: req.user?.sub ?? null
  });

  res.status(201).json({
    success: true,
    data: employee
  });
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const employee = await EmployeeModel.findOne({
    _id: req.params.id,
    organization: req.tenant.organizationId
  }).exec();

  if (!employee) {
    throw createHttpError(404, 'Employee not found');
  }

  const nextEmployeeCode = req.body.employeeCode
    ? String(req.body.employeeCode).trim()
    : employee.employeeCode;
  const nextWorkEmail = req.body.workEmail
    ? String(req.body.workEmail).trim().toLowerCase()
    : employee.workEmail;

  const hasIdentityChange =
    nextEmployeeCode !== employee.employeeCode || nextWorkEmail !== employee.workEmail;

  if (hasIdentityChange) {
    const duplicateEmployee = await EmployeeModel.findOne({
      _id: { $ne: employee._id },
      organization: req.tenant.organizationId,
      $or: [{ employeeCode: nextEmployeeCode }, { workEmail: nextWorkEmail }]
    }).lean();

    if (duplicateEmployee) {
      throw createHttpError(409, 'employeeCode or workEmail already exists in this tenant');
    }
  }

  if (req.body.employeeCode !== undefined) {
    employee.employeeCode = nextEmployeeCode;
  }

  if (req.body.firstName !== undefined) {
    employee.firstName = String(req.body.firstName).trim();
  }

  if (req.body.lastName !== undefined) {
    employee.lastName = String(req.body.lastName).trim();
  }

  if (req.body.workEmail !== undefined) {
    employee.workEmail = nextWorkEmail;
  }

  if (req.body.phone !== undefined) {
    employee.phone = String(req.body.phone).trim();
  }

  if (req.body.department !== undefined) {
    employee.department = String(req.body.department).trim();
  }

  if (req.body.designation !== undefined) {
    employee.designation = String(req.body.designation).trim();
  }

  if (req.body.status !== undefined) {
    const nextStatus = String(req.body.status).trim() as EmployeeStatus;
    if (!employeeStatusValues.includes(nextStatus)) {
      throw createHttpError(400, 'status must be active, inactive or terminated');
    }
    employee.status = nextStatus;
  }

  if (req.body.employmentType !== undefined) {
    const nextEmploymentType = String(req.body.employmentType).trim() as EmploymentType;
    if (!employmentTypeValues.includes(nextEmploymentType)) {
      throw createHttpError(
        400,
        'employmentType must be full_time, part_time, contract or intern'
      );
    }
    employee.employmentType = nextEmploymentType;
  }

  if (req.body.dateOfJoining !== undefined) {
    employee.dateOfJoining = parseDateField(req.body.dateOfJoining, 'dateOfJoining');
  }

  if (req.body.managerUser !== undefined) {
    employee.managerUser = req.body.managerUser ?? null;
  }

  await employee.save();

  res.json({
    success: true,
    data: employee
  });
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenant) {
    throw createHttpError(400, 'Tenant context is required');
  }

  const deletedEmployee = await EmployeeModel.findOneAndDelete({
    _id: req.params.id,
    organization: req.tenant.organizationId
  }).lean();

  if (!deletedEmployee) {
    throw createHttpError(404, 'Employee not found');
  }

  res.json({
    success: true,
    message: 'Employee deleted successfully'
  });
});
