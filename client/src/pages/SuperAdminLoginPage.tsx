import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { platformApi } from '../api/platformApi';
import { setAccessToken } from '../api/http';
import { getPlatformToken, setPlatformToken } from '../utils/platformSession';

export const SuperAdminLoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const existingToken = getPlatformToken();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (existingToken) {
    return <Navigate to="/super-admin" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await platformApi.login(email, password);
      setPlatformToken(response.token);
      setAccessToken(response.token);
      navigate('/super-admin', { replace: true });
    } catch {
      setError('Invalid super admin credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="sa-login-shell">
      <div className="sa-ambient sa-ambient-one" aria-hidden="true" />
      <div className="sa-ambient sa-ambient-two" aria-hidden="true" />

      <section className="sa-login-grid">
        <aside className="sa-login-left">
          <p className="sa-kicker">HRMS Platform</p>
          <h1>Super Admin Control Center</h1>
          <p>
            Create organizations, assign company admins, and govern access from one secure
            workspace.
          </p>

          <ul className="sa-feature-list">
            <li>
              <span />
              Multi-tenant company onboarding
            </li>
            <li>
              <span />
              Centralized role and access control
            </li>
            <li>
              <span />
              Enterprise-ready governance workflow
            </li>
          </ul>
        </aside>

        <section className="sa-login-card">
          <header className="sa-card-header">
            <h2>Sign in as Super Admin</h2>
            <p>Manage organizations and assign company admins.</p>
          </header>

          <form className="sa-form" onSubmit={onSubmit}>
            <label htmlFor="platform-email">Email</label>
            <input
              id="platform-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="superadmin@hrms.local"
              required
            />

            <label htmlFor="platform-password">Password</label>
            <input
              id="platform-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />

            {error ? <div className="error-text">{error}</div> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
};
