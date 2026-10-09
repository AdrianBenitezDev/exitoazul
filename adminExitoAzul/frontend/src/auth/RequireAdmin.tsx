import type {ReactNode} from 'react';
import {Navigate, useLocation} from 'react-router-dom';
import {useAuth} from './useAuth';

const ADMIN_EMAIL = 'artbenitezdev@gmail.com';

type RequireAdminProps = {
  children: ReactNode;
};

const normalizeEmail = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() ?? '';

function RequireAdmin({children}: RequireAdminProps) {
  const {user, loading} = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <section className="panel">
        <p>Verificando permisos de administrador...</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{from: location.pathname}} />;
  }

  if (normalizeEmail(user.email) !== ADMIN_EMAIL) {
    return (
      <section className="panel admin-lock-panel">
        <h2>Acceso restringido</h2>
        <p>
          Esta web de administrador solo permite el correo{' '}
          <strong>{ADMIN_EMAIL}</strong>.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}

export default RequireAdmin;

