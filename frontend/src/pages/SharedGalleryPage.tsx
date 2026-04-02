import { Link, useParams } from 'react-router-dom';
import { initialGalleryImages } from '../features/gallery/mockData';

function SharedGalleryPage() {
  const { token } = useParams();

  return (
    <div className="page-stack">
      <section className="panel share-hero">
        <p className="eyebrow">Vista compartida</p>
        <h2>Acceso temporal a una galeria puntual</h2>
        <p>
          Token recibido: <code>{token ?? 'sin-token'}</code>
        </p>
        <p>
          Esta vista es solo lectura. No hay acceso al resto de secciones y no existe opcion de
          descarga.
        </p>
      </section>

      <section className="panel">
        <div className="gallery-grid">
          {initialGalleryImages.slice(0, 4).map((image) => (
            <article key={image.id} className="image-card read-only">
              <div className="image-stage">
                <img src={image.previewUrl} alt={image.fileName} loading="lazy" />
              </div>
              <div className="image-meta">
                <h3>{image.fileName}</h3>
                <p>Solo visualizacion temporal</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <p>
          Si el link vencio o fue revocado, el backend debe devolver acceso denegado y no exponer
          metadatos.
        </p>
        <Link className="text-link" to="/">
          Volver al panel
        </Link>
      </section>
    </div>
  );
}

export default SharedGalleryPage;
