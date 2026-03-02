import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockEmployee } from '../utils/mockData';

const myLinksItems = [
  { to: '/ctc', label: 'My CTC', icon: '💰' },
  { to: '/salary-slip', label: 'Salary Slip', icon: '📄' },
  { to: '/tax-declaration', label: 'Tax Declaration', icon: '📝' },
  { to: '/tax-report', label: 'Tax Report', icon: '📊' },
];

const myProfileItems = [
  { to: '/profile/personal', label: 'Personal' },
  { to: '/profile/company', label: 'Company' },
  { to: '/profile/family', label: 'Family' },
  { to: '/profile/work-experience', label: 'Work Experience' },
  { to: '/profile/skill', label: 'Skill & Additional Info.' },
  { to: '/profile/qualification', label: 'Qualification' },
  { to: '/profile/photo', label: 'Photo' },
  { to: '/profile/documents', label: 'Documents' },
  { to: '/profile/bank', label: 'Bank Account Details' },
];

export const DashboardLayout = (): JSX.Element => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myLinksOpen, setMyLinksOpen] = useState(false);
  const [myProfileOpen, setMyProfileOpen] = useState(() =>
    location.pathname.startsWith('/profile')
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-open My Profile submenu when on a profile route
  useEffect(() => {
    if (location.pathname.startsWith('/profile')) {
      setMyProfileOpen(true);
    }
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          {/* Home */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `ess-nav-link ${isActive ? 'ess-nav-link--active' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <span className="ess-nav-icon">🏠</span>
            <span>Home</span>
          </NavLink>

          {/* My Links — Collapsible */}
          <div className="ess-nav-group">
            <button
              type="button"
              className={`ess-nav-link ess-nav-group-toggle ${myLinksOpen ? 'ess-nav-group-toggle--open' : ''}`}
              onClick={() => setMyLinksOpen(!myLinksOpen)}
            >
              <span className="ess-nav-icon">📋</span>
              <span>My Links</span>
              <span className={`ess-nav-chevron ${myLinksOpen ? 'ess-nav-chevron--open' : ''}`}>▸</span>
            </button>

            <div className={`ess-nav-submenu ${myLinksOpen ? 'ess-nav-submenu--open' : ''}`}>
              {myLinksItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `ess-nav-sublink ${isActive ? 'ess-nav-sublink--active' : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="ess-nav-sub-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* My Profile — Collapsible */}
          <div className="ess-nav-group">
            <button
              type="button"
              className={`ess-nav-link ess-nav-group-toggle ${myProfileOpen ? 'ess-nav-group-toggle--open' : ''}`}
              onClick={() => setMyProfileOpen(!myProfileOpen)}
            >
              <span className="ess-nav-icon">👤</span>
              <span>My Profile</span>
              <span className={`ess-nav-chevron ${myProfileOpen ? 'ess-nav-chevron--open' : ''}`}>▸</span>
            </button>

            <div className={`ess-nav-submenu ${myProfileOpen ? 'ess-nav-submenu--open' : ''}`}>
              {myProfileItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `ess-nav-sublink ${isActive ? 'ess-nav-sublink--active' : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
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

            {/* Employee Code Badge + User Dropdown */}
            <div className="ess-topbar-user" ref={dropdownRef}>
              <button
                type="button"
                className="ess-emp-badge"
                onClick={() => navigate('/profile/company')}
                title="View Profile"
              >
                {mockEmployee.code}
              </button>

              <button
                type="button"
                className="ess-topbar-avatar-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="ess-topbar-avatar">
                  {(user?.name ?? 'U').charAt(0).toUpperCase()}
                </div>
                <span className="ess-topbar-name">{user?.name}</span>
                <span className={`ess-topbar-caret ${dropdownOpen ? 'ess-topbar-caret--open' : ''}`}>▾</span>
              </button>

              {dropdownOpen && (
                <div className="ess-topbar-dropdown">
                  <div className="ess-dropdown-glow" aria-hidden="true" />
                  <button
                    type="button"
                    className="ess-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                  >
                    <span>🚪</span> Logout
                  </button>
                  <button
                    type="button"
                    className="ess-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span>🔑</span> Change Password
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="ess-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
