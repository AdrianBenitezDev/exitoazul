import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
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
  getShareErrorMessage,
  revokeTemporaryShareLink,
  shareFilesDirect,
  shareTemporaryLink,
  shareTemporaryLinks,
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

function ShareLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M10 8.4 8.3 10a3 3 0 0 0 0 4.3 3 3 0 0 0 4.3 0l1.7-1.6M14 15.6l1.7-1.6a3 3 0 0 0 0-4.3 3 3 0 0 0-4.3 0L9.7 11.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m12 16.5V6.5M8.8 9.8 12 6.5l3.2 3.3M5 18.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={
          direction === 'left'
            ? 'm14.8 5.5-6.1 6.5 6.1 6.5'
            : 'm9.2 5.5 6.1 6.5-6.1 6.5'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  const [isRevokingLink, setIsRevokingLink] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [expandedImageSource, setExpandedImageSource] = useState<'section' | 'selected'>('section');
  const [isCreateSectionModalOpen, setIsCreateSectionModalOpen] = useState<boolean>(false);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
  const [loadedCardImageIds, setLoadedCardImageIds] = useState<Record<string, boolean>>({});

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
          message: 'No se pudieron cargar las secciones.',
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
          message: 'No se pudieron cargar las imagenes.',
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

  const expandedImage = useMemo(
    () => images.find((image) => image.id === expandedImageId) ?? null,
    [images, expandedImageId],
  );

  useEffect(() => {
    const visibleIds = new Set(visibleImages.map((image) => image.id));
    setSelectedImageIds((current) => current.filter((imageId) => visibleIds.has(imageId)));
    setLoadedCardImageIds((current) => {
      const nextLoaded: Record<string, boolean> = {};

      visibleImages.forEach((image) => {
        if (current[image.id]) {
          nextLoaded[image.id] = true;
        }
      });

      return nextLoaded;
    });
  }, [visibleImages]);

  useEffect(() => {
    if (!expandedImage) {
      return;
    }

    if (expandedImage.sectionId !== selectedSectionId) {
      setExpandedImageId(null);
    }
  }, [expandedImage, selectedSectionId]);

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
    if (!isCreateSectionModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsCreateSectionModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateSectionModalOpen]);

  const selectedVisibleImages = useMemo(
    () => visibleImages.filter((image) => selectedImageIds.includes(image.id)),
    [visibleImages, selectedImageIds],
  );

  const expandedImagePool = useMemo(() => {
    if (
      expandedImageSource === 'selected' &&
      selectedVisibleImages.length > 0 &&
      expandedImageId &&
      selectedVisibleImages.some((image) => image.id === expandedImageId)
    ) {
      return selectedVisibleImages;
    }

    return visibleImages;
  }, [expandedImageSource, selectedVisibleImages, visibleImages, expandedImageId]);

  const expandedImageInPool = useMemo(
    () => expandedImagePool.find((image) => image.id === expandedImageId) ?? null,
    [expandedImagePool, expandedImageId],
  );

  const expandedImageIndex = useMemo(
    () => expandedImagePool.findIndex((image) => image.id === expandedImageId),
    [expandedImagePool, expandedImageId],
  );

  const canGoToPrevImage = expandedImageIndex > 0;
  const canGoToNextImage =
    expandedImageIndex >= 0 && expandedImageIndex < expandedImagePool.length - 1;

  const countImagesBySection = (sectionId: string): number =>
    images.filter((image) => image.sectionId === sectionId).length;

  const markCardImageAsLoaded = (imageId: string): void => {
    setLoadedCardImageIds((current) => {
      if (current[imageId]) {
        return current;
      }

      return {
        ...current,
        [imageId]: true,
      };
    });
  };

  const openImagePreview = (imageId: string): void => {
    const isInSelection = selectedVisibleImages.some((image) => image.id === imageId);
    setExpandedImageSource(isInSelection ? 'selected' : 'section');
    setExpandedImageId(imageId);
  };

  const moveExpandedImage = useCallback(
    (direction: 'prev' | 'next'): void => {
      if (expandedImageIndex < 0) {
        return;
      }

      const nextIndex = direction === 'prev' ? expandedImageIndex - 1 : expandedImageIndex + 1;
      const targetImage = expandedImagePool[nextIndex];

      if (!targetImage) {
        return;
      }

      setExpandedImageId(targetImage.id);
    },
    [expandedImageIndex, expandedImagePool],
  );

  const handleToggleImageSelection = (imageId: string): void => {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((currentId) => currentId !== imageId)
        : [...current, imageId],
    );
  };

  const handleToggleSelectAllVisible = (): void => {
    if (selectedVisibleImages.length === visibleImages.length && visibleImages.length > 0) {
      setSelectedImageIds([]);
      return;
    }

    setSelectedImageIds(visibleImages.map((image) => image.id));
  };

  useEffect(() => {
    if (!expandedImageId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft' && canGoToPrevImage) {
        event.preventDefault();
        moveExpandedImage('prev');
        return;
      }

      if (event.key === 'ArrowRight' && canGoToNextImage) {
        event.preventDefault();
        moveExpandedImage('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedImageId, canGoToPrevImage, canGoToNextImage, moveExpandedImage]);

  const createLinksForImages = async (selectedImages: GalleryImage[]): Promise<ShareLinkResult[]> =>
    Promise.all(
      selectedImages.map((image) =>
        createTemporaryShareLink({
          targetType: 'image',
          targetId: image.id,
          ttlHours: 12,
        }),
      ),
    );

  const handleCreateSection = async (): Promise<void> => {
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
      setIsCreateSectionModalOpen(false);
      setFeedback({
        tone: 'success',
        message: `Seccion creada: ${trimmedName}.`,
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo crear la seccion.',
      });
    }
  };

  const handleCreateSectionSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleCreateSection();
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
        message: 'No hay contexto suficiente para subir imagen.',
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
        message: 'No se pudo subir la imagen.',
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
      if (expandedImageId === image.id) {
        setExpandedImageId(null);
      }
      setFeedback({
        tone: 'info',
        message: 'Imagen eliminada correctamente.',
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo eliminar la imagen.',
      });
    }
  };

  const handleDownloadImage = async (image: GalleryImage): Promise<void> => {
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

      setFeedback({
        tone: 'info',
        message: `Descarga iniciada para ${suggestedName}.`,
      });
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudo descargar la imagen en este dispositivo.',
      });
    } finally {
      setDownloadingImageId(null);
    }
  };

  const renderImageActionButtons = (
    image: GalleryImage,
    className: string = 'image-float-actions',
  ) => {
    const isDownloading = downloadingImageId === image.id;
    const favoriteTooltip = image.isFavorite ? 'quitar de favoritos' : 'agregar a favoritos';

    return (
      <div className={className}>
        <button
          type="button"
          className="icon-btn download-action"
          aria-label="Descargar imagen"
          onClick={() => {
            void handleDownloadImage(image);
          }}
          disabled={isDownloading}
        >
          <DownloadIcon />
          <span className="icon-btn-tooltip">descargar</span>
        </button>

        <button
          type="button"
          className="icon-btn share-link"
          aria-label="Compartir imagen por link"
          onClick={() => {
            void handleImageShareLink(image);
          }}
          disabled={isSharing}
        >
          <ShareLinkIcon />
          <span className="icon-btn-tooltip">compartir</span>
        </button>

        <button
          type="button"
          className={image.isFavorite ? 'icon-btn favorite-active' : 'icon-btn'}
          aria-label={image.isFavorite ? 'Quitar imagen de favoritas' : 'Agregar imagen a favoritas'}
          onClick={() => {
            void handleToggleFavorite(image);
          }}
        >
          <StarIcon filled={image.isFavorite} />
          <span className="icon-btn-tooltip">{favoriteTooltip}</span>
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
          <span className="icon-btn-tooltip">eliminar</span>
        </button>
      </div>
    );
  };

  const handleSectionShare = async (sectionId: string): Promise<void> => {
    setIsSharing(true);

    try {
      const link = await createTemporaryShareLink({
        targetType: 'section',
        targetId: sectionId,
        ttlHours: 24,
      });

      setLastLink(link);
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
          message: getShareErrorMessage(error, 'No se pudo compartir el link temporal en este momento.'),
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleImageShareLink = async (image: GalleryImage): Promise<void> => {
    setIsSharing(true);

    try {
      const link = await createTemporaryShareLink({
        targetType: 'image',
        targetId: image.id,
        ttlHours: 12,
      });

      setLastLink(link);
      await shareTemporaryLink(link);
      setFeedback({
        tone: 'success',
        message: `Link temporal enviado para ${image.fileName}. Vence el ${formatDateTime(link.expiresAt)}.`,
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
          message: getShareErrorMessage(error, 'No se pudo compartir el link de esta imagen.'),
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareSelectedLinks = async (): Promise<void> => {
    if (selectedVisibleImages.length === 0) {
      setFeedback({
        tone: 'warning',
        message: 'Selecciona al menos una imagen para compartir por link.',
      });
      return;
    }

    setIsSharing(true);

    try {
      const links = await createLinksForImages(selectedVisibleImages);
      setLastLink(links[links.length - 1] ?? null);
      await shareTemporaryLinks(links);
      setFeedback({
        tone: 'success',
        message: `Se compartieron ${links.length} links temporales para imagenes seleccionadas.`,
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
          message: getShareErrorMessage(error, 'No se pudieron compartir los links seleccionados.'),
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareSelectedFiles = async (): Promise<void> => {
    if (selectedVisibleImages.length === 0) {
      setFeedback({
        tone: 'warning',
        message: 'Selecciona al menos una imagen para compartir como archivo.',
      });
      return;
    }

    setIsSharing(true);

    try {
      const filesWithUndefined = await Promise.all(
        selectedVisibleImages.map((image) => buildSourceFileFromUrl(image.previewUrl, image.fileName)),
      );
      const files = filesWithUndefined.filter((file): file is File => file instanceof File);

      const directShared = await shareFilesDirect({
        title: 'Exito Azul',
        text: `${files.length} imagen(es) compartidas desde Exito Azul`,
        files,
      });

      if (directShared) {
        setLastLink(null);
        setFeedback({
          tone: 'success',
          message: `Se compartieron ${files.length} imagen(es) como archivo adjunto.`,
        });
      } else {
        const links = await createLinksForImages(selectedVisibleImages);
        setLastLink(links[links.length - 1] ?? null);
        await shareTemporaryLinks(links);
        setFeedback({
          tone: 'info',
          message: `No hubo compatibilidad para compartir archivos. Se enviaron ${links.length} links temporales.`,
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
          message: getShareErrorMessage(error, 'No fue posible compartir las imagenes seleccionadas.'),
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeLastLink = async (): Promise<void> => {
    if (!lastLink) {
      return;
    }

    setIsRevokingLink(true);

    try {
      const revoked = await revokeTemporaryShareLink(lastLink.token);

      if (revoked) {
        setFeedback({
          tone: 'success',
          message: 'El link temporal fue revocado correctamente.',
        });
      } else {
        setFeedback({
          tone: 'warning',
          message: 'No fue posible confirmar la revocacion del link.',
        });
      }
    } catch (error) {
      setFeedback({
        tone: 'warning',
        message: getShareErrorMessage(error, 'No se pudo revocar el link temporal.'),
      });
    } finally {
      setIsRevokingLink(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-head">
          <h2>Secciones</h2>
          <p>Crea nuevas secciones y comparte su galeria con un link temporal.</p>
        </div>

        <div className="category-strip-shell">
          <span className="category-strip-label">categorias</span>
          <div className="category-strip-scroll" role="list" aria-label="Categorias disponibles">
            <button
              type="button"
              className="category-add-card"
              onClick={() => setIsCreateSectionModalOpen(true)}
              aria-label="Agregar nueva categoria"
            >
              <span className="category-add-plus">+</span>
              <span>Agregar</span>
            </button>

            {sections.map((section) => (
              <article key={section.id} className="category-card" role="listitem">
                <button
                  type="button"
                  className={
                    selectedSectionId === section.id
                      ? 'category-select-btn active'
                      : 'category-select-btn'
                  }
                  onClick={() => setSelectedSectionId(section.id)}
                >
                  {section.name}
                </button>
                <span className="category-count">{countImagesBySection(section.id)} imagenes</span>
                <button
                  type="button"
                  className="secondary-btn category-share-btn"
                  onClick={() => {
                    void handleSectionShare(section.id);
                  }}
                  disabled={isSharing}
                >
                  Compartir
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {isCreateSectionModalOpen && (
        <div
          className="category-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Crear nueva categoria"
          onClick={() => {
            setIsCreateSectionModalOpen(false);
          }}
        >
          <div
            className="category-modal-card"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="category-modal-close"
              aria-label="Cerrar modal de categoria"
              onClick={() => {
                setIsCreateSectionModalOpen(false);
              }}
            >
              x
            </button>

            <h3>Nueva categoria</h3>

            <form className="category-modal-form" onSubmit={handleCreateSectionSubmit}>
              <input
                type="text"
                value={newSectionName}
                onChange={(event) => {
                  setNewSectionName(event.target.value);
                }}
                placeholder="Ejemplo: Favoritas"
                aria-label="Nombre de categoria"
                disabled={isLoadingData}
                autoFocus
              />
              <button type="submit" className="primary-btn" disabled={isLoadingData}>
                Agregar
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="panel">
        <div className="panel-head with-actions">
          <div>
            <h3>{selectedSection?.name ?? 'favoritos'}</h3>
          </div>

          <div className="image-panel-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleToggleSelectAllVisible}
              disabled={isLoadingData || visibleImages.length === 0}
            >
              {selectedVisibleImages.length === visibleImages.length && visibleImages.length > 0
                ? 'Limpiar seleccion'
                : 'Seleccionar todas'}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                void handleShareSelectedLinks();
              }}
              disabled={isSharing || selectedVisibleImages.length === 0}
            >
              Compartir seleccion por link
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                void handleShareSelectedFiles();
              }}
              disabled={isSharing || selectedVisibleImages.length === 0}
            >
              Compartir seleccion por archivo
            </button>
          </div>
        </div>

        <div className="upload-full-width-zone">
          <label
            className={
              isUploading || !selectedSection
                ? 'upload-circle-trigger disabled'
                : 'upload-circle-trigger'
            }
          >
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleUploadImage(event);
              }}
              disabled={isUploading || !selectedSection}
            />
            <span className="upload-circle-icon" aria-hidden="true">
              <UploadIcon />
            </span>
            <span className="upload-hover-text">
              {isUploading ? 'subiendo imagen' : 'subir imagen'}
            </span>
          </label>
        </div>

        {isLoadingData ? (
          <p className="empty-state">Cargando datos de tu galeria...</p>
        ) : (
          <>
            {visibleImages.length > 0 && (
              <p className="inline-note">
                {selectedVisibleImages.length === 0
                  ? 'Selecciona imagenes para compartir en lote.'
                  : `${selectedVisibleImages.length} imagen(es) seleccionadas para compartir.`}
              </p>
            )}

            <div className="gallery-grid">
              {visibleImages.map((image) => (
                <article key={image.id} className="image-card">
                  <div className="image-stage">
                    <button
                      type="button"
                      className={
                        loadedCardImageIds[image.id]
                          ? 'image-preview-trigger image-ready'
                          : 'image-preview-trigger image-loading'
                      }
                      onClick={() => {
                        openImagePreview(image.id);
                      }}
                      aria-label={`Ampliar ${image.fileName}`}
                    >
                      <img
                        src={image.previewUrl}
                        alt={image.fileName}
                        loading="lazy"
                        decoding="async"
                        className={
                          loadedCardImageIds[image.id]
                            ? 'progressive-image is-ready'
                            : 'progressive-image'
                        }
                        onLoad={() => {
                          markCardImageAsLoaded(image.id);
                        }}
                      />
                    </button>

                    <label className="image-select-chip">
                      <input
                        type="checkbox"
                        checked={selectedImageIds.includes(image.id)}
                        onChange={() => handleToggleImageSelection(image.id)}
                        aria-label={`Seleccionar ${image.fileName}`}
                      />
                      <span>Seleccionar</span>
                    </label>

                    {renderImageActionButtons(image)}
                  </div>

                  <div className="image-meta">
                    <h3>{image.fileName}</h3>
                    <p>{image.isFavorite ? 'Favorita activa' : 'Sin marcar como favorita'}</p>
                  </div>
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

      {expandedImageInPool && (
        <div
          className="image-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista ampliada de ${expandedImageInPool.fileName}`}
          onClick={() => {
            setExpandedImageId(null);
          }}
        >
          <div
            className="image-preview-dialog"
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
              <img src={expandedImageInPool.previewUrl} alt={expandedImageInPool.fileName} />
              <button
                type="button"
                className="overlay-nav-btn prev"
                onClick={() => moveExpandedImage('prev')}
                disabled={!canGoToPrevImage}
                aria-label="Imagen anterior"
              >
                <ChevronIcon direction="left" />
              </button>
              <button
                type="button"
                className="overlay-nav-btn next"
                onClick={() => moveExpandedImage('next')}
                disabled={!canGoToNextImage}
                aria-label="Imagen siguiente"
              >
                <ChevronIcon direction="right" />
              </button>
              {renderImageActionButtons(expandedImageInPool, 'image-preview-actions')}
            </div>

            <div className="image-preview-meta">
              <h3>{expandedImageInPool.fileName}</h3>
              <p>
                {expandedImageInPool.isFavorite
                  ? 'Favorita activa'
                  : 'Sin marcar como favorita'}
              </p>
              <p className="image-preview-position">
                {expandedImageIndex + 1} / {expandedImagePool.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <section className={`panel feedback-panel ${feedback.tone}`}>
          <p>{feedback.message}</p>
          {lastLink && (
            <>
              <p>
                Link actual:{' '}
                <a href={lastLink.url} className="text-link" target="_blank" rel="noreferrer">
                  {lastLink.url}
                </a>
              </p>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  void handleRevokeLastLink();
                }}
                disabled={isRevokingLink}
              >
                {isRevokingLink ? 'Revocando link...' : 'Revocar link actual'}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export default DashboardPage;
