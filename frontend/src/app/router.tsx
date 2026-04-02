import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import DashboardPage from '../pages/DashboardPage';
import SharedGalleryPage from '../pages/SharedGalleryPage';
import RegisterPage from '../pages/RegisterPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import NotFoundPage from '../pages/NotFoundPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
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
