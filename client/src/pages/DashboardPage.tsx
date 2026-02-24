import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

export const DashboardPage = (): JSX.Element => {
  const { user, logout } = useAuth();
  const { subdomain } = useTenant();

  return (
    <main className="dashboard-shell">
      <header>
        <h1>HRMS Dashboard</h1>
        <button type="button" onClick={logout}>
          Logout
        </button>
      </header>

      <section className="dashboard-grid">
        <article>
          <h2>Tenant</h2>
          <p>{subdomain}</p>
        </article>

        <article>
          <h2>User</h2>
          <p>{user?.name}</p>
          <p>{user?.email}</p>
          <p>{user?.role}</p>
        </article>
      </section>
    </main>
  );
};
