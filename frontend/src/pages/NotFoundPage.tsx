import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="panel">
      <h2>Ruta no encontrada</h2>
      <p>La pagina solicitada no existe o el link ya no es valido.</p>
      <Link className="text-link" to="/">
        Volver al inicio
      </Link>
    </section>
  );
}

export default NotFoundPage;
