import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layout/index.js';
import { HomePage } from './pages/home/index.js';
import { ProjectListPage, ProjectDetailPage, CreateProjectPage } from './pages/projects/index.js';
import { SettingsPage } from './pages/settings/index.js';
import { BillingPage } from './pages/billing/index.js';
import { LoginPage } from './pages/auth/index.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';

export function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected dashboard routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<CreateProjectPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
