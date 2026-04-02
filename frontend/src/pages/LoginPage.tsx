import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

type LocationState = {
  from?: string;
};

function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fromPath = (location.state as LocationState | null)?.from ?? '/';

  const handleGoogleLogin = async (): Promise<void> => {
    setIsLoading(true);
    setMessage('');

    try {
      await signInWithGoogle();
      navigate(fromPath, { replace: true });
    } catch {
      setMessage('No se pudo iniciar sesion con Google. Verifica configuracion de Firebase Auth.');
    } finally {
      setIsLoading(false);
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
        <div className="stack-form">
          <button type="button" className="primary-btn" onClick={handleGoogleLogin} disabled={isLoading}>
            {isLoading ? 'Conectando...' : 'Iniciar sesion con Google'}
          </button>

          <p className="inline-note">Ruta destino luego de login: {fromPath}</p>

          {message && <p className="inline-note warning-note">{message}</p>}
        </div>
      </section>
    </div>
  );
}

export default LoginPage;

