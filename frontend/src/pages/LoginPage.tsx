import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthErrorMessage } from '../auth/authErrors';
import { useAuth } from '../auth/useAuth';

type LocationState = {
  from?: string;
};

function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth();
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
    <div className="page-stack">
      <section className="panel share-hero">
        <p className="eyebrow">Login</p>
        <h2>Accede para administrar tu galeria privada</h2>
        <p>
          Si la sesion no es valida, la ruta inicial redirige aqui automaticamente. Las URLs con
          token de compartido (`/s/:token`) quedan publicas.
        </p>
      </section>

      <section className="panel">
        <form className="stack-form" onSubmit={(event) => void handleEmailLogin(event)}>
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

        <div className="auth-divider" role="presentation">
          <span>o</span>
        </div>

        <div className="stack-form">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => void handleGoogleLogin()}
            disabled={isEmailLoading || isGoogleLoading}
          >
            {isGoogleLoading ? 'Conectando...' : 'Continuar con Google'}
          </button>

          <p className="inline-note">Ruta destino luego de login: {fromPath}</p>
          {message && <p className="inline-note warning-note">{message}</p>}
        </div>
      </section>
    </div>
  );
}

export default LoginPage;
