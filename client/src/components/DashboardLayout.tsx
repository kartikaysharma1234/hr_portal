import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '⚡' },
  { to: '/ctc', label: 'My CTC', icon: '💰' },
  { to: '/salary-slip', label: 'Salary Slip', icon: '📄' },
  { to: '/tax-declaration', label: 'Tax Declaration', icon: '📝' },
  { to: '/tax-report', label: 'Tax Report', icon: '📊' },
];

export const DashboardLayout = (): JSX.Element => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="ess-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="ess-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`ess-sidebar ${sidebarOpen ? 'ess-sidebar--open' : ''}`}>
        <div className="ess-sidebar-brand">
          <div className="ess-sidebar-logo">Q</div>
          <span>Quelstring HRMS</span>
        </div>

        <nav className="ess-sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `ess-nav-link ${isActive ? 'ess-nav-link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className="ess-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ess-sidebar-footer">
          <div className="ess-sidebar-user">
            <div className="ess-user-avatar">
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="ess-user-info">
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
          </div>
          <button type="button" className="ess-logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="ess-main">
        <header className="ess-topbar">
          <button
            type="button"
            className="ess-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="ess-topbar-right">
            <span className="ess-greeting">
              Welcome back, <strong>{user?.name?.split(' ')[0]}</strong>
            </span>
          </div>
        </header>

        <div className="ess-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
