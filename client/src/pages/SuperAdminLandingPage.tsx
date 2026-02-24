import { Link } from 'react-router-dom';

export const SuperAdminLandingPage = (): JSX.Element => {
  return (
    <main className="hero-shell">
      <section className="hero-content">
        <h1>
          HRMS <span>Super Admin</span>
        </h1>
        <p>Manage everything in one place.</p>

        <div className="hero-actions">
          <Link to="/super-admin/login" className="hero-btn primary">
            Get Started
          </Link>
          <a href="#features" className="hero-btn secondary">
            Learn More
          </a>
        </div>

        <div id="features" className="hero-feature-list">
          <div>Multi-tenant company onboarding</div>
          <div>Role-based access and permissions</div>
          <div>Employee lifecycle from one dashboard</div>
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
