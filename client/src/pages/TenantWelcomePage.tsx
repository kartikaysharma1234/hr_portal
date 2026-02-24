import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

export const TenantWelcomePage = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { isAuthenticated } = useAuth();

  if (!subdomain) {
    return <Navigate to="/tenant-not-found" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="hero-shell">
      <section className="hero-content">
        <h1>
          {subdomain.toUpperCase()} <span>HRMS</span>
        </h1>
        <p>Unified employee experience for your company.</p>

        <div className="hero-actions">
          <Link to="/login" className="hero-btn primary">
            Get Started
          </Link>
          <Link to="/register" className="hero-btn secondary">
            New User
          </Link>
        </div>
      </section>

      <aside className="hero-illustration" aria-hidden="true">
        <div className="hero-card hero-card-a" />
        <div className="hero-card hero-card-b" />
        <div className="hero-card hero-card-c" />
      </aside>
    </main>
  );
};
