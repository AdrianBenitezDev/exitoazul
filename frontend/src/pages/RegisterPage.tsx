import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthErrorMessage } from '../auth/authErrors';
import { useAuth } from '../auth/useAuth';

function RegisterPage() {
  const { registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const redirectPath = (searchParams.get('redirect')?.trim() || '/').startsWith('/')
    ? searchParams.get('redirect')?.trim() || '/'
    : '/';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setMessage('Completa nombre, email y una clave de al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('La confirmacion de clave no coincide.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      await registerWithEmail({
        fullName,
        email,
        password,
      });

      navigate(redirectPath, { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error, 'No se pudo crear la cuenta con este email.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="panel share-hero">
        <p className="eyebrow">Registro</p>
        <h2>Crear una nueva cuenta</h2>
        <p>Completa tus datos para crear una nueva cuenta.</p>
      </section>

      <section className="panel">
        <form className="stack-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Nombre completo
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
              placeholder="Ejemplo: Ana Perez"
            />
          </label>

          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              placeholder="ana@correo.com"
            />
          </label>

          <label>
            Clave
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Minimo 6 caracteres"
            />
          </label>

          <label>
            Confirmar clave
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
              }}
              placeholder="Repite la clave"
            />
          </label>

          <button type="submit" className="primary-btn" disabled={isLoading}>
            {isLoading ? 'Creando cuenta...' : 'Registrar usuario'}
          </button>

          {message && <p className="inline-note warning-note">{message}</p>}
          <p className="inline-note">
            Si ya tienes cuenta, puedes{' '}
            <Link to={`/login?redirect=${encodeURIComponent(redirectPath)}`}>iniciar sesion aqui</Link>.
          </p>
        </form>
      </section>
    </div>
  );
}

export default RegisterPage;
