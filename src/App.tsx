import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { buildNavRoutes, buildNotFoundRoute } from '@/config/routes';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {buildNavRoutes()}
        {buildNotFoundRoute()}
      </Route>
    </Routes>
  );
}
