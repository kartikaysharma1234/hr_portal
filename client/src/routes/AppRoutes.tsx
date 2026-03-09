import { Navigate, Route, Routes } from 'react-router-dom';

import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import {
  AttendanceDailyPage,
  AttendanceLeaveLedgerPage,
  AttendanceMonthlyPage,
  AttendanceYearlyPage,
} from '../pages/MyAttendancePage';
import { CtcBreakdownPage } from '../pages/CtcBreakdownPage';
import { EmployeeProfilePage } from '../pages/EmployeeProfilePage';
import { DashboardPage } from '../pages/DashboardPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { OrganizationUsersPage } from '../pages/OrganizationUsersPage';
import { ProfileFamilyPage } from '../pages/ProfileFamilyPage';
import { ProfilePersonalPage } from '../pages/ProfilePersonalPage';
import {
  ProfileBankPage,
  ProfileDocumentsPage,
  ProfilePhotoPage,
  ProfileQualificationPage,
  ProfileSkillPage,
} from '../pages/ProfilePlaceholders';
import { ProfileWorkExpPage } from '../pages/ProfileWorkExpPage';
import { AttendanceRegularisePage } from '../pages/AttendanceRegularisePage';
import { LeaveOdWfhPage } from '../pages/LeaveOdWfhPage';
import { RegisterPage } from '../pages/RegisterPage';
import { AppreciationRequestPage } from '../pages/AppreciationRequestPage';
import { HelpDeskRequestPage } from '../pages/HelpDeskRequestPage';
import { LeaveEncashmentPage } from '../pages/LeaveEncashmentPage';
import { ResignationNotePage } from '../pages/ResignationNotePage';
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
          <Route path="/org-users" element={<OrganizationUsersPage />} />
          <Route path="/attendance" element={<Navigate to="/attendance/daily" replace />} />
          <Route path="/attendance/daily" element={<AttendanceDailyPage />} />
          <Route path="/attendance/monthly" element={<AttendanceMonthlyPage />} />
          <Route path="/attendance/yearly" element={<AttendanceYearlyPage />} />
          <Route path="/attendance/leave-ledger" element={<AttendanceLeaveLedgerPage />} />
          <Route
            path="/request"
            element={<Navigate to="/request/attendance-regularise" replace />}
          />
          <Route path="/request/attendance-regularise" element={<AttendanceRegularisePage />} />
          <Route path="/request/leave-od-wfh" element={<LeaveOdWfhPage />} />
          <Route path="/request/helpdesk" element={<HelpDeskRequestPage />} />
          <Route path="/request/appreciation" element={<AppreciationRequestPage />} />
          <Route path="/request/resignation-note" element={<ResignationNotePage />} />
          <Route path="/request/leave-encashment" element={<LeaveEncashmentPage />} />
          <Route path="/profile" element={<Navigate to="/profile/personal" replace />} />
          <Route path="/profile/personal" element={<ProfilePersonalPage />} />
          <Route path="/profile/company" element={<EmployeeProfilePage />} />
          <Route path="/profile/family" element={<ProfileFamilyPage />} />
          <Route path="/profile/work-experience" element={<ProfileWorkExpPage />} />
          <Route path="/profile/skill" element={<ProfileSkillPage />} />
          <Route path="/profile/qualification" element={<ProfileQualificationPage />} />
          <Route path="/profile/photo" element={<ProfilePhotoPage />} />
          <Route path="/profile/documents" element={<ProfileDocumentsPage />} />
          <Route path="/profile/bank" element={<ProfileBankPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
