import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
import { firebaseIsConfigured } from '../config/env';
import type { GalleryImage, GallerySection } from '../features/gallery/gallery.types';
import {
  createUserSection,
  deleteUserImage,
  ensureDefaultSection,
  setUserImageFavorite,
  subscribeUserImages,
  subscribeUserSections,
  uploadImageForSection,
} from '../features/gallery/gallery.service';
import {
  createTemporaryShareLink,
  shareImageWithPolicy,
  shareTemporaryLink,
} from '../features/share/share.service';
import type { ShareLinkResult } from '../features/share/share.types';
import { firestoreDb, firebaseStorage } from '../lib/firebase';

type FeedbackState = {
  tone: 'info' | 'success' | 'warning';
  message: string;
} | null;

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);

const buildSourceFileFromUrl = async (
  imageUrl: string,
  baseFileName: string,
): Promise<File | undefined> => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return undefined;
    }

    const blob = await response.blob();
    const extension = blob.type.split('/')[1]?.split('+')[0] ?? 'jpg';
    const fileName = `${baseFileName}.${extension}`;

    return new File([blob], fileName, {
      type: blob.type || 'image/jpeg',
    });
  } catch {
    return undefined;
  }
};

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

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.5 7h15M9.5 7V5.6c0-.9.7-1.6 1.6-1.6h1.8c.9 0 1.6.7 1.6 1.6V7M8.2 10.2v7.5M12 10.2v7.5M15.8 10.2v7.5M7.4 20h9.2c.9 0 1.6-.7 1.6-1.6V7H5.8v11.4c0 .9.7 1.6 1.6 1.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const [sections, setSections] = useState<GallerySection[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [lastLink, setLastLink] = useState<ShareLinkResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    if (!firestoreDb || !user) {
      setSections([]);
      setImages([]);
      setSelectedSectionId('');
      setIsLoadingData(false);
      return;
    }

    let sectionsReady = false;
    let imagesReady = false;

    const markReady = (): void => {
      if (sectionsReady && imagesReady) {
        setIsLoadingData(false);
      }
    };

    setIsLoadingData(true);

    void ensureDefaultSection(firestoreDb, user.uid).catch(() => {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo crear la seccion inicial por defecto.',
      });
    });

    const unsubscribeSections = subscribeUserSections(
      firestoreDb,
      user.uid,
      (nextSections) => {
        setSections(nextSections);
        setSelectedSectionId((current) => {
          if (current && nextSections.some((section) => section.id === current)) {
            return current;
          }

          return nextSections[0]?.id ?? '';
        });

        sectionsReady = true;
        markReady();
      },
      () => {
        setFeedback({
          tone: 'warning',
          message: 'No se pudieron cargar las secciones desde Firestore.',
        });
        sectionsReady = true;
        markReady();
      },
    );

    const unsubscribeImages = subscribeUserImages(
      firestoreDb,
      user.uid,
      (nextImages) => {
        setImages(nextImages);
        imagesReady = true;
        markReady();
      },
      () => {
        setFeedback({
          tone: 'warning',
          message: 'No se pudieron cargar las imagenes desde Firestore.',
        });
        imagesReady = true;
        markReady();
      },
    );

    return () => {
      unsubscribeSections();
      unsubscribeImages();
    };
  }, [user]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  );

  const visibleImages = useMemo(
    () => images.filter((image) => image.sectionId === selectedSectionId),
    [images, selectedSectionId],
  );

  const countImagesBySection = (sectionId: string): number =>
    images.filter((image) => image.sectionId === sectionId).length;

  const handleCreateSection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!firestoreDb || !user) {
      setFeedback({
        tone: 'warning',
        message: 'No hay sesion valida para crear secciones.',
      });
      return;
    }

    const trimmedName = newSectionName.trim();
    if (!trimmedName) {
      setFeedback({
        tone: 'warning',
        message: 'Escribe un nombre valido para crear la seccion.',
      });
      return;
    }

    try {
      const sectionId = await createUserSection(firestoreDb, user.uid, trimmedName);
      setSelectedSectionId(sectionId);
      setNewSectionName('');
      setFeedback({
        tone: 'success',
        message: `Seccion creada: ${trimmedName}.`,
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo crear la seccion en Firestore.',
      });
    }
  };

  const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!firestoreDb || !firebaseStorage || !user || !selectedSection) {
      setFeedback({
        tone: 'warning',
        message: 'No hay contexto suficiente para subir imagen (sesion/seccion/firebase).',
      });
      return;
    }

    setIsUploading(true);

    try {
      const existingSectionImages = images.filter((image) => image.sectionId === selectedSection.id);

      const result = await uploadImageForSection({
        db: firestoreDb,
        storage: firebaseStorage,
        uid: user.uid,
        sectionId: selectedSection.id,
        sectionName: selectedSection.name,
        file,
        existingSectionImages,
      });

      setFeedback({
        tone: 'success',
        message: `Imagen subida correctamente con nombre automatico: ${result.fileName}.`,
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo subir la imagen a Storage/Firestore.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleFavorite = async (image: GalleryImage): Promise<void> => {
    if (!firestoreDb || !user) {
      return;
    }

    try {
      await setUserImageFavorite({
        db: firestoreDb,
        uid: user.uid,
        imageId: image.id,
        isFavorite: !image.isFavorite,
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo actualizar el estado de favorita.',
      });
    }
  };

  const handleDeleteImage = async (image: GalleryImage): Promise<void> => {
    if (!firestoreDb || !firebaseStorage || !user) {
      return;
    }

    try {
      await deleteUserImage({
        db: firestoreDb,
        storage: firebaseStorage,
        uid: user.uid,
        image,
      });
      setFeedback({
        tone: 'info',
        message: 'Imagen eliminada de Firestore y Storage.',
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo eliminar la imagen.',
      });
    }
  };

  const handleSectionShare = async (sectionId: string): Promise<void> => {
    const link = createTemporaryShareLink({
      targetType: 'section',
      targetId: sectionId,
      ttlHours: 24,
    });

    setLastLink(link);
    setIsSharing(true);

    try {
      await shareTemporaryLink(link);
      setFeedback({
        tone: 'success',
        message: `Link temporal enviado. Vence el ${formatDateTime(link.expiresAt)}.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setFeedback({
          tone: 'info',
          message: 'El envio se cancelo por el usuario.',
        });
      } else {
        setFeedback({
          tone: 'warning',
          message: 'No se pudo compartir el link temporal en este momento.',
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleImageShare = async (image: GalleryImage): Promise<void> => {
    const link = createTemporaryShareLink({
      targetType: 'image',
      targetId: image.id,
      ttlHours: 12,
    });

    setLastLink(link);
    setIsSharing(true);

    try {
      const sourceFile = await buildSourceFileFromUrl(image.previewUrl, image.fileName);

      const outcome = await shareImageWithPolicy({
        imageTitle: image.fileName,
        temporaryLink: link,
        sourceFile,
      });

      if (outcome.mode === 'direct-image') {
        setFeedback({
          tone: 'success',
          message: 'La imagen se envio de forma directa a la app seleccionada.',
        });
      } else {
        setFeedback({
          tone: 'info',
          message: `No hubo compatibilidad para archivo directo. Se envio link temporal (vence ${formatDateTime(
            link.expiresAt,
          )}).`,
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setFeedback({
          tone: 'info',
          message: 'El envio se cancelo por el usuario.',
        });
      } else {
        setFeedback({
          tone: 'warning',
          message: 'No fue posible compartir esta imagen ahora.',
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="panel status-grid">
        <article className="status-card">
          <h2>Estado Firebase</h2>
          <p>
            {firebaseIsConfigured
              ? 'Configuracion detectada. Ya puedes conectar Auth, Firestore y Storage.'
              : 'Falta configurar variables .env. Revisa .env.example para completar la conexion.'}
          </p>
        </article>

        <article className="status-card policy-card">
          <h2>Politica de seguridad</h2>
          <ul>
            <li>La web no ofrece descarga de imagenes.</li>
            <li>Si no hay envio directo, el fallback siempre es link temporal.</li>
            <li>Cada imagen recibe nombre automatico: seccion_numero.</li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Secciones</h2>
          <p>Crea nuevas secciones y comparte su galeria con un link temporal.</p>
        </div>

        <form className="section-form" onSubmit={(event) => void handleCreateSection(event)}>
          <input
            type="text"
            value={newSectionName}
            onChange={(event) => {
              setNewSectionName(event.target.value);
            }}
            placeholder="Ejemplo: Catalogo Mayo"
            aria-label="Nombre de nueva seccion"
            disabled={isLoadingData}
          />
          <button type="submit" className="primary-btn" disabled={isLoadingData}>
            Crear seccion
          </button>
        </form>

        <div className="section-grid">
          {sections.map((section) => (
            <article key={section.id} className="section-card">
              <button
                type="button"
                className={selectedSectionId === section.id ? 'ghost-btn active' : 'ghost-btn'}
                onClick={() => setSelectedSectionId(section.id)}
              >
                {section.name}
              </button>
              <p>{countImagesBySection(section.id)} imagenes</p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  void handleSectionShare(section.id);
                }}
                disabled={isSharing}
              >
                Compartir seccion
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head with-actions">
          <div>
            <h2>Imagenes de la seccion</h2>
            <p>Persistencia real con Firestore/Storage y acciones flotantes por imagen.</p>
          </div>

          <label className={isUploading ? 'secondary-btn file-upload-btn disabled' : 'secondary-btn file-upload-btn'}>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleUploadImage(event);
              }}
              disabled={isUploading || !selectedSection}
            />
            {isUploading ? 'Subiendo...' : 'Subir imagen'}
          </label>
        </div>

        {isLoadingData ? (
          <p className="empty-state">Cargando datos de tu galeria...</p>
        ) : (
          <>
            <div className="gallery-grid">
              {visibleImages.map((image) => (
                <article key={image.id} className="image-card">
                  <div className="image-stage">
                    <img src={image.previewUrl} alt={image.fileName} loading="lazy" />

                    <div className="image-float-actions">
                      <button
                        type="button"
                        className={image.isFavorite ? 'icon-btn favorite-active' : 'icon-btn'}
                        aria-label={
                          image.isFavorite
                            ? 'Quitar imagen de favoritas'
                            : 'Agregar imagen a favoritas'
                        }
                        onClick={() => {
                          void handleToggleFavorite(image);
                        }}
                      >
                        <StarIcon filled={image.isFavorite} />
                      </button>

                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label="Eliminar imagen"
                        onClick={() => {
                          void handleDeleteImage(image);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  <div className="image-meta">
                    <h3>{image.fileName}</h3>
                    <p>{image.isFavorite ? 'Favorita activa' : 'Sin marcar como favorita'}</p>
                  </div>

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      void handleImageShare(image);
                    }}
                    disabled={isSharing}
                  >
                    Compartir ahora
                  </button>
                </article>
              ))}
            </div>

            {visibleImages.length === 0 && (
              <p className="empty-state">
                Esta seccion no tiene imagenes. Usa "Subir imagen" para guardar la primera.
              </p>
            )}
          </>
        )}
      </section>

      {feedback && (
        <section className={`panel feedback-panel ${feedback.tone}`}>
          <p>{feedback.message}</p>
          {lastLink && (
            <p>
              Link actual:{' '}
              <a href={lastLink.url} className="text-link" target="_blank" rel="noreferrer">
                {lastLink.url}
              </a>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default DashboardPage;
