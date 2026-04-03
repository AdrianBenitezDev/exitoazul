import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  getShareErrorMessage,
  resolveSharedGalleryByToken,
} from '../features/share/share.service';
import {
  buildSharedFavoriteId,
  setSharedFavorite,
  subscribeSharedFavorites,
} from '../features/share/sharedFavorites.service';
import type { SharedGalleryResult, SharedImageView } from '../features/share/share.types';
import { firestoreDb } from '../lib/firebase';

type NoticeState = {
  tone: 'info' | 'success' | 'warning';
  message: string;
} | null;

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 4.2v9.6M8.7 10.8 12 14l3.3-3.2M5 17.2h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.6 7 19.3l1-5.6-4.1-4 5.6-.8L12 3.8z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SharedGalleryPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gallery, setGallery] = useState<SharedGalleryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState<boolean>(false);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
  const hasToken = Boolean(token?.trim());
  const safeToken = token?.trim() ?? '';
  const redirectTarget = safeToken ? `/s/${safeToken}` : '/';

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

  useEffect(() => {
    if (!expandedImageId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setExpandedImageId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedImageId]);

  useEffect(() => {
    if (!firestoreDb || !user) {
      setFavoriteKeys([]);
      return;
    }

    const unsubscribe = subscribeSharedFavorites(
      firestoreDb,
      user.uid,
      (nextFavoriteIds) => {
        setFavoriteKeys(nextFavoriteIds);
      },
      () => {
        setNotice({
          tone: 'warning',
          message: 'No se pudieron cargar los favoritos de tu cuenta.',
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      setShowAuthPrompt(false);
    }
  }, [user]);

  const expandedImage = useMemo(
    () => gallery?.images.find((image) => image.id === expandedImageId) ?? null,
    [gallery, expandedImageId],
  );

  const resolvedErrorMessage = hasToken ? errorMessage : 'Token compartido invalido.';
  const resolvedIsLoading = hasToken ? isLoading : false;

  const isImageFavorite = (imageId: string): boolean =>
    favoriteKeys.includes(buildSharedFavoriteId(safeToken, imageId));

  const toggleFavorite = async (image: SharedImageView): Promise<void> => {
    if (!user) {
      setShowAuthPrompt(true);
      setNotice({
        tone: 'info',
        message: 'Para guardar favoritos debes iniciar sesion o registrarte.',
      });
      return;
    }

    if (!firestoreDb) {
      setNotice({
        tone: 'warning',
        message: 'No se pudo sincronizar favoritos en este entorno.',
      });
      return;
    }

    const favoriteId = buildSharedFavoriteId(safeToken, image.id);
    const nextFavoriteState = !favoriteKeys.includes(favoriteId);

    try {
      await setSharedFavorite({
        db: firestoreDb,
        uid: user.uid,
        token: safeToken,
        image,
        isFavorite: nextFavoriteState,
      });

      setNotice({
        tone: 'success',
        message: nextFavoriteState
          ? 'Imagen guardada en favoritos.'
          : 'Imagen removida de favoritos.',
      });
    } catch {
      setNotice({
        tone: 'warning',
        message: 'No se pudo actualizar favoritos en este momento.',
      });
    }
  };

  const handleDownload = async (image: SharedImageView): Promise<void> => {
    setDownloadingImageId(image.id);

    try {
      const suggestedName = image.fileName.includes('.')
        ? image.fileName
        : `${image.fileName}.jpg`;
      const link = document.createElement('a');
      link.href = image.previewUrl;
      link.download = suggestedName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setNotice({
        tone: 'info',
        message: `Se abrio la descarga de ${suggestedName}.`,
      });
    } catch {
      setNotice({
        tone: 'warning',
        message: 'No se pudo descargar la imagen en este dispositivo.',
      });
    } finally {
      setDownloadingImageId(null);
    }
  };

  const renderExpandedActions = (image: SharedImageView) => {
    const favorite = isImageFavorite(image.id);
    const isDownloading = downloadingImageId === image.id;

    return (
      <div className="shared-preview-actions">
        <button
          type="button"
          className="primary-btn action-with-icon"
          onClick={() => {
            void handleDownload(image);
          }}
          disabled={isDownloading}
        >
          <DownloadIcon />
          <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
        </button>

        <button
          type="button"
          className={favorite ? 'secondary-btn action-with-icon favorite-chip active' : 'secondary-btn action-with-icon favorite-chip'}
          onClick={() => {
            void toggleFavorite(image);
          }}
        >
          <StarIcon filled={favorite} />
          <span>{favorite ? 'En favoritos' : 'Guardar favorito'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="page-stack">
      <section className="panel shared-gallery-panel">
        <div className="shared-gallery-head">
          <h3 className="shared-view-title">Vista Compartida</h3>
          {gallery && (
            <p className="inline-note">
              Seccion: <strong>{gallery.sectionName}</strong> | Link valido hasta:{' '}
              <strong>{formatDateTime(gallery.expiresAt)}</strong>
            </p>
          )}
        </div>

        <div className="shared-gallery-content">
          {resolvedIsLoading ? (
            <p className="empty-state">Validando token y cargando galeria compartida...</p>
          ) : resolvedErrorMessage ? (
            <p className="inline-note warning-note">{resolvedErrorMessage}</p>
          ) : (
            <>
              <div className="gallery-grid shared-gallery-grid">
                {(gallery?.images ?? []).map((image) => {
                  const favorite = isImageFavorite(image.id);
                  const isDownloading = downloadingImageId === image.id;

                  return (
                    <article key={image.id} className="image-card read-only shared-image-card">
                      <div className="image-stage">
                        <button
                          type="button"
                          className="image-preview-trigger"
                          onClick={() => {
                            setExpandedImageId(image.id);
                          }}
                          aria-label={`Ampliar ${image.fileName}`}
                        >
                          <img src={image.previewUrl} alt={image.fileName} loading="lazy" />
                        </button>
                      </div>

                      <div className="image-meta">
                        <h3>{image.fileName}</h3>
                        <p>{favorite ? 'Favorita en esta sesion' : 'Click para ampliar'}</p>
                      </div>

                      <div className="shared-card-actions">
                        <button
                          type="button"
                          className="secondary-btn action-with-icon"
                          onClick={() => {
                            void handleDownload(image);
                          }}
                          disabled={isDownloading}
                        >
                          <DownloadIcon />
                          <span>{isDownloading ? 'Descargando...' : 'Descargar'}</span>
                        </button>

                        <button
                          type="button"
                          className={favorite ? 'secondary-btn action-with-icon favorite-chip active' : 'secondary-btn action-with-icon favorite-chip'}
                          onClick={() => {
                            void toggleFavorite(image);
                          }}
                        >
                          <StarIcon filled={favorite} />
                          <span>{favorite ? 'Favorita' : 'Favorito'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {gallery && gallery.images.length === 0 && (
                <p className="empty-state">
                  Esta seccion no tiene imagenes disponibles en este momento.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {showAuthPrompt && !user && (
        <section className="panel shared-auth-panel">
          <p className="inline-note">
            Para guardar favoritos debes identificarte.
          </p>
          <div className="shared-auth-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                navigate('/login', { state: { from: redirectTarget } });
              }}
            >
              Ir a login
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                navigate(`/register?redirect=${encodeURIComponent(redirectTarget)}`);
              }}
            >
              Ir a registro
            </button>
          </div>
        </section>
      )}

      {notice && (
        <section className={`panel feedback-panel ${notice.tone}`}>
          <p>{notice.message}</p>
        </section>
      )}

      {expandedImage && (
        <div
          className="image-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista ampliada de ${expandedImage.fileName}`}
          onClick={() => {
            setExpandedImageId(null);
          }}
        >
          <div
            className="image-preview-dialog shared-preview-dialog"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="image-preview-close"
              onClick={() => {
                setExpandedImageId(null);
              }}
              aria-label="Cerrar vista ampliada"
            >
              Cerrar
            </button>

            <div className="image-preview-stage">
              <img src={expandedImage.previewUrl} alt={expandedImage.fileName} />
            </div>

            {renderExpandedActions(expandedImage)}

            {!user && (
              <p className="inline-note">
                Puedes descargar sin cuenta. Para favoritos necesitas{' '}
                <Link
                  className="text-link"
                  to="/login"
                  state={{ from: redirectTarget }}
                >
                  iniciar sesion
                </Link>{' '}
                o <Link className="text-link" to={`/register?redirect=${encodeURIComponent(redirectTarget)}`}>registrarte</Link>.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SharedGalleryPage;
