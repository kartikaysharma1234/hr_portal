import { useState } from 'react';
import { formatINR } from '../utils/currencyUtils';
import { mockTaxSections } from '../utils/mockData';
import type { TaxSection } from '../utils/mockData';

type StatusTab = 'pending' | 'submitted' | 'checked' | 'proxy';

const tabs: { key: StatusTab; label: string; icon: string; color: string }[] = [
  { key: 'pending', label: 'Pending To Submit', icon: '⏳', color: '#3b82f6' },
  { key: 'submitted', label: 'Submitted', icon: '📤', color: '#f59e0b' },
  { key: 'checked', label: 'Checked', icon: '✅', color: '#22c55e' },
  { key: 'proxy', label: 'Proxy entry by HR', icon: '👤', color: '#6b7280' },
];

export const TaxDeclarationPage = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [expandedSection, setExpandedSection] = useState<string | null>('80c');
  const [financialYear] = useState('2025-26');

  const toggleSection = (id: string): void => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const hasPendingData = activeTab === 'pending' && mockTaxSections.length > 0;

  return (
    <div className="tax-decl-page">
      {/* Breadcrumb */}
      <div className="ess-breadcrumb">
        <span>My Links</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">My Investment Declaration</span>
      </div>

      {/* Year Selector */}
      <div className="tax-decl-controls">
        <div className="ctc-select-group">
          <label>Financial Year</label>
          <select value={financialYear} disabled>
            <option>2025-26</option>
            <option>2024-25</option>
          </select>
        </div>
        <button type="button" className="ess-btn ess-btn--primary">Search</button>
      </div>

      {/* Status Tabs */}
      <div className="tax-decl-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tax-decl-tab ${activeTab === tab.key ? 'tax-decl-tab--active' : ''}`}
            style={activeTab === tab.key ? { background: tab.color, borderColor: tab.color } : {}}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="tax-decl-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!hasPendingData ? (
        <div className="tax-decl-empty">
          <div className="tax-decl-empty-icon">📋</div>
          <h3>No investment declaration data entered for the selected year</h3>
          <p>Start by clicking "New" to add your investment declarations for tax savings.</p>
          <button type="button" className="ess-btn ess-btn--primary">+ New Declaration</button>
        </div>
      ) : (
        <div className="tax-decl-sections">
          {mockTaxSections.map((section: TaxSection) => (
            <div
              key={section.id}
              className={`tax-decl-section ${expandedSection === section.id ? 'tax-decl-section--open' : ''}`}
            >
              <button
                type="button"
                className="tax-decl-section-header"
                onClick={() => toggleSection(section.id)}
              >
                <div className="tax-decl-section-left">
                  <span className="tax-decl-chevron">{expandedSection === section.id ? '▾' : '▸'}</span>
                  <strong>{section.name}</strong>
                  {section.maxLimit > 0 && (
                    <span className="tax-decl-limit">Max: {formatINR(section.maxLimit)}</span>
                  )}
                </div>
                <div className="tax-decl-section-right">
                  <span className="tax-decl-declared">{formatINR(section.declared)}</span>
                </div>
              </button>

              {expandedSection === section.id && (
                <div className="tax-decl-section-body">
                  {/* Progress bar */}
                  {section.maxLimit > 0 && (
                    <div className="tax-decl-progress">
                      <div className="tax-decl-progress-bar">
                        <div
                          className="tax-decl-progress-fill"
                          style={{ width: `${Math.min(100, (section.declared / section.maxLimit) * 100)}%` }}
                        />
                      </div>
                      <small>
                        {formatINR(section.declared)} of {formatINR(section.maxLimit)} utilized
                      </small>
                    </div>
                  )}

                  {section.items.length > 0 ? (
                    <table className="ess-table tax-decl-table">
                      <thead>
                        <tr>
                          <th>Investment Type</th>
                          <th>Amount Declared</th>
                          <th>Proof</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.type}</td>
                            <td className="ctc-amount">{formatINR(item.amount)}</td>
                            <td>{item.proofUploaded ? '✅' : '⬜'}</td>
                            <td>
                              <span className={`tax-decl-status tax-decl-status--${item.status.toLowerCase()}`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="tax-decl-no-items">No investments declared in this section</p>
                  )}

                  <button type="button" className="ess-btn ess-btn--glass tax-decl-add">
                    + Add Investment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
