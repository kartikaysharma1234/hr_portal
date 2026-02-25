import { Navigate, Route, Routes } from 'react-router-dom';

import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { CtcBreakdownPage } from '../pages/CtcBreakdownPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { SalarySlipPage } from '../pages/SalarySlipPage';
import { SuperAdminDashboardPage } from '../pages/SuperAdminDashboardPage';
import { SuperAdminLandingPage } from '../pages/SuperAdminLandingPage';
import { SuperAdminLoginPage } from '../pages/SuperAdminLoginPage';
import { SuperAdminOrganizationSettingsPage } from '../pages/SuperAdminOrganizationSettingsPage';
import { TaxDeclarationPage } from '../pages/TaxDeclarationPage';
import { TaxReportPage } from '../pages/TaxReportPage';
import { TenantNotFoundPage } from '../pages/TenantNotFoundPage';
import { TenantWelcomePage } from '../pages/TenantWelcomePage';
import { VerifyEmailPage } from '../pages/VerifyEmailPage';
import { ProtectedRoute } from './ProtectedRoute';

export const AppRoutes = (): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const { subdomain } = useTenant();

  if (!subdomain) {
    return (
      <Routes>
        <Route path="/" element={<SuperAdminLandingPage />} />
        <Route path="/super-admin/login" element={<SuperAdminLoginPage />} />
        <Route path="/super-admin" element={<SuperAdminDashboardPage />} />
        <Route
          path="/super-admin/organizations/:id/settings"
          element={<SuperAdminOrganizationSettingsPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<TenantWelcomePage />} />

      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />

      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
      />

      <Route
        path="/reset-password"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
      />

      <Route
        path="/verify-email"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <VerifyEmailPage />}
      />

      <Route path="/tenant-not-found" element={<TenantNotFoundPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ctc" element={<CtcBreakdownPage />} />
          <Route path="/salary-slip" element={<SalarySlipPage />} />
          <Route path="/tax-declaration" element={<TaxDeclarationPage />} />
          <Route path="/tax-report" element={<TaxReportPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
