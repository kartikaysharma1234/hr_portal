import { useState } from 'react';
import { formatINR } from '../utils/currencyUtils';
import { mockEarnings, mockAdditionalEarnings, mockDeductions } from '../utils/mockData';

export const CtcBreakdownPage = (): JSX.Element => {
  const [effectiveFrom] = useState('Jan-2026');
  const [disbursementFrom] = useState('Jan-2026');

  const grossMonthly = mockEarnings.reduce((s, e) => s + e.monthly, 0);
  const grossYearly = mockEarnings.reduce((s, e) => s + e.yearly, 0);
  const addMonthly = mockAdditionalEarnings.reduce((s, e) => s + e.monthly, 0);
  const addYearly = mockAdditionalEarnings.reduce((s, e) => s + e.yearly, 0);
  const ctcMonthly = grossMonthly + addMonthly;
  const ctcYearly = grossYearly + addYearly;
  const dedMonthly = mockDeductions.reduce((s, e) => s + e.monthly, 0);
  const dedYearly = mockDeductions.reduce((s, e) => s + e.yearly, 0);
  const inHandMonthly = ctcMonthly - dedMonthly;
  const inHandYearly = ctcYearly - dedYearly;

  return (
    <div className="ctc-page">
      {/* Breadcrumb */}
      <div className="ess-breadcrumb">
        <span>My Links</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">My CTC</span>
      </div>

      {/* Controls */}
      <div className="ctc-controls">
        <div className="ctc-selectors">
          <div className="ctc-select-group">
            <label>Effective From</label>
            <select value={effectiveFrom} disabled>
              <option>Jan-2026</option>
            </select>
          </div>
          <div className="ctc-select-group">
            <label>Disbursement From</label>
            <select value={disbursementFrom} disabled>
              <option>Jan-2026</option>
            </select>
          </div>
        </div>
        <button type="button" className="ess-btn ess-btn--glass">CTC History</button>
      </div>

      {/* CTC Summary Cards */}
      <div className="ctc-summary-cards">
        <div className="ctc-summary-card ctc-summary--gross">
          <small>Monthly Gross</small>
          <strong>{formatINR(grossMonthly)}</strong>
        </div>
        <div className="ctc-summary-card ctc-summary--ctc">
          <small>Annual CTC</small>
          <strong>{formatINR(ctcYearly)}</strong>
        </div>
        <div className="ctc-summary-card ctc-summary--inhand">
          <small>Monthly In-Hand</small>
          <strong>{formatINR(inHandMonthly)}</strong>
        </div>
      </div>

      {/* Earnings Table */}
      <div className="ctc-table-card">
        <div className="ctc-table-header ctc-header--earnings">Earnings</div>
        <table className="ctc-table">
          <thead>
            <tr>
              <th>Heads</th>
              <th>Monthly Value</th>
              <th>Yearly Value</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {mockEarnings.map((e) => (
              <tr key={e.head}>
                <td>{e.head}</td>
                <td className="ctc-amount">{formatINR(e.monthly)}</td>
                <td className="ctc-amount">{formatINR(e.yearly)}</td>
                <td><span className="ctc-freq-badge">{e.frequency}</span></td>
              </tr>
            ))}
            <tr className="ctc-subtotal ctc-subtotal--gross">
              <td><strong>GROSS</strong></td>
              <td className="ctc-amount"><strong>{formatINR(grossMonthly)}</strong></td>
              <td className="ctc-amount"><strong>{formatINR(grossYearly)}</strong></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Additional Earnings */}
      <div className="ctc-table-card">
        <div className="ctc-table-header ctc-header--earnings">Additional Earnings</div>
        <table className="ctc-table">
          <thead>
            <tr>
              <th>Heads</th>
              <th>Monthly Value</th>
              <th>Yearly Value</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {mockAdditionalEarnings.map((e) => (
              <tr key={e.head}>
                <td>{e.head}</td>
                <td className="ctc-amount">{formatINR(e.monthly)}</td>
                <td className="ctc-amount">{formatINR(e.yearly)}</td>
                <td><span className="ctc-freq-badge">{e.frequency}</span></td>
              </tr>
            ))}
            <tr className="ctc-subtotal ctc-subtotal--ctc">
              <td><strong>CTC</strong></td>
              <td className="ctc-amount"><strong>{formatINR(ctcMonthly)}</strong></td>
              <td className="ctc-amount"><strong>{formatINR(ctcYearly)}</strong></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Deductions */}
      <div className="ctc-table-card">
        <div className="ctc-table-header ctc-header--deductions">Deductions</div>
        <table className="ctc-table">
          <thead>
            <tr>
              <th>Heads</th>
              <th>Monthly Value</th>
              <th>Yearly Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {mockDeductions.map((d) => (
              <tr key={d.head}>
                <td>{d.head}</td>
                <td className="ctc-amount">{formatINR(d.monthly)}</td>
                <td className="ctc-amount">{formatINR(d.yearly)}</td>
                <td />
              </tr>
            ))}
            <tr className="ctc-subtotal ctc-subtotal--inhand">
              <td><strong>In Hand Salary</strong></td>
              <td className="ctc-amount"><strong>{formatINR(inHandMonthly)}</strong></td>
              <td className="ctc-amount"><strong>{formatINR(inHandYearly)}</strong></td>
              <td />
            </tr>
          </tbody>
        </table>
        <p className="ctc-note">Note: Excluding TDS. Actual deductions may vary based on declarations.</p>
      </div>
    </div>
  );
};
