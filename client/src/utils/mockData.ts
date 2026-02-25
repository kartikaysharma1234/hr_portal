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
  code: 'EMP-2024-0847',
  name: 'Aman Sharma',
  designation: 'Software Engineer',
  department: 'Engineering',
  doj: '15-Mar-2024',
  paidDays: 26,
  arrearDays: 0,
  bankName: 'HDFC Bank',
  bankAcNo: '50100XXXXXX789',
  panNo: 'ABCPS1234K',
  aadhaarNo: 'XXXX XXXX 3490',
};

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
