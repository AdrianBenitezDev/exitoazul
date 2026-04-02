import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

type NavIconKey = 'panel' | 'register' | 'login';

const navLinks: Array<{ to: string; label: string; icon: NavIconKey }> = [
  {
    to: '/',
    label: 'Panel',
    icon: 'panel',
  },
  {
    to: '/register',
    label: 'Registro',
    icon: 'register',
  },
  {
    to: '/login',
    label: 'Login',
    icon: 'login',
  },
];

function BrandStarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.6l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20.8l1.1-6.2L3 10.2l6.2-.9L12 3.6z"
        fill="currentColor"
      />
    </svg>
  );
}

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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9.8 4.2h4.4l.6 2.1a6.6 6.6 0 0 1 1.6.9l2.1-.7 2.2 3.8-1.5 1.6c.1.3.1.7.1 1s0 .7-.1 1l1.5 1.6-2.2 3.8-2.1-.7a6.6 6.6 0 0 1-1.6.9l-.6 2.1H9.8l-.6-2.1a6.6 6.6 0 0 1-1.6-.9l-2.1.7-2.2-3.8 1.5-1.6a6.4 6.4 0 0 1 0-2l-1.5-1.6 2.2-3.8 2.1.7a6.6 6.6 0 0 1 1.6-.9l.6-2.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SessionIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.5v9.2M7.6 6A8.3 8.3 0 1 0 19 8.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.2 10.3 12 4l7.8 6.3V20H4.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.4 20v-5.4h5.2V20" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function RegisterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 18.6c.6-2.7 2.7-4.2 5.2-4.2s4.6 1.5 5.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.2 8.8h3.8M19.1 6.9v3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 6.3h5.5v11.4H14" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.6 8.6 14.9 12l-4.3 3.4M4.5 12H14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.8 5.1 6.6v5.1c0 4.4 2.8 7.4 6.9 8.6 4.1-1.2 6.9-4.2 6.9-8.6V6.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.2 12.2 11 14l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 3.8h8.8L19 8v12.2H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.8 3.8V8H19M8.6 12h7M8.6 15.3h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const renderNavIcon = (icon: NavIconKey) => {
  if (icon === 'panel') {
    return <HomeIcon />;
  }

  if (icon === 'register') {
    return <RegisterIcon />;
  }

  return <LoginIcon />;
};

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
            <h1 className="brand-title">
              <span className="brand-icon" aria-hidden="true">
                <BrandStarIcon />
              </span>
              <span>Exito Azul</span>
            </h1>
            <p className="subtitle">maxima privasidad</p>
          </div>

          <div className="banner-actions inline-actions" aria-label="Acciones de sesion">
            <button type="button" className="secondary-btn action-with-icon">
              <SettingsIcon />
              <span>Configuracion</span>
            </button>

            <button type="button" className="secondary-btn action-with-icon" onClick={() => void handleSessionClick()}>
              <SessionIcon />
              <span>{user ? 'Cerrar sesion' : 'Iniciar sesion'}</span>
            </button>

            <button type="button" className="user-chip" aria-label="Usuario actual">
              <UserIcon />
              <span>{user?.displayName ?? 'Usuario'}</span>
            </button>
          </div>
        </div>

        <div className="hero-quick-actions">
          {isSharedView && (
            <Link className="primary-btn action-with-icon" to="/register">
              <RegisterIcon />
              <span>Registrar nuevo usuario</span>
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
              <span className="nav-icon" aria-hidden="true">
                {renderNavIcon(link.icon)}
              </span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p className="footer-copy">Exito Azul 2026. Todos los derechos reservados.</p>
        <div className="footer-links">
          <Link className="text-link action-with-icon" to="/privacy#privacy-policy">
            <ShieldIcon />
            <span>Politica de privacidad</span>
          </Link>
          <a className="text-link action-with-icon" href="/register.html">
            <DocumentIcon />
            <span>Registro HTML</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
