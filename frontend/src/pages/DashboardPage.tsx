import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { firebaseIsConfigured } from '../config/env';
import type { GalleryImage, GallerySection } from '../features/gallery/gallery.types';
import {
  buildAutoImageName,
  getNextImageSequence,
  toSectionSlug,
} from '../features/gallery/naming';
import { initialGalleryImages, initialGallerySections } from '../features/gallery/mockData';
import {
  createTemporaryShareLink,
  shareImageWithPolicy,
  shareTemporaryLink,
} from '../features/share/share.service';
import type { ShareLinkResult } from '../features/share/share.types';

type FeedbackState = {
  tone: 'info' | 'success' | 'warning';
  message: string;
} | null;

const DEMO_IMAGE_IDS = [1011, 1020, 1033, 1041, 1060, 1074, 1082, 1084, 1081, 1080, 1057];

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);

const buildSectionId = (sectionName: string, sections: GallerySection[]): string => {
  const baseId = toSectionSlug(sectionName);
  let candidate = baseId;
  let suffix = 2;

  while (sections.some((section) => section.id === candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const buildImageId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `img-${crypto.randomUUID()}`;
  }

  return `img-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const pickPreviewUrl = (indexSeed: number): string => {
  const id = DEMO_IMAGE_IDS[indexSeed % DEMO_IMAGE_IDS.length];
  return `https://picsum.photos/id/${id}/700/520`;
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
  const [sections, setSections] = useState<GallerySection[]>(initialGallerySections);
  const [images, setImages] = useState<GalleryImage[]>(initialGalleryImages);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(initialGallerySections[0]?.id ?? '');
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [lastLink, setLastLink] = useState<ShareLinkResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSharing, setIsSharing] = useState<boolean>(false);

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

  const handleCreateSection = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedName = newSectionName.trim();
    if (!trimmedName) {
      setFeedback({
        tone: 'warning',
        message: 'Escribe un nombre valido para crear la seccion.',
      });
      return;
    }

    const nextSection: GallerySection = {
      id: buildSectionId(trimmedName, sections),
      name: trimmedName,
    };

    setSections((prev) => [...prev, nextSection]);
    setSelectedSectionId(nextSection.id);
    setNewSectionName('');
    setFeedback({
      tone: 'success',
      message: `Seccion creada: ${nextSection.name}.`,
    });
  };

  const handleCreateAutoImage = (): void => {
    if (!selectedSection) {
      setFeedback({
        tone: 'warning',
        message: 'Selecciona una seccion antes de crear una imagen.',
      });
      return;
    }

    const nextSequence = getNextImageSequence(images, selectedSection.name);
    const fileName = buildAutoImageName(selectedSection.name, nextSequence);

    const nextImage: GalleryImage = {
      id: buildImageId(),
      fileName,
      sectionId: selectedSection.id,
      previewUrl: pickPreviewUrl(images.length),
      isFavorite: false,
    };

    setImages((prev) => [nextImage, ...prev]);
    setFeedback({
      tone: 'success',
      message: `Imagen creada con nombre automatico: ${fileName}.`,
    });
  };

  const handleToggleFavorite = (imageId: string): void => {
    setImages((prev) =>
      prev.map((image) =>
        image.id === imageId ? { ...image, isFavorite: !image.isFavorite } : image,
      ),
    );
  };

  const handleDeleteImage = (imageId: string): void => {
    setImages((prev) => prev.filter((image) => image.id !== imageId));
    setFeedback({
      tone: 'info',
      message: 'Imagen eliminada de la galeria.',
    });
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
      const outcome = await shareImageWithPolicy({
        imageTitle: image.fileName,
        temporaryLink: link,
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

        <form className="section-form" onSubmit={handleCreateSection}>
          <input
            type="text"
            value={newSectionName}
            onChange={(event) => {
              setNewSectionName(event.target.value);
            }}
            placeholder="Ejemplo: Catalogo Mayo"
            aria-label="Nombre de nueva seccion"
          />
          <button type="submit" className="primary-btn">
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
            <p>Cards compactas con acciones flotantes en la esquina superior derecha.</p>
          </div>

          <button type="button" className="secondary-btn" onClick={handleCreateAutoImage}>
            Agregar imagen auto
          </button>
        </div>

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
                      image.isFavorite ? 'Quitar imagen de favoritas' : 'Agregar imagen a favoritas'
                    }
                    onClick={() => {
                      handleToggleFavorite(image.id);
                    }}
                  >
                    <StarIcon filled={image.isFavorite} />
                  </button>

                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Eliminar imagen"
                    onClick={() => {
                      handleDeleteImage(image.id);
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
            Esta seccion no tiene imagenes. Usa "Agregar imagen auto" para crear la primera.
          </p>
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

