import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthErrorMessage } from '../auth/authErrors';
import { useAuth } from '../auth/useAuth';

function RegisterPage() {
  const { checkNicknameAvailability, registerWithEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [nickname, setNickname] = useState<string>('');
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
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname || !email.trim() || password.length < 6) {
      setMessage('Completa apodo, email y una clave de al menos 6 caracteres.');
      return;
    }

    if (trimmedNickname.length >= 15) {
      setMessage('El apodo debe tener menos de 15 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('La confirmacion de clave no coincide.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const availability = await checkNicknameAvailability(trimmedNickname);
      if (!availability.available) {
        setMessage('Ese apodo ya esta en uso. Elige otro.');
        return;
      }

      await registerWithEmail({
        nickname: trimmedNickname,
        email,
        password,
      });

      navigate(redirectPath, { replace: true });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String((error as { code?: string }).code ?? '');
        if (code === 'functions/already-exists') {
          setMessage('Ese apodo ya fue reservado por otro usuario. Intenta con otro.');
          return;
        }

        if (code === 'functions/invalid-argument') {
          setMessage('El apodo no cumple las reglas permitidas.');
          return;
        }
      }

      setMessage(getAuthErrorMessage(error, 'No se pudo crear la cuenta con estos datos.'));
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
            Apodo
            <input
              type="text"
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
              }}
              placeholder="Ejemplo: ana_23"
              maxLength={14}
            />
            <span className="inline-note">Hasta 14 caracteres: letras, numeros, punto, guion o guion bajo.</span>
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
