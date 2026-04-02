import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

const navLinks = [
  {
    to: '/',
    label: 'Panel',
  },
  {
    to: '/register',
    label: 'Registro',
  },
  {
    to: '/login',
    label: 'Login',
  },
];

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20c.8-3.8 3.8-5.8 7.5-5.8 3.7 0 6.7 2 7.5 5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const isSharedView = location.pathname.startsWith('/s/');

  const handleSessionClick = async (): Promise<void> => {
    if (user) {
      await signOutUser();
    }

    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="hero-panel unified-banner">
        <div className="hero-top-row">
          <div className="hero-main">
            <p className="eyebrow">Exito Azul</p>
            <h1>Galeria privada con links temporales y sin descarga</h1>
            <p className="subtitle">
              Envio directo si hay compatibilidad. Si no, fallback automatico a link temporal.
            </p>
          </div>

          <div className="banner-actions inline-actions" aria-label="Acciones de sesion">
            <button type="button" className="secondary-btn">
              Configuracion
            </button>

            <button type="button" className="secondary-btn" onClick={() => void handleSessionClick()}>
              {user ? 'Cerrar sesion' : 'Iniciar sesion'}
            </button>

            <button type="button" className="user-chip" aria-label="Usuario actual">
              <UserIcon />
              <span>{user?.displayName ?? 'Usuario'}</span>
            </button>
          </div>
        </div>

        <div className="hero-quick-actions">
          {isSharedView && (
            <Link className="primary-btn" to="/register">
              Registrar nuevo usuario
            </Link>
          )}
        </div>

        <nav className="nav-links" aria-label="Navegacion principal">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>Exito Azul 2026</p>
        <div className="footer-links">
          <Link className="text-link" to="/privacy#privacy-policy">
            Politica de privacidad
          </Link>
          <a className="text-link" href="/register.html">
            Registro HTML
          </a>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;

