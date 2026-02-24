import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { setAccessToken } from '../api/http';
import { platformApi } from '../api/platformApi';
import type { CreateOrganizationPayload, OrganizationSummary } from '../types/platform';
import { clearPlatformToken, getPlatformToken } from '../utils/platformSession';

const emptyOrgForm: CreateOrganizationPayload = {
  name: '',
  subdomain: '',
  adminName: '',
  adminEmail: '',
  adminPassword: ''
};

export const SuperAdminDashboardPage = (): JSX.Element => {
  const navigate = useNavigate();
  const token = useMemo(() => getPlatformToken(), []);

  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [orgForm, setOrgForm] = useState<CreateOrganizationPayload>(emptyOrgForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    setAccessToken(token);

    const loadOrganizations = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await platformApi.listOrganizations();
        setOrganizations(data);
      } catch {
        setError('Unable to fetch organizations');
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrganizations();
  }, [token]);

  if (!token) {
    return <Navigate to="/super-admin/login" replace />;
  }

  const onLogout = (): void => {
    clearPlatformToken();
    setAccessToken(null);
    navigate('/super-admin/login', { replace: true });
  };

  const onCreateOrganization = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      await platformApi.createOrganization(orgForm);
      setOrgForm(emptyOrgForm);
      const data = await platformApi.listOrganizations();
      setOrganizations(data);
      setSuccess('Organization created successfully.');
    } catch {
      setError('Unable to create organization. Check subdomain/admin data and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const totalOrganizations = organizations.length;
  const activeOrganizations = organizations.filter((org) => org.isActive).length;
  const inactiveOrganizations = totalOrganizations - activeOrganizations;

  return (
    <main className="sa-dashboard-shell">
      <div className="sa-dashboard-ambient sa-dashboard-ambient-one" aria-hidden="true" />
      <div className="sa-dashboard-ambient sa-dashboard-ambient-two" aria-hidden="true" />

      <header className="sa-dashboard-topbar">
        <div className="sa-dashboard-headline">
          <p>Super Admin Workspace</p>
          <h1>Control Panel</h1>
          <span>Create and manage multi-tenant organizations from a single command center.</span>
        </div>

        <button type="button" className="sa-dashboard-logout" onClick={onLogout}>
          Logout
        </button>
      </header>

      <section className="sa-dashboard-metrics">
        <article>
          <h3>Total Organizations</h3>
          <p>{totalOrganizations}</p>
        </article>
        <article>
          <h3>Active Tenants</h3>
          <p>{activeOrganizations}</p>
        </article>
        <article>
          <h3>Inactive Tenants</h3>
          <p>{inactiveOrganizations}</p>
        </article>
      </section>

      <section className="sa-dashboard-grid">
        <article className="sa-create-panel">
          <header>
            <h2>Create Organization</h2>
            <p>Onboard a new company with its own subdomain and admin account.</p>
          </header>

          <form className="sa-create-form" onSubmit={onCreateOrganization}>
            <div className="sa-form-row">
              <label htmlFor="org-name">Organization Name</label>
              <input
                id="org-name"
                value={orgForm.name}
                onChange={(event) => setOrgForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Acme Corp"
                required
              />
            </div>

            <div className="sa-form-row">
              <label htmlFor="org-subdomain">Subdomain</label>
              <input
                id="org-subdomain"
                value={orgForm.subdomain}
                onChange={(event) =>
                  setOrgForm((prev) => ({ ...prev, subdomain: event.target.value.toLowerCase() }))
                }
                placeholder="acme"
                required
              />
              <small>
                Tenant URL: <strong>{orgForm.subdomain || 'your-subdomain'}.localhost</strong>
              </small>
            </div>

            <div className="sa-form-grid-two">
              <div className="sa-form-row">
                <label htmlFor="org-admin-name">Admin Name</label>
                <input
                  id="org-admin-name"
                  value={orgForm.adminName}
                  onChange={(event) =>
                    setOrgForm((prev) => ({ ...prev, adminName: event.target.value }))
                  }
                  placeholder="Jane Doe"
                  required
                />
              </div>

              <div className="sa-form-row">
                <label htmlFor="org-admin-email">Admin Email</label>
                <input
                  id="org-admin-email"
                  type="email"
                  value={orgForm.adminEmail}
                  onChange={(event) =>
                    setOrgForm((prev) => ({ ...prev, adminEmail: event.target.value }))
                  }
                  placeholder="admin@acme.com"
                  required
                />
              </div>
            </div>

            <div className="sa-form-row">
              <label htmlFor="org-admin-password">Admin Password</label>
              <input
                id="org-admin-password"
                type="password"
                value={orgForm.adminPassword}
                onChange={(event) =>
                  setOrgForm((prev) => ({ ...prev, adminPassword: event.target.value }))
                }
                placeholder="Strong password"
                required
              />
            </div>

            {error ? <div className="error-text">{error}</div> : null}
            {success ? <div className="success-text">{success}</div> : null}

            <button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        </article>

        <article className="sa-org-panel">
          <header>
            <h2>Organizations</h2>
            <span>{organizations.length} total</span>
          </header>

          {isLoading ? <p className="sa-org-muted">Loading organizations...</p> : null}

          {!isLoading && organizations.length === 0 ? (
            <p className="sa-org-muted">No organizations yet. Create your first tenant.</p>
          ) : null}

          {!isLoading && organizations.length > 0 ? (
            <div className="sa-org-list">
              {organizations.map((org) => (
                <div key={org.id} className="sa-org-item">
                  <div>
                    <h3>{org.name}</h3>
                    <p>{org.subdomain}.localhost</p>
                  </div>
                  <span className={org.isActive ? 'sa-status active' : 'sa-status inactive'}>
                    {org.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
};
