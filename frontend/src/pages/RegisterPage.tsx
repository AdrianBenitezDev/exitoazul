import { useState } from 'react';
import type { FormEvent } from 'react';

function RegisterPage() {
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setMessage('Completa nombre, email y una clave de al menos 6 caracteres.');
      return;
    }

    setMessage('Formulario listo. Conecta este submit a Firebase Auth para registro real.');
  };

  return (
    <div className="page-stack">
      <section className="panel share-hero">
        <p className="eyebrow">Registro</p>
        <h2>Crear una nueva cuenta</h2>
        <p>Este formulario es base UI. El siguiente paso es conectarlo a Firebase Authentication.</p>
      </section>

      <section className="panel">
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Nombre completo
            <input
              type="text"
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
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              placeholder="Minimo 6 caracteres"
            />
          </label>

          <button type="submit" className="primary-btn">
            Registrar usuario
          </button>

          {message && <p className="inline-note">{message}</p>}
        </form>
      </section>
    </div>
  );
}

export default RegisterPage;

