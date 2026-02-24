import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

export const ProtectedRoute = (): JSX.Element => {
  const { subdomain } = useTenant();
  const { isAuthenticated, isHydrated } = useAuth();

  if (!subdomain) {
    return <Navigate to="/tenant-not-found" replace />;
  }

  if (!isHydrated) {
    return <div className="page-center">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
