import { Route } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { DashboardPage } from '@/features/dashboard/components/DashboardPage';
import { OrganizationPage } from '@/features/organization/components/OrganizationPage';
import { EmployeesPage } from '@/features/employees/components/EmployeesPage';
import { ContractsPage } from '@/features/contracts/components/ContractsPage';
import { DocumentsPage } from '@/features/documents/components/DocumentsPage';
import { AttendancePage } from '@/features/attendance/components/AttendancePage';
import { LeavePage } from '@/features/leave/components/LeavePage';
import { PayrollPage } from '@/features/payroll/components/PayrollPage';
import { CompensationPage } from '@/features/compensation/components/CompensationPage';
import { LoansPage } from '@/features/loans/components/LoansPage';
import { RecruitmentPage } from '@/features/recruitment/components/RecruitmentPage';
import { OnboardingPage } from '@/features/onboarding/components/OnboardingPage';
import { PerformancePage } from '@/features/performance/components/PerformancePage';
import { LearningPage } from '@/features/learning/components/LearningPage';
import { CareerPage } from '@/features/career/components/CareerPage';
import { AnalyticsPage } from '@/features/analytics/components/AnalyticsPage';
import { CopilotPage } from '@/features/copilot/components/CopilotPage';
import { SettingsPage } from '@/features/settings/components/SettingsPage';
import { getNavEntries, navigation } from './navigation';

const PAGE_COMPONENTS: Record<string, React.ReactElement> = {
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

/** Route elements generated from the navigation config — one route per nav leaf. */
export function buildNavRoutes() {
  return getNavEntries(navigation).map((entry) => (
    <Route
      key={entry.path}
      path={entry.path}
      element={
        entry.path === '/'
          ? <DashboardPage />
          : PAGE_COMPONENTS[entry.path] ?? <NotFoundPage />
      }
    />
  ));
}

export function buildNotFoundRoute() {
  return <Route path="*" element={<NotFoundPage />} />;
}
