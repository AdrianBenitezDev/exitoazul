import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthErrorMessage } from '../auth/authErrors';
import { useAuth } from '../auth/useAuth';

type LocationState = {
  from?: string;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.3c-.2 1.3-1 2.5-2.2 3.3v2.8h3.5c2-1.8 3-4.5 3-8z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.9-.9 6.5-2.5l-3.5-2.8c-1 .7-2.2 1.2-3.6 1.2-2.8 0-5.1-1.9-6-4.4H1.8v2.9C3.4 19.6 7.4 22 12 22z"
        fill="#34A853"
      />
      <path
        d="M5.4 13.5c-.2-.7-.3-1.3-.3-2s.1-1.4.3-2V6.6H1.8A10 10 0 0 0 1 11.5c0 1.7.4 3.4 1.2 4.9l3.2-2.9z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.4c1.5 0 2.9.5 4 1.5l3-3C17 1.9 14.7 1 12 1 7.4 1 3.4 3.4 1.8 6.6l3.6 2.9c.9-2.5 3.2-4.1 6-4.1z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isEmailLoading, setIsEmailLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const fromState = (location.state as LocationState | null)?.from ?? '';
  const fromQuery = searchParams.get('redirect')?.trim() ?? '';
  const fromPath = (fromState || fromQuery || '/').startsWith('/')
    ? fromState || fromQuery || '/'
    : '/';

  useEffect(() => {
    if (!loading && user) {
      navigate('/index.html', { replace: true });
    }
  }, [loading, user, navigate]);

  if (!loading && user) {
    return null;
  }

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessage('Completa email y clave para continuar.');
      return;
    }

    setIsEmailLoading(true);
    setMessage('');

    try {
      await signInWithEmail(email, password);
      navigate(fromPath, { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'No se pudo iniciar sesion con email y clave.'));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleGoogleLogin = async (): Promise<void> => {
    setIsGoogleLoading(true);
    setMessage('');

    try {
      await signInWithGoogle();
      navigate(fromPath, { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'No se pudo iniciar sesion con Google.'));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="page-stack login-page">
      <section className="panel share-hero login-hero">
        <p className="eyebrow">Login</p>
        <h2>Accede para administrar tu galeria privada</h2>
        <ul className="login-highlights">
          <li>-Administras tus imagenes y compartelas con quien tu quieras de una forma segura</li>
          <li>-Exito Azul es una web especializada en el almacenamiento de contenido sencible</li>
          <li>
            -lee nuestro{' '}
            <Link className="text-link" to="/terms#terms-conditions">
              terminos y condiciones de uso
            </Link>
          </li>
        </ul>
      </section>

      <section className="panel login-panel">
        <form className="stack-form login-form" onSubmit={(event) => void handleEmailLogin(event)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              placeholder="tu-correo@dominio.com"
            />
          </label>

          <label>
            Clave
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Tu clave"
            />
          </label>

          <button type="submit" className="primary-btn" disabled={isEmailLoading || isGoogleLoading}>
            {isEmailLoading ? 'Ingresando...' : 'Iniciar sesion con email'}
          </button>
        </form>

        <div className="auth-divider login-divider" role="presentation">
          <span>o</span>
        </div>

        <div className="stack-form login-form">
          <button
            type="button"
            className="secondary-btn action-with-icon login-google-btn"
            onClick={() => void handleGoogleLogin()}
            disabled={isEmailLoading || isGoogleLoading}
          >
            <GoogleIcon />
            <span>{isGoogleLoading ? 'Conectando...' : 'Continuar con Google'}</span>
          </button>

          {message && <p className="inline-note warning-note">{message}</p>}
        </div>
      </section>
    </div>
  );
}

export default LoginPage;
