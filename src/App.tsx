import { Navigate, Route, Routes } from 'react-router-dom';
import { homePath, RequireRole, SessionProvider, useSession } from './auth/session';
import { PlatformLayout, SalonLayout } from './components/Layout';
import { ToastProvider } from './components/ui';
import { StoreProvider } from './data/store';
import { LoginPage } from './pages/LoginPage';
import { PlatformOverviewPage } from './pages/platform/OverviewPage';
import { SalonsPage } from './pages/platform/SalonsPage';
import { PlatformSettingsPage } from './pages/platform/SettingsPage';
import { SubscriptionsPage } from './pages/platform/SubscriptionsPage';
import { PlatformSupportPage } from './pages/platform/SupportPage';
import { ClockPage } from './pages/salon/ClockPage';
import { EmployeesPage } from './pages/salon/EmployeesPage';
import { SalonOverviewPage } from './pages/salon/OverviewPage';
import { ReportsPage } from './pages/salon/ReportsPage';
import { SchedulePage } from './pages/salon/SchedulePage';
import { SettingsPage } from './pages/salon/SettingsPage';
import { SalonSupportPage } from './pages/salon/SupportPage';

function HomeRedirect() {
  const { session } = useSession();
  return <Navigate to={homePath(session)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/logga-in" element={<LoginPage />} />
      <Route element={<RequireRole role="platform" />}>
        <Route path="/plattform" element={<PlatformLayout />}>
          <Route index element={<PlatformOverviewPage />} />
          <Route path="salonger" element={<SalonsPage />} />
          <Route path="prenumerationer" element={<SubscriptionsPage />} />
          <Route path="kundsupport" element={<PlatformSupportPage />} />
          <Route path="installningar" element={<PlatformSettingsPage />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="salon" />}>
        <Route path="/salong" element={<SalonLayout />}>
          <Route index element={<SalonOverviewPage />} />
          <Route path="medarbetare" element={<EmployeesPage />} />
          <Route path="schema" element={<SchedulePage />} />
          <Route path="stampla" element={<ClockPage />} />
          <Route path="rapporter" element={<ReportsPage />} />
          <Route path="kundsupport" element={<SalonSupportPage />} />
          <Route path="installningar" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </SessionProvider>
    </StoreProvider>
  );
}
