import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import RequireAuth from '../auth/RequireAuth';
import DashboardPage from '../pages/DashboardPage';
import SharedGalleryPage from '../pages/SharedGalleryPage';
import RegisterPage from '../pages/RegisterPage';
import LoginPage from '../pages/LoginPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import TermsConditionsPage from '../pages/TermsConditionsPage';
import NotFoundPage from '../pages/NotFoundPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: 'index.html',
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'privacy',
        element: <PrivacyPolicyPage />,
      },
      {
        path: 'terms',
        element: <TermsConditionsPage />,
      },
      {
        path: 's/:token',
        element: <SharedGalleryPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export default router;
