/* ----- Attendance Mock Data ----- */
export interface AttendanceRow {
  date: string;
  day: string;
  inTime: string;
  outTime: string;
  workingHours: string;
  status: 'P' | 'A' | 'WO' | 'H' | 'L';
  lateComing: string;
  earlyGoing: string;
}

export const mockAttendance: AttendanceRow[] = [
  { date: '25-Feb-2026', day: 'Wed', inTime: '09:10', outTime: '--:--', workingHours: '--', status: 'P', lateComing: '00:10', earlyGoing: '--' },
  { date: '24-Feb-2026', day: 'Tue', inTime: '09:02', outTime: '18:15', workingHours: '09:13', status: 'P', lateComing: '--', earlyGoing: '--' },
  { date: '23-Feb-2026', day: 'Mon', inTime: '09:00', outTime: '18:00', workingHours: '09:00', status: 'P', lateComing: '--', earlyGoing: '--' },
  { date: '22-Feb-2026', day: 'Sun', inTime: '--', outTime: '--', workingHours: '--', status: 'WO', lateComing: '--', earlyGoing: '--' },
  { date: '21-Feb-2026', day: 'Sat', inTime: '--', outTime: '--', workingHours: '--', status: 'WO', lateComing: '--', earlyGoing: '--' },
  { date: '20-Feb-2026', day: 'Fri', inTime: '08:55', outTime: '18:10', workingHours: '09:15', status: 'P', lateComing: '--', earlyGoing: '--' },
  { date: '19-Feb-2026', day: 'Thu', inTime: '09:05', outTime: '18:00', workingHours: '08:55', status: 'P', lateComing: '00:05', earlyGoing: '--' },
  { date: '18-Feb-2026', day: 'Wed', inTime: '09:00', outTime: '17:30', workingHours: '08:30', status: 'P', lateComing: '--', earlyGoing: '00:30' },
  { date: '17-Feb-2026', day: 'Tue', inTime: '09:00', outTime: '18:00', workingHours: '09:00', status: 'P', lateComing: '--', earlyGoing: '--' },
  { date: '16-Feb-2026', day: 'Mon', inTime: '--', outTime: '--', workingHours: '--', status: 'A', lateComing: '--', earlyGoing: '--' },
];

/* ----- CTC / Salary Mock Data ----- */
export interface SalaryComponent {
  head: string;
  monthly: number;
  yearly: number;
  frequency: 'Monthly' | 'Yearly';
}

export const mockEarnings: SalaryComponent[] = [
  { head: 'Basic', monthly: 10625, yearly: 127500, frequency: 'Monthly' },
  { head: 'H.R.A.', monthly: 4250, yearly: 51000, frequency: 'Monthly' },
  { head: 'Other Allowance', monthly: 5375, yearly: 64500, frequency: 'Monthly' },
  { head: 'Conveyance', monthly: 1600, yearly: 19200, frequency: 'Monthly' },
];

export const mockAdditionalEarnings: SalaryComponent[] = [
  { head: 'Incentive Pay', monthly: 3150, yearly: 37800, frequency: 'Monthly' },
];

export const mockDeductions: SalaryComponent[] = [
  { head: 'Provident Fund (PF)', monthly: 1800, yearly: 21600, frequency: 'Monthly' },
  { head: 'Professional Tax', monthly: 200, yearly: 2400, frequency: 'Monthly' },
];

/* ----- Employee Details Mock Data ----- */
export const mockEmployee = {
  code: 'SS-352',
  name: 'Kartikay Sharma',
  designation: 'Trainee Engineer',
  department: 'Full Stack Development',
  doj: '01-Jan-2025',
  paidDays: 26,
  arrearDays: 0,
  bankName: 'HDFC Bank',
  bankAcNo: '50100XXXXXX789',
  panNo: 'ABCPS1234K',
  aadhaarNo: 'XXXX XXXX 3490',
};

/* ----- Employee Profile / Company Details Mock Data ----- */
export const mockEmployeeProfile = {
  workingFor: 'Opositive Communication Pvt Ltd',
  workLocation: 'Delhi OP',
  department: 'Full Stack Development',
  designation: 'Trainee Engineer',
  grade: 'General',
  weeklyOff: 'Sunday',
  secondWeeklyOff: 'Saturday',
  weeklyOffWeekWise: '1,0,1,0,1',
  shift: 'Shift 2 09:30-18:00 ( 09:30 - 18:00 )',
  eType: 'STAFF',
  dateOfJoining: '01-Jan-2025',
  groupEcode: 'SS-352',
  groupDOJ: '01-Jul-2024',
  tenure: '1.2 Yrs',
  officeEmail: 'kartikay.sharma@sequelstring.com',
  confirmationDueDate: '31 Mar 2025',
  confirmationDate: '31-Mar-2025',
  reportingTo: 'Mrityunjay Kumar (SS-270)',
  financeMgr: 'Vinay Mange (SS-439)',
  noticePeriod: '90',
  costCenter: '',
};

/* ----- Personal Profile Mock Data ----- */
export interface PersonalField {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'select' | 'textarea' | 'date';
  required: boolean;
  editable: boolean;       // can employee amend?
  adminOnly: boolean;      // admin-managed (read-only for employee)?
  options?: string[];
  pendingValue?: string;   // if amended but not yet approved
}

export const mockPersonalFields: PersonalField[] = [
  { key: 'title', label: 'Title', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'firstName', label: 'First Name', value: 'Kartikay', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'middleName', label: 'Middle Name', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'lastName', label: 'Last Name', value: 'Sharma', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'gender', label: 'Gender', value: 'Male', type: 'select', required: true, editable: true, adminOnly: false, options: ['Male', 'Female', 'Other'] },
  { key: 'dob', label: 'Date of Birth', value: '04-Dec-2001', type: 'date', required: true, editable: true, adminOnly: false },
  { key: 'caste', label: 'Caste', value: '', type: 'select', required: false, editable: true, adminOnly: false, options: ['Select Caste', 'General', 'OBC', 'SC', 'ST'] },
  { key: 'personalEmail', label: 'Personal Email', value: 'kartikaysharma99999@gmail.com', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'currentAddress', label: 'Current Address', value: 'himalayan pg, Ghitorni, New Delhi, Delhi 110030', type: 'textarea', required: true, editable: true, adminOnly: false },
  { key: 'country', label: 'Country', value: 'India', type: 'select', required: true, editable: false, adminOnly: true, options: ['India'] },
  { key: 'state', label: 'State', value: 'Delhi', type: 'select', required: true, editable: false, adminOnly: true, options: ['Delhi', 'UP', 'Haryana'] },
  { key: 'cityDistrict', label: 'City/District', value: 'Delhi', type: 'select', required: true, editable: false, adminOnly: true, options: ['Delhi', 'New Delhi'] },
  { key: 'pinCode', label: 'Pin Code/Post Code/Zip Code', value: '110030', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'permanentAddress', label: 'Permanent Address', value: '5/3074/10/1, gali no 4 laxmi dham colony new madho nagar saharanpur -247001', type: 'textarea', required: true, editable: true, adminOnly: false },
  { key: 'alternateNo', label: 'Alternate No.', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'guardianName', label: 'Guardian Name', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'emergencyContact', label: 'Emergency Contact Person', value: 'Ram Vinay Sharma', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'emergencyNo', label: 'Emergency No.', value: '9411038585', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'mobileNo', label: 'Mobile No.', value: '8445424406', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'officeMobileNo', label: 'Office Mobile No.', value: '', type: 'text', required: false, editable: false, adminOnly: true },
  { key: 'officeLandlineNo', label: 'Office Landline No.', value: '', type: 'text', required: false, editable: false, adminOnly: true },
  { key: 'refferedBy', label: 'Reffered By', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'bloodGroup', label: 'Blood Group', value: 'O+', type: 'select', required: true, editable: true, adminOnly: false, options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
  { key: 'panNo', label: 'PAN No.', value: 'NVZPS8211Q', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'aadhaarUid', label: 'Aadhaar/UID', value: '519399433490', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'panAadhaarLink', label: 'PAN Aadhaar Link', value: 'Yes', type: 'select', required: true, editable: false, adminOnly: true, options: ['Yes', 'No'] },
  { key: 'pfUanNo', label: 'PF UAN No.', value: '', type: 'text', required: true, editable: true, adminOnly: false },
  { key: 'maritalStatus', label: 'Marital Status', value: 'Single', type: 'select', required: false, editable: true, adminOnly: false, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
  { key: 'weddingDate', label: 'Wedding Date', value: '', type: 'date', required: false, editable: true, adminOnly: false },
  { key: 'insuranceCardNo', label: 'Insurance Card No', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'healthIdCardNo', label: 'Health ID Card No', value: '', type: 'text', required: false, editable: true, adminOnly: false },
  { key: 'medicalCondition', label: 'Medical Condition Detail', value: '', type: 'textarea', required: false, editable: true, adminOnly: false },
];

/* ----- Family Mock Data ----- */
export interface FamilyMember {
  srNo: number;
  memberName: string;
  relation: string;
  dob: string;
  occupation: string;
  contactNo: string;
  aadhaarNo: string;
  pfNomination: number;
  gratuityNomination: number;
  esicNomination: number;
  coveredInEsic: 'Y' | 'N';
  coveredMediclaim: 'Y' | 'N';
  address: string;
}

export const mockFamilyMembers: FamilyMember[] = [
  {
    srNo: 1, memberName: 'Rajantee Sharma', relation: 'Mother', dob: '01 Jan 1974',
    occupation: '', contactNo: '', aadhaarNo: '', pfNomination: 0, gratuityNomination: 0,
    esicNomination: 0, coveredInEsic: 'N', coveredMediclaim: 'N', address: '',
  },
  {
    srNo: 2, memberName: 'Ram Vinay Sharma', relation: 'Father', dob: '10 Mar 1965',
    occupation: '', contactNo: '', aadhaarNo: '', pfNomination: 0, gratuityNomination: 0,
    esicNomination: 0, coveredInEsic: 'N', coveredMediclaim: 'N', address: '',
  },
];

/* ----- Tax Declaration Mock Data ----- */
export interface TaxSection {
  id: string;
  name: string;
  maxLimit: number;
  declared: number;
  items: { type: string; amount: number; proofUploaded: boolean; status: 'Pending' | 'Approved' | 'Rejected' }[];
}

export const mockTaxSections: TaxSection[] = [
  {
    id: '80c',
    name: 'Section 80C',
    maxLimit: 150000,
    declared: 85000,
    items: [
      { type: 'PPF', amount: 50000, proofUploaded: true, status: 'Approved' },
      { type: 'ELSS Mutual Fund', amount: 35000, proofUploaded: false, status: 'Pending' },
    ],
  },
  {
    id: '80d',
    name: 'Section 80D (Medical Insurance)',
    maxLimit: 75000,
    declared: 25000,
    items: [
      { type: 'Self & Family Premium', amount: 25000, proofUploaded: true, status: 'Approved' },
    ],
  },
  {
    id: '80e',
    name: 'Section 80E (Education Loan)',
    maxLimit: 0,
    declared: 0,
    items: [],
  },
  {
    id: 'sec24',
    name: 'Section 24 (Home Loan Interest)',
    maxLimit: 200000,
    declared: 0,
    items: [],
  },
];

/* ----- Tax Report Mock Data ----- */
export interface TaxMonthRow {
  month: string;
  grossSalary: number;
  taxableIncome: number;
  taxCalculated: number;
  tdsDeducted: number;
  netPayable: number;
}

export const mockTaxMonths: TaxMonthRow[] = [
  { month: 'Apr-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'May-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Jun-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Jul-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Aug-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Sep-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Oct-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Nov-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Dec-2025', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
  { month: 'Jan-2026', grossSalary: 25000, taxableIncome: 21000, taxCalculated: 1050, tdsDeducted: 1050, netPayable: 23950 },
];

export const mockHolidays = [
  { date: '26-Jan-2026', name: 'Republic Day' },
  { date: '14-Mar-2026', name: 'Holi' },
  { date: '02-Apr-2026', name: 'Good Friday' },
  { date: '15-Aug-2026', name: 'Independence Day' },
  { date: '02-Oct-2026', name: 'Gandhi Jayanti' },
  { date: '20-Oct-2026', name: 'Dussehra' },
  { date: '09-Nov-2026', name: 'Diwali' },
  { date: '25-Dec-2026', name: 'Christmas' },
];
