import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { getNavEntries, navigation } from './navigation';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded page chunks — each becomes its own async JS bundle.   */
/* ------------------------------------------------------------------ */

const DashboardPage = lazy(() => import('@/features/dashboard/components/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OrganizationPage = lazy(() => import('@/features/organization/components/OrganizationPage').then(m => ({ default: m.OrganizationPage })));
const EmployeesPage = lazy(() => import('@/features/employees/components/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const EmployeeProfilePage = lazy(() => import('@/features/employees/components/EmployeeProfilePage').then(m => ({ default: m.EmployeeProfilePage })));
const ContractsPage = lazy(() => import('@/features/contracts/components/ContractsPage').then(m => ({ default: m.ContractsPage })));
const DocumentsPage = lazy(() => import('@/features/documents/components/DocumentsPage').then(m => ({ default: m.DocumentsPage })));
const AttendancePage = lazy(() => import('@/features/attendance/components/AttendancePage').then(m => ({ default: m.AttendancePage })));
const LeavePage = lazy(() => import('@/features/leave/components/LeavePage').then(m => ({ default: m.LeavePage })));
const PayrollPage = lazy(() => import('@/features/payroll/components/PayrollPage').then(m => ({ default: m.PayrollPage })));
const CompensationPage = lazy(() => import('@/features/compensation/components/CompensationPage').then(m => ({ default: m.CompensationPage })));
const LoansPage = lazy(() => import('@/features/loans/components/LoansPage').then(m => ({ default: m.LoansPage })));
const RecruitmentPage = lazy(() => import('@/features/recruitment/components/RecruitmentPage').then(m => ({ default: m.RecruitmentPage })));
const OnboardingPage = lazy(() => import('@/features/onboarding/components/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const PerformancePage = lazy(() => import('@/features/performance/components/PerformancePage').then(m => ({ default: m.PerformancePage })));
const LearningPage = lazy(() => import('@/features/learning/components/LearningPage').then(m => ({ default: m.LearningPage })));
const CareerPage = lazy(() => import('@/features/career/components/CareerPage').then(m => ({ default: m.CareerPage })));
const AnalyticsPage = lazy(() => import('@/features/analytics/components/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const CopilotPage = lazy(() => import('@/features/copilot/components/CopilotPage').then(m => ({ default: m.CopilotPage })));
const SettingsPage = lazy(() => import('@/features/settings/components/SettingsPage').then(m => ({ default: m.SettingsPage })));

/* ------------------------------------------------------------------ */

const PAGE_COMPONENTS: Record<string, React.ReactNode> = {
  '/people/organization': <OrganizationPage />,
  '/people/employees': <EmployeesPage />,
  '/people/contracts': <ContractsPage />,
  '/people/documents': <DocumentsPage />,
  '/workforce/attendance': <AttendancePage />,
  '/workforce/leave': <LeavePage />,
  '/finance/payroll': <PayrollPage />,
  '/finance/compensation': <CompensationPage />,
  '/finance/loans': <LoansPage />,
  '/talent/recruitment': <RecruitmentPage />,
  '/talent/onboarding': <OnboardingPage />,
  '/talent/performance': <PerformancePage />,
  '/talent/learning': <LearningPage />,
  '/talent/career': <CareerPage />,
  '/intelligence/analytics': <AnalyticsPage />,
  '/intelligence/copilot': <CopilotPage />,
  '/settings': <SettingsPage />,
};

/** Minimal skeleton shown while a lazy chunk loads. */
function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
    </div>
  );
}

/**
 * Per-route ErrorBoundary + Suspense wrapper.
 *
 * Each page is wrapped in its own ErrorBoundary so a crash in one feature
 * doesn't blank the entire app, and Suspense handles the lazy-load wait.
 */
function PageWithBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/** Route elements generated from the navigation config — one route per nav leaf. */
export function buildNavRoutes() {
  const navRoutes = getNavEntries(navigation).map((entry) => {
    const page =
      entry.path === '/'
        ? <DashboardPage />
        : PAGE_COMPONENTS[entry.path] ?? <NotFoundPage />;

    return (
      <Route
        key={entry.path}
        path={entry.path}
        element={<PageWithBoundary>{page}</PageWithBoundary>}
      />
    );
  });

  // Employee 360 profile — not a nav leaf, but lives inside the shell.
  navRoutes.push(
    <Route
      key="/people/employees/:id"
      path="/people/employees/:id"
      element={<PageWithBoundary><EmployeeProfilePage /></PageWithBoundary>}
    />,
  );

  return navRoutes;
}

export function buildNotFoundRoute() {
  return <Route path="*" element={<NotFoundPage />} />;
}
