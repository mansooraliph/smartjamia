import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { canAccessPath } from '@/lib/access';
import { usePermissions } from '@/hooks/usePermissions';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { StudentsPage } from '@/pages/students/StudentsPage';
import { StudentRegistrationPage } from '@/pages/students/StudentRegistrationPage';
import { StudentViewPage } from '@/pages/students/StudentViewPage';
import { TransferCertificatesPage } from '@/pages/students/TransferCertificatesPage';
import { ParentsPage } from '@/pages/parents/ParentsPage';
import { PromotionPage } from '@/pages/academics/PromotionPage';
import { VisitorsPage } from '@/pages/visitors/VisitorsPage';
import { VisitsPage } from '@/pages/visitors/VisitsPage';
import { StaffPage } from '@/pages/staff/StaffPage';
import { StaffViewPage } from '@/pages/staff/StaffViewPage';
import { BiometricDevicesPage } from '@/pages/biometric-devices/BiometricDevicesPage';
import { BiometricTransactionsPage } from '@/pages/biometric-devices/BiometricTransactionsPage';
import { BiometricEnrolledPage } from '@/pages/biometric-devices/BiometricEnrolledPage';
import { AcademicYearsPage } from '@/pages/setup/AcademicYearsPage';
import { ClassesPage } from '@/pages/setup/ClassesPage';
import { SubjectsPage } from '@/pages/setup/SubjectsPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { ExamsPage } from '@/pages/exams/ExamsPage';
import { TimetablePage } from '@/pages/timetable/TimetablePage';
import { FeesPage } from '@/pages/fees/FeesPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { BillingPage } from '@/pages/billing/BillingPage';
import { SchoolLayout } from '@/components/shared/SchoolLayout';
import { PublicLayout } from '@/components/public/PublicLayout';
import { LandingPage } from '@/pages/public/LandingPage';
import { PricingPage } from '@/pages/public/PricingPage';
import { SignupPage } from '@/pages/public/SignupPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ImpersonationHandoffPage } from '@/pages/ImpersonationHandoffPage';
import { PagePlaceholder } from '@/pages/_PagePlaceholder';

import { PortalLoginPage } from '@/pages/portal/PortalLoginPage';
import { PortalHomePage } from '@/pages/portal/PortalHomePage';
import { SuperadminLoginPage } from '@/pages/superadmin/SuperadminLoginPage';
import { SuperadminLayout } from '@/components/superadmin/SuperadminLayout';
import { OrgLoginPage } from '@/pages/org/OrgLoginPage';
import { OrgDashboardPage } from '@/pages/org/OrgDashboardPage';
import { AccountLoginPage } from '@/pages/account/AccountLoginPage';
import { OverviewPage } from '@/pages/superadmin/OverviewPage';
import { PlansPage } from '@/pages/superadmin/PlansPage';
import { SchoolsPage } from '@/pages/superadmin/SchoolsPage';
import { SchoolDetailPage } from '@/pages/superadmin/SchoolDetailPage';
import { OrganizationsPage } from '@/pages/superadmin/OrganizationsPage';
import { OrganizationDetailPage } from '@/pages/superadmin/OrganizationDetailPage';
import { BranchesPage } from '@/pages/superadmin/BranchesPage';
import { SubscriptionsPage } from '@/pages/superadmin/SubscriptionsPage';
import { BiometricDevicesPage as SaBiometricDevicesPage } from '@/pages/superadmin/BiometricDevicesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const schoolSlug = useAuthStore((s) => s.schoolSlug);
  const { ctx, loaded } = usePermissions();
  const { pathname } = useLocation();
  // School pages need a tenant context. A session without a schoolSlug (e.g. a
  // superadmin login, or a stale session) can't send the X-School-Code header,
  // so bounce it to the school login instead of rendering pages that will fail.
  if (!isAuthenticated || !schoolSlug) {
    return <Navigate to="/login" replace />;
  }
  // Wait for permissions before gating non-dashboard pages (avoid a flash-redirect).
  if (!loaded && pathname !== '/dashboard' && pathname !== '/') {
    return null;
  }
  // Permission-based access: redirect to the dashboard if this page isn't permitted.
  if (!canAccessPath(ctx, pathname)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function SuperadminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthenticated) {
    return <Navigate to="/superadmin/login" replace />;
  }
  if (
    user?.role !== 'superadmin' &&
    user?.role !== 'support' &&
    user?.role !== 'finance'
  ) {
    return <Navigate to="/superadmin/login" replace />;
  }
  return <>{children}</>;
}

function OrgRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const orgToken = useAuthStore((s) => s.orgToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  if (!isAuthenticated) {
    return <Navigate to="/org/login" replace />;
  }
  if (user?.scope === 'organization') {
    return <>{children}</>;
  }
  // A tenant session that still holds org origin context is mid-transition
  // (an org admin entering one of its schools). Don't bounce to /org/login —
  // render nothing and let the in-flight navigate('/dashboard') win.
  if (orgToken) {
    return null;
  }
  return <Navigate to="/org/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Student / Parent PIN portal */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal" element={<PortalHomePage />} />

      {/* Organization admin portal */}
      <Route path="/org/login" element={<OrgLoginPage />} />
      <Route
        path="/org"
        element={
          <OrgRoute>
            <OrgDashboardPage />
          </OrgRoute>
        }
      />

      {/* Impersonation handoff — unguarded, sits between superadmin and tenant sessions */}
      <Route path="/impersonate-handoff" element={<ImpersonationHandoffPage />} />

      {/* Superadmin portal */}
      <Route path="/superadmin/login" element={<SuperadminLoginPage />} />
      <Route
        path="/superadmin"
        element={
          <SuperadminRoute>
            <SuperadminLayout />
          </SuperadminRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:id" element={<OrganizationDetailPage />} />
        <Route path="schools" element={<SchoolsPage />} />
        <Route path="schools/:id" element={<SchoolDetailPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="biometric-devices" element={<SaBiometricDevicesPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route
          path="admins"
          element={
            <PagePlaceholder
              title="Admins"
              description="Manage superadmin, support, and finance users."
            />
          }
        />
        <Route
          path="settings"
          element={
            <PagePlaceholder
              title="Platform settings"
              description="Email templates, SMS providers, webhooks, feature flags."
            />
          }
        />
      </Route>

      {/* Public marketing site */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="signup" element={<SignupPage />} />
      </Route>

      {/* Multi-school account login (one login → many schools) */}
      <Route path="/account/login" element={<AccountLoginPage />} />

      {/* School-tenant portal */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <SchoolLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Academic setup */}
        <Route path="setup/academic-years" element={<AcademicYearsPage />} />
        <Route path="setup/classes" element={<ClassesPage />} />
        <Route path="setup/subjects" element={<SubjectsPage />} />
        <Route path="promotion" element={<PromotionPage />} />

        {/* People */}
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/new" element={<StudentRegistrationPage />} />
        <Route
          path="students/:id/edit"
          element={<StudentRegistrationPage />}
        />
        <Route path="students/:id" element={<StudentViewPage />} />
        <Route
          path="transfer-certificates"
          element={<TransferCertificatesPage />}
        />
        <Route path="staff" element={<StaffPage />} />
        <Route path="staff/:id" element={<StaffViewPage />} />
        <Route path="parents" element={<ParentsPage />} />

        {/* Operations */}
        <Route path="visitors" element={<VisitorsPage />} />
        <Route path="visits" element={<VisitsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="biometric-devices" element={<BiometricDevicesPage />} />
        <Route
          path="biometric-devices/enrollments"
          element={<BiometricEnrolledPage />}
        />
        <Route
          path="biometric-devices/transactions"
          element={<BiometricTransactionsPage />}
        />

        {/* Modules */}
        <Route
          path="library"
          element={<PagePlaceholder title="Library" />}
        />
        <Route
          path="transport"
          element={<PagePlaceholder title="Transport" />}
        />
        <Route
          path="hostel"
          element={<PagePlaceholder title="Hostel" />}
        />

        {/* System */}
        <Route path="reports" element={<ReportsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
