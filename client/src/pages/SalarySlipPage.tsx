import { useState } from 'react';
import { formatINR, numberToWords } from '../utils/currencyUtils';
import { mockEarnings, mockDeductions, mockEmployee } from '../utils/mockData';

const months = [
  'Jan-2026', 'Dec-2025', 'Nov-2025', 'Oct-2025', 'Sep-2025',
  'Aug-2025', 'Jul-2025', 'Jun-2025', 'May-2025', 'Apr-2025',
];

export const SalarySlipPage = (): JSX.Element => {
  const [selectedMonth, setSelectedMonth] = useState('Jan-2026');

  const grossEarning = mockEarnings.reduce((s, e) => s + e.monthly, 0);
  const totalDeductions = mockDeductions.reduce((s, d) => s + d.monthly, 0);
  const netSalary = grossEarning - totalDeductions;

  const handlePrint = (): void => {
    window.print();
  };

  return (
    <div className="slip-page">
      {/* Controls */}
      <div className="slip-controls">
        <div className="slip-select-group">
          <label>Select Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="slip-actions">
          <button type="button" className="ess-btn ess-btn--primary" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button type="button" className="ess-btn ess-btn--danger">
            📥 Download PDF
          </button>
        </div>
      </div>

      {/* Salary Slip Document */}
      <div className="slip-document" id="salary-slip">
        {/* Company Header */}
        <div className="slip-company-header">
          <div className="slip-logo">
            <div className="slip-logo-circle">Q</div>
          </div>
          <div className="slip-company-info">
            <h2>Salary Slip for {selectedMonth}</h2>
            <p>Quelstring Technologies Pvt. Ltd.</p>
            <small>Noida, Uttar Pradesh, India</small>
          </div>
        </div>

        {/* Employee Details */}
        <div className="slip-emp-grid">
          <div className="slip-emp-col">
            <div className="slip-emp-row">
              <span>Emp. Code</span>
              <strong>{mockEmployee.code}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Name</span>
              <strong>{mockEmployee.name}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Designation</span>
              <strong>{mockEmployee.designation}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Department</span>
              <strong>{mockEmployee.department}</strong>
            </div>
            <div className="slip-emp-row">
              <span>DOJ</span>
              <strong>{mockEmployee.doj}</strong>
            </div>
          </div>
          <div className="slip-emp-col">
            <div className="slip-emp-row">
              <span>Paid Days</span>
              <strong>{mockEmployee.paidDays}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Arrear Days</span>
              <strong>{mockEmployee.arrearDays || '–'}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Bank Name</span>
              <strong>{mockEmployee.bankName}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Bank A/c No.</span>
              <strong>{mockEmployee.bankAcNo}</strong>
            </div>
            <div className="slip-emp-row">
              <span>PAN No.</span>
              <strong>{mockEmployee.panNo}</strong>
            </div>
            <div className="slip-emp-row">
              <span>Aadhaar No.</span>
              <strong>{mockEmployee.aadhaarNo}</strong>
            </div>
          </div>
        </div>

        {/* Salary Breakdown */}
        <div className="slip-salary-grid">
          {/* Earnings */}
          <div className="slip-salary-col">
            <div className="slip-col-header">Earnings in Rs.</div>
            <table className="slip-table">
              <tbody>
                {mockEarnings.map((e) => (
                  <tr key={e.head}>
                    <td>{e.head}</td>
                    <td className="slip-amount">{formatINR(e.monthly)}</td>
                  </tr>
                ))}
                <tr className="slip-total-row">
                  <td><strong>GROSS EARNING</strong></td>
                  <td className="slip-amount"><strong>{formatINR(grossEarning)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Deductions */}
          <div className="slip-salary-col">
            <div className="slip-col-header slip-col-header--ded">Deductions &amp; Amount Rs.</div>
            <table className="slip-table">
              <tbody>
                {mockDeductions.map((d) => (
                  <tr key={d.head}>
                    <td>{d.head}</td>
                    <td className="slip-amount">{formatINR(d.monthly)}</td>
                  </tr>
                ))}
                {mockDeductions.length === 0 && (
                  <tr>
                    <td colSpan={2} className="slip-empty">No deductions</td>
                  </tr>
                )}
                <tr className="slip-total-row">
                  <td><strong>TOTAL DEDUCTIONS</strong></td>
                  <td className="slip-amount"><strong>{formatINR(totalDeductions)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Net Salary */}
        <div className="slip-net-section">
          <div className="slip-net-row">
            <span>Gross Earning</span>
            <span>{formatINR(grossEarning)}</span>
          </div>
          <div className="slip-net-row">
            <span>Total Deductions</span>
            <span>– {formatINR(totalDeductions)}</span>
          </div>
          <div className="slip-net-row slip-net-row--highlight">
            <span>Net Salary</span>
            <span>{formatINR(netSalary)}</span>
          </div>
          <p className="slip-words">{numberToWords(netSalary)}</p>
        </div>

        {/* Footer */}
        <div className="slip-footer">
          <p>Remarks: {mockEmployee.name}</p>
          <small>This is a computer generated payslip and does not require any signature.</small>
        </div>
      </div>
    </div>
  );
};
