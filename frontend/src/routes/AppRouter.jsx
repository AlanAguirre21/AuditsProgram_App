import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { FullPageSpinner } from '../components/ui/Spinner.jsx';
import { ROLE } from '../constants/roles.js';
import AppLayout from '../layouts/AppLayout.jsx';
import AuthLayout from '../layouts/AuthLayout.jsx';
import RequireAuth from './RequireAuth.jsx';
import RequireRole from './RequireRole.jsx';

const { ADMIN, OWNER, MANAGER, VIEWER } = ROLE;

const LoginPage = lazy(() => import('../pages/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage.jsx'));
const HomePage = lazy(() => import('../pages/home/HomePage.jsx'));
const MyAuditsPage = lazy(() => import('../pages/my-audits/MyAuditsPage.jsx'));
const ProgramPage = lazy(() => import('../pages/program/ProgramPage.jsx'));
const OccurrenceDetailPage = lazy(() => import('../pages/occurrences/OccurrenceDetailPage.jsx'));
const AuditListPage = lazy(() => import('../pages/audits/AuditListPage.jsx'));
const AuditDetailPage = lazy(() => import('../pages/audits/AuditDetailPage.jsx'));
const AuditFormPage = lazy(() => import('../pages/audits/AuditFormPage.jsx'));
const ValidationQueuePage = lazy(() => import('../pages/validations/ValidationQueuePage.jsx'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage.jsx'));
const UsersPage = lazy(() => import('../pages/admin/UsersPage.jsx'));
const GroupsPage = lazy(() => import('../pages/admin/GroupsPage.jsx'));
const GroupDetailPage = lazy(() => import('../pages/admin/GroupDetailPage.jsx'));
const CalendarPage = lazy(() => import('../pages/admin/CalendarPage.jsx'));
const ImportPage = lazy(() => import('../pages/admin/ImportPage.jsx'));
const ChangeLogPage = lazy(() => import('../pages/admin/ChangeLogPage.jsx'));
const ForbiddenPage = lazy(() => import('../pages/errors/ForbiddenPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage.jsx'));

export default function AppRouter() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="program" element={<ProgramPage />} />
            <Route path="occurrences/:id" element={<OccurrenceDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="403" element={<ForbiddenPage />} />

            <Route element={<RequireRole roles={[OWNER, MANAGER, ADMIN]} />}>
              <Route path="my-audits" element={<MyAuditsPage />} />
            </Route>
            <Route element={<RequireRole roles={[ADMIN, MANAGER, VIEWER]} />}>
              <Route path="audits" element={<AuditListPage />} />
              <Route path="audits/:id" element={<AuditDetailPage />} />
            </Route>
            <Route element={<RequireRole roles={[ADMIN]} />}>
              <Route path="audits/new" element={<AuditFormPage />} />
              <Route path="audits/:id/edit" element={<AuditFormPage />} />
              <Route path="validations" element={<ValidationQueuePage />} />
              <Route path="admin/users" element={<UsersPage />} />
              <Route path="admin/groups" element={<GroupsPage />} />
              <Route path="admin/groups/:id" element={<GroupDetailPage />} />
              <Route path="admin/calendar" element={<CalendarPage />} />
              <Route path="admin/import" element={<ImportPage />} />
              <Route path="admin/changelog" element={<ChangeLogPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
