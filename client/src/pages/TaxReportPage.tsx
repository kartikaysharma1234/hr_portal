import { useState } from 'react';
import { formatINR } from '../utils/currencyUtils';
import { mockTaxMonths } from '../utils/mockData';

const monthOptions = [
  'Jan-2026','Dec-2025','Nov-2025','Oct-2025','Sep-2025',
  'Aug-2025','Jul-2025','Jun-2025','May-2025','Apr-2025',
];

// Tax slabs — New Regime FY 2025-26
interface TaxSlab { from: number; to: number; rate: number }
const newRegimeSlabs: TaxSlab[] = [
  { from: 0, to: 300000, rate: 0 },
  { from: 300000, to: 700000, rate: 5 },
  { from: 700000, to: 1000000, rate: 10 },
  { from: 1000000, to: 1200000, rate: 15 },
  { from: 1200000, to: 1500000, rate: 20 },
  { from: 1500000, to: Infinity, rate: 30 },
];
const oldRegimeSlabs: TaxSlab[] = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 5 },
  { from: 500000, to: 1000000, rate: 20 },
  { from: 1000000, to: Infinity, rate: 30 },
];

const calcTax = (income: number, slabs: TaxSlab[]): number => {
  let tax = 0;
  for (const slab of slabs) {
    if (income <= slab.from) break;
    const taxable = Math.min(income, slab.to) - slab.from;
    tax += taxable * (slab.rate / 100);
  }
  return tax;
};

export const TaxReportPage = (): JSX.Element => {
  const [selectedMonth, setSelectedMonth] = useState('Jan-2026');
  const [activeRegime, setActiveRegime] = useState<'new' | 'old'>('new');

  const ytdGross = mockTaxMonths.reduce((s, m) => s + m.grossSalary, 0);
  const ytdTds = mockTaxMonths.reduce((s, m) => s + m.tdsDeducted, 0);
  const projectedAnnualIncome = ytdGross * (12 / mockTaxMonths.length);
  const deductions80C = 150000;
  const standardDeduction = 75000;

  const taxableNew = Math.max(0, projectedAnnualIncome - standardDeduction);
  const taxableOld = Math.max(0, projectedAnnualIncome - standardDeduction - deductions80C);
  const taxNew = calcTax(taxableNew, newRegimeSlabs);
  const taxOld = calcTax(taxableOld, oldRegimeSlabs);
  const cessNew = taxNew * 0.04;
  const cessOld = taxOld * 0.04;
  const totalNew = taxNew + cessNew;
  const totalOld = taxOld + cessOld;

  const activeTax = activeRegime === 'new' ? totalNew : totalOld;
  const activeTaxable = activeRegime === 'new' ? taxableNew : taxableOld;

  return (
    <div className="taxr-page">
      {/* Breadcrumb */}
      <div className="ess-breadcrumb">
        <span>My Links</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">My Tax Report</span>
      </div>

      {/* Controls */}
      <div className="taxr-controls">
        <div className="ctc-select-group">
          <label>Month</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {monthOptions.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="taxr-downloads">
          <button type="button" className="ess-btn ess-btn--glass">📥 PDF</button>
          <button type="button" className="ess-btn ess-btn--glass">📊 Excel</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="taxr-summary">
        <div className="taxr-card taxr-card--tds">
          <small>Current Month TDS</small>
          <strong>{formatINR(mockTaxMonths[0]?.tdsDeducted ?? 0)}</strong>
        </div>
        <div className="taxr-card taxr-card--ytd">
          <small>YTD Tax Paid</small>
          <strong>{formatINR(ytdTds)}</strong>
        </div>
        <div className="taxr-card taxr-card--projected">
          <small>Projected Annual Tax</small>
          <strong>{formatINR(activeTax)}</strong>
        </div>
        <div className="taxr-card taxr-card--regime">
          <small>Tax Regime</small>
          <div className="taxr-regime-toggle">
            <button
              type="button"
              className={activeRegime === 'new' ? 'taxr-regime--active' : ''}
              onClick={() => setActiveRegime('new')}
            >New</button>
            <button
              type="button"
              className={activeRegime === 'old' ? 'taxr-regime--active' : ''}
              onClick={() => setActiveRegime('old')}
            >Old</button>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="ess-section">
        <h3 className="ess-section-title">Monthly Breakdown</h3>
        <div className="ess-table-wrap">
          <table className="ess-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Gross Salary</th>
                <th>Taxable Income</th>
                <th>Tax Calculated</th>
                <th>TDS Deducted</th>
                <th>Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {mockTaxMonths.map((row) => (
                <tr key={row.month}>
                  <td><strong>{row.month}</strong></td>
                  <td className="ctc-amount">{formatINR(row.grossSalary)}</td>
                  <td className="ctc-amount">{formatINR(row.taxableIncome)}</td>
                  <td className="ctc-amount">{formatINR(row.taxCalculated)}</td>
                  <td className="ctc-amount">{formatINR(row.tdsDeducted)}</td>
                  <td className="ctc-amount">{formatINR(row.netPayable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Calculation Sheet */}
      <div className="ess-section">
        <h3 className="ess-section-title">Tax Calculation Sheet ({activeRegime === 'new' ? 'New' : 'Old'} Regime)</h3>
        <div className="taxr-calc-card">
          <div className="taxr-calc-row">
            <span>Projected Gross Income</span>
            <span>{formatINR(projectedAnnualIncome)}</span>
          </div>
          <div className="taxr-calc-row">
            <span>Standard Deduction</span>
            <span>– {formatINR(standardDeduction)}</span>
          </div>
          {activeRegime === 'old' && (
            <div className="taxr-calc-row">
              <span>Section 80C Deductions</span>
              <span>– {formatINR(deductions80C)}</span>
            </div>
          )}
          <div className="taxr-calc-row taxr-calc-row--highlight">
            <span>Total Taxable Income</span>
            <span>{formatINR(activeTaxable)}</span>
          </div>

          <div className="taxr-slab-header">Tax Slabs</div>
          {(activeRegime === 'new' ? newRegimeSlabs : oldRegimeSlabs).map((slab, i) => (
            <div key={i} className="taxr-calc-row taxr-calc-row--slab">
              <span>
                {formatINR(slab.from)} – {slab.to === Infinity ? 'Above' : formatINR(slab.to)}
              </span>
              <span>{slab.rate}%</span>
            </div>
          ))}

          <div className="taxr-calc-row">
            <span>Tax on Total Income</span>
            <span>{formatINR(activeRegime === 'new' ? taxNew : taxOld)}</span>
          </div>
          <div className="taxr-calc-row">
            <span>Health &amp; Education Cess (4%)</span>
            <span>{formatINR(activeRegime === 'new' ? cessNew : cessOld)}</span>
          </div>
          <div className="taxr-calc-row taxr-calc-row--total">
            <span>Total Tax Liability</span>
            <span>{formatINR(activeTax)}</span>
          </div>
          <div className="taxr-calc-row">
            <span>TDS Already Deducted (YTD)</span>
            <span>– {formatINR(ytdTds)}</span>
          </div>
          <div className={`taxr-calc-row taxr-calc-row--final ${activeTax - ytdTds > 0 ? 'taxr-payable' : 'taxr-refund'}`}>
            <span>{activeTax - ytdTds > 0 ? 'Tax Payable' : 'Tax Refundable'}</span>
            <span>{formatINR(Math.abs(activeTax - ytdTds))}</span>
          </div>
        </div>
      </div>

      {/* Regime Comparison */}
      <div className="ess-section">
        <h3 className="ess-section-title">Old vs New Regime Comparison</h3>
        <div className="taxr-comparison">
          <div className={`taxr-compare-card ${activeRegime === 'new' ? 'taxr-compare--selected' : ''}`}>
            <span className="taxr-compare-label">New Regime</span>
            <strong>{formatINR(totalNew)}</strong>
            {totalNew <= totalOld && <span className="taxr-recommend">✨ Recommended</span>}
          </div>
          <div className="taxr-compare-vs">VS</div>
          <div className={`taxr-compare-card ${activeRegime === 'old' ? 'taxr-compare--selected' : ''}`}>
            <span className="taxr-compare-label">Old Regime</span>
            <strong>{formatINR(totalOld)}</strong>
            {totalOld < totalNew && <span className="taxr-recommend">✨ Recommended</span>}
          </div>
        </div>
        <p className="taxr-savings">
          You save <strong>{formatINR(Math.abs(totalNew - totalOld))}</strong> with the {totalNew <= totalOld ? 'New' : 'Old'} Regime
        </p>
      </div>
    </div>
  );
};
