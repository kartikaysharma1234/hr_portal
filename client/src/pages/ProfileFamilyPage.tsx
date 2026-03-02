import { useState } from 'react';
import { mockFamilyMembers } from '../utils/mockData';
import type { FamilyMember } from '../utils/mockData';

export const ProfileFamilyPage = (): JSX.Element => {
  const [isAmending, setIsAmending] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>(() =>
    mockFamilyMembers.map((m) => ({ ...m }))
  );
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAmend = (): void => {
    setIsAmending(true);
    setShowSuccess(false);
  };

  const handleSubmit = (): void => {
    setIsAmending(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
  };

  const handleCancel = (): void => {
    setMembers(mockFamilyMembers.map((m) => ({ ...m })));
    setIsAmending(false);
  };

  const updateMember = (idx: number, key: keyof FamilyMember, val: string | number): void => {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [key]: val } : m))
    );
  };

  return (
    <div className="profile-page">
      <div className="ess-breadcrumb">
        <span>My Profile</span>
        <span className="ess-breadcrumb-sep">›</span>
        <span className="ess-breadcrumb-active">Family</span>
      </div>

      <div className="pf-card">
        <div className="pf-card-header">
          <div className="pf-card-header-left">
            <span className="pf-card-icon">👨‍👩‍👧‍👦</span>
            <h3>Family Details</h3>
          </div>
        </div>

        {showSuccess && (
          <div className="pf-success-banner">
            <span>✅</span>
            <div>
              <strong>Family details amendment submitted!</strong>
              <p>Changes are pending admin approval.</p>
            </div>
          </div>
        )}

        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Sr.No.</th>
                <th>Member Name <span className="pf-required">*</span></th>
                <th>Relation <span className="pf-required">*</span></th>
                <th>Date of Birth <span className="pf-required">*</span></th>
                <th>Occupation</th>
                <th>Contact No.</th>
                <th>Aadhaar No.</th>
                <th>PF% Nomination</th>
                <th>Gratuity% Nomination</th>
                <th>ESIC% Nomination</th>
                <th>Covered In ESIC</th>
                <th>Covered Under Mediclaim</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, idx) => (
                <tr key={m.srNo}>
                  <td className="pf-td-center">{m.srNo}</td>
                  <td>
                    {isAmending ? (
                      <input
                        className="pf-table-input"
                        value={m.memberName}
                        onChange={(e) => updateMember(idx, 'memberName', e.target.value)}
                      />
                    ) : m.memberName}
                  </td>
                  <td>
                    {isAmending ? (
                      <select
                        className="pf-table-input"
                        value={m.relation}
                        onChange={(e) => updateMember(idx, 'relation', e.target.value)}
                      >
                        {['Father', 'Mother', 'Spouse', 'Child', 'Sibling', 'Other'].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    ) : m.relation}
                  </td>
                  <td>{isAmending
                    ? <input className="pf-table-input" value={m.dob} onChange={(e) => updateMember(idx, 'dob', e.target.value)} />
                    : m.dob}
                  </td>
                  <td>{isAmending
                    ? <input className="pf-table-input" value={m.occupation} onChange={(e) => updateMember(idx, 'occupation', e.target.value)} />
                    : m.occupation || '—'}
                  </td>
                  <td>{isAmending
                    ? <input className="pf-table-input" value={m.contactNo} onChange={(e) => updateMember(idx, 'contactNo', e.target.value)} />
                    : m.contactNo || '—'}
                  </td>
                  <td>{isAmending
                    ? <input className="pf-table-input" value={m.aadhaarNo} onChange={(e) => updateMember(idx, 'aadhaarNo', e.target.value)} />
                    : m.aadhaarNo || '—'}
                  </td>
                  <td className="pf-td-center">{m.pfNomination}</td>
                  <td className="pf-td-center">{m.gratuityNomination}</td>
                  <td className="pf-td-center">{m.esicNomination}</td>
                  <td className="pf-td-center">{m.coveredInEsic}</td>
                  <td className="pf-td-center">{m.coveredMediclaim}</td>
                  <td>{isAmending
                    ? <input className="pf-table-input" value={m.address} onChange={(e) => updateMember(idx, 'address', e.target.value)} />
                    : m.address || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pf-action-bar">
          {isAmending ? (
            <>
              <button type="button" className="ess-btn ess-btn--primary" onClick={handleSubmit}>
                Amend
              </button>
              <button type="button" className="ess-btn ess-btn--glass" onClick={handleCancel}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="ess-btn ess-btn--primary pf-amend-btn" onClick={handleAmend}>
              ✏️ Amend
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
