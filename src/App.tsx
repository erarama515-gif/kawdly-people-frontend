import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/auth/RequireAuth';
import { buildNavRoutes, buildNotFoundRoute } from '@/config/routes';
import { ToastContainer } from '@/components/ui/Toast';

const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            {buildNavRoutes()}
            {buildNotFoundRoute()}
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </>
  );
}
