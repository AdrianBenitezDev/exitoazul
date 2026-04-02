import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getShareErrorMessage,
  resolveSharedGalleryByToken,
} from '../features/share/share.service';
import type { SharedGalleryResult } from '../features/share/share.types';

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);

function SharedGalleryPage() {
  const { token } = useParams();
  const [gallery, setGallery] = useState<SharedGalleryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const hasToken = Boolean(token?.trim());

  useEffect(() => {
    if (!token || !hasToken) {
      return;
    }

    let isMounted = true;

    void resolveSharedGalleryByToken(token)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setGallery(result);
        setErrorMessage('');
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setGallery(null);
        setErrorMessage(
          getShareErrorMessage(error, 'No se pudo resolver este link compartido.'),
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, hasToken]);

  const resolvedErrorMessage = hasToken ? errorMessage : 'Token compartido invalido.';
  const resolvedIsLoading = hasToken ? isLoading : false;

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
        {gallery && <p>Link valido hasta: {formatDateTime(gallery.expiresAt)}</p>}
      </section>

      <section className="panel">
        {resolvedIsLoading ? (
          <p className="empty-state">Validando token y cargando galeria compartida...</p>
        ) : resolvedErrorMessage ? (
          <p className="inline-note warning-note">{resolvedErrorMessage}</p>
        ) : (
          <>
            <p className="inline-note">
              Seccion: <strong>{gallery?.sectionName ?? 'Sin nombre'}</strong>
            </p>

            <div className="gallery-grid">
              {(gallery?.images ?? []).map((image) => (
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

            {gallery && gallery.images.length === 0 && (
              <p className="empty-state">
                Esta seccion no tiene imagenes disponibles en este momento.
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <p>
          Si el link vencio o fue revocado, el backend devuelve acceso denegado y no expone
          metadatos del resto de la cuenta.
        </p>
        <Link className="text-link" to="/">
          Volver al panel
        </Link>
      </section>
    </div>
  );
}

export default SharedGalleryPage;
