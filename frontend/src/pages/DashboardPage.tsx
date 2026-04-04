import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
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
import { buildAutoImageName, getNextImageSequence } from '../features/gallery/naming';
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

type PendingUploadCard = {
  id: string;
  sectionId: string;
  fileName: string;
};

type CameraFilterId = 'none' | 'vivid' | 'mono' | 'warm' | 'cool';

type CameraDraft = {
  file: File;
  previewUrl: string;
  // Extension point for future Instagram-like pipeline.
  filterPreset: CameraFilterId;
};

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);

const cameraFilterOptions: Array<{ id: CameraFilterId; label: string; cssFilter: string }> = [
  { id: 'none', label: 'Normal', cssFilter: 'none' },
  { id: 'vivid', label: 'Vivo', cssFilter: 'saturate(1.25) contrast(1.08)' },
  { id: 'mono', label: 'B/N', cssFilter: 'grayscale(1) contrast(1.05)' },
  { id: 'warm', label: 'Calido', cssFilter: 'sepia(0.24) saturate(1.2) hue-rotate(-12deg)' },
  { id: 'cool', label: 'Frio', cssFilter: 'saturate(1.08) hue-rotate(16deg) brightness(1.02)' },
];

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

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 8.2h2.1l1.1-1.8h5.6l1.1 1.8H18a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.4a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.2" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
  const [pendingUploadCards, setPendingUploadCards] = useState<PendingUploadCard[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [expandedImageSource, setExpandedImageSource] = useState<'section' | 'selected'>('section');
  const [isCreateSectionModalOpen, setIsCreateSectionModalOpen] = useState<boolean>(false);
  const [isCreatingSection, setIsCreatingSection] = useState<boolean>(false);
  const [pendingSectionName, setPendingSectionName] = useState<string | null>(null);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
  const [loadedCardImageIds, setLoadedCardImageIds] = useState<Record<string, boolean>>({});
  const [cameraDraft, setCameraDraft] = useState<CameraDraft | null>(null);
  const [selectedCameraFilter, setSelectedCameraFilter] = useState<CameraFilterId>('none');
  const [isCameraLiveOpen, setIsCameraLiveOpen] = useState<boolean>(false);
  const [isCameraStarting, setIsCameraStarting] = useState<boolean>(false);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState<boolean>(false);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string>('');
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryPickerInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

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
  const visiblePendingUploadCards = pendingUploadCards.filter(
    (pendingCard) => pendingCard.sectionId === selectedSectionId,
  );

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

  const createLinksForImages = async (
    selectedImages: GalleryImage[],
  ): Promise<{ links: ShareLinkResult[]; failedCount: number }> => {
    const results = await Promise.allSettled(
      selectedImages.map((image) =>
        createTemporaryShareLink({
          targetType: 'image',
          targetId: image.id,
          ttlHours: 12,
        }),
      ),
    );

    const links: ShareLinkResult[] = [];
    let failedCount = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        links.push(result.value);
        return;
      }

      failedCount += 1;
    });

    return {
      links,
      failedCount,
    };
  };

  const revokeLinksBestEffort = async (links: ShareLinkResult[]): Promise<number> => {
    const results = await Promise.allSettled(
      links.map((link) => revokeTemporaryShareLink(link.token)),
    );

    return results.filter(
      (result) => result.status === 'fulfilled' && result.value === true,
    ).length;
  };

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

    setIsCreatingSection(true);
    setPendingSectionName(trimmedName);
    setIsCreateSectionModalOpen(false);

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
        message: 'No se pudo crear la seccion.',
      });
    } finally {
      setIsCreatingSection(false);
      setPendingSectionName(null);
    }
  };

  const handleCreateSectionSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleCreateSection();
  };

  const selectedCameraFilterConfig = useMemo(
    () =>
      cameraFilterOptions.find((filterOption) => filterOption.id === selectedCameraFilter) ??
      cameraFilterOptions[0],
    [selectedCameraFilter],
  );

  const clearCameraDraft = useCallback((): void => {
    setCameraDraft((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });

    if (cameraCaptureInputRef.current) {
      cameraCaptureInputRef.current.value = '';
    }

    if (galleryPickerInputRef.current) {
      galleryPickerInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cameraDraft?.previewUrl) {
        URL.revokeObjectURL(cameraDraft.previewUrl);
      }
    };
  }, [cameraDraft?.previewUrl]);

  const stopLiveCameraStream = useCallback((): void => {
    const activeStream = cameraStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        track.stop();
      });
      cameraStreamRef.current = null;
    }

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }

    setIsCameraLiveOpen(false);
    setIsCameraStarting(false);
    setIsCapturingPhoto(false);
  }, []);

  useEffect(() => {
    return () => {
      stopLiveCameraStream();
    };
  }, [stopLiveCameraStream]);

  const createCameraDraftFromFile = useCallback(
    (capturedFile: File, filterPreset: CameraFilterId): void => {
      if (!capturedFile.type.startsWith('image/')) {
        setFeedback({
          tone: 'warning',
          message: 'Solo se permiten archivos de imagen.',
        });
        return;
      }

      const previewUrl = URL.createObjectURL(capturedFile);
      setCameraDraft((current) => {
        if (current?.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return {
          file: capturedFile,
          previewUrl,
          filterPreset,
        };
      });
    },
    [],
  );

  const drawDraftIntoCanvas = useCallback((): void => {
    if (!cameraDraft || !cameraCanvasRef.current) {
      return;
    }

    const canvas = cameraCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(viewportWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewportHeight * pixelRatio));
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, viewportWidth, viewportHeight);

      // Draw in "cover" mode so the captured frame fills the full-screen canvas.
      const imageRatio = image.width / image.height;
      const viewportRatio = viewportWidth / viewportHeight;
      let drawWidth = viewportWidth;
      let drawHeight = viewportHeight;
      let drawX = 0;
      let drawY = 0;

      if (imageRatio > viewportRatio) {
        drawHeight = viewportHeight;
        drawWidth = viewportHeight * imageRatio;
        drawX = (viewportWidth - drawWidth) / 2;
      } else {
        drawWidth = viewportWidth;
        drawHeight = viewportWidth / imageRatio;
        drawY = (viewportHeight - drawHeight) / 2;
      }

      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    };
    image.src = cameraDraft.previewUrl;
  }, [cameraDraft]);

  useEffect(() => {
    if (!cameraDraft) {
      return;
    }

    drawDraftIntoCanvas();
    const handleResize = (): void => {
      drawDraftIntoCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [cameraDraft, drawDraftIntoCanvas]);

  const startLiveCamera = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      return false;
    }

    try {
      setIsCameraStarting(true);
      setCameraErrorMessage('');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setIsCameraLiveOpen(true);
      setIsCameraStarting(false);
      return true;
    } catch {
      setIsCameraStarting(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isCameraLiveOpen || !cameraVideoRef.current || !cameraStreamRef.current) {
      return;
    }

    const video = cameraVideoRef.current;
    video.srcObject = cameraStreamRef.current;
    void video.play().catch(() => undefined);

    return () => {
      video.srcObject = null;
    };
  }, [isCameraLiveOpen]);

  const uploadSelectedFiles = async (selectedFiles: File[]): Promise<void> => {
    if (selectedFiles.length === 0) {
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

    const existingSectionImages = images.filter((image) => image.sectionId === selectedSection.id);
    const estimatedSectionImages: GalleryImage[] = [...existingSectionImages];
    const nextPendingCards: PendingUploadCard[] = selectedFiles.map((_, index) => {
      const nextSequence = getNextImageSequence(estimatedSectionImages, selectedSection.name);
      const predictedName = buildAutoImageName(selectedSection.name, nextSequence);

      estimatedSectionImages.push({
        id: `pending-seq-${Date.now()}-${index}`,
        fileName: predictedName,
        sectionId: selectedSection.id,
        previewUrl: '',
        isFavorite: false,
      });

      return {
        id: `pending-upload-${Date.now()}-${index}`,
        sectionId: selectedSection.id,
        fileName: predictedName,
      };
    });

    setPendingUploadCards(nextPendingCards);

    try {
      let uploadFailures = 0;
      const uploadedFileNames: string[] = [];
      let sectionImagesForSequence: GalleryImage[] = [...existingSectionImages];

      for (const [index, file] of selectedFiles.entries()) {
        const pendingCardId = nextPendingCards[index]?.id;

        try {
          const result = await uploadImageForSection({
            db: firestoreDb,
            storage: firebaseStorage,
            uid: user.uid,
            sectionId: selectedSection.id,
            sectionName: selectedSection.name,
            file,
            existingSectionImages: sectionImagesForSequence,
          });

          uploadedFileNames.push(result.fileName);
          sectionImagesForSequence = [
            ...sectionImagesForSequence,
            {
              id: result.id,
              fileName: result.fileName,
              sectionId: selectedSection.id,
              previewUrl: '',
              isFavorite: false,
            },
          ];
        } catch {
          uploadFailures += 1;
        } finally {
          if (pendingCardId) {
            setPendingUploadCards((current) =>
              current.filter((pendingItem) => pendingItem.id !== pendingCardId),
            );
          }
        }
      }

      if (uploadedFileNames.length === selectedFiles.length) {
        if (uploadedFileNames.length === 1) {
          setFeedback({
            tone: 'success',
            message: `Imagen subida correctamente con nombre automatico: ${uploadedFileNames[0]}.`,
          });
        } else {
          setFeedback({
            tone: 'success',
            message: `Se subieron ${uploadedFileNames.length} imagenes correctamente.`,
          });
        }
      } else if (uploadedFileNames.length > 0) {
        setFeedback({
          tone: 'warning',
          message: `Subida parcial: ${uploadedFileNames.length} imagen(es) subidas y ${uploadFailures} con error.`,
        });
      } else {
        setFeedback({
          tone: 'warning',
          message: 'No se pudo subir ninguna imagen.',
        });
      }
    } catch {
      setFeedback({
        tone: 'warning',
        message: 'No se pudieron procesar las imagenes seleccionadas.',
      });
    } finally {
      setIsUploading(false);
      setPendingUploadCards([]);
    }
  };

  const handleUploadImage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    event.target.value = '';
    await uploadSelectedFiles(selectedFiles);
  };

  const handleOpenCameraCapture = async (): Promise<void> => {
    if (isUploading || !selectedSection) {
      return;
    }

    const openedLiveCamera = await startLiveCamera();
    if (openedLiveCamera) {
      return;
    }

    setCameraErrorMessage(
      'No se pudo abrir la camara en modo avanzado. Se abrira la camara nativa o galeria.',
    );
    cameraCaptureInputRef.current?.click();
  };

  const handleOpenGalleryPicker = (): void => {
    if (isUploading || !selectedSection) {
      return;
    }

    galleryPickerInputRef.current?.click();
  };

  const handleCameraCaptureChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const capturedFile = event.target.files?.[0];
    event.target.value = '';

    if (!capturedFile) {
      return;
    }

    stopLiveCameraStream();
    createCameraDraftFromFile(capturedFile, 'none');
  };

  const handleGalleryPickerChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    stopLiveCameraStream();
    createCameraDraftFromFile(selectedFile, 'none');
  };

  const handleCapturePhotoFromLiveCamera = async (): Promise<void> => {
    if (!cameraVideoRef.current) {
      return;
    }

    const video = cameraVideoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraErrorMessage('La camara aun no esta lista. Intenta nuevamente en un segundo.');
      return;
    }

    setIsCapturingPhoto(true);

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const context = captureCanvas.getContext('2d');

    if (!context) {
      setIsCapturingPhoto(false);
      setCameraErrorMessage('No se pudo capturar la imagen.');
      return;
    }

    context.filter = selectedCameraFilterConfig.cssFilter;
    context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    const photoBlob = await new Promise<Blob | null>((resolve) => {
      captureCanvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    if (!photoBlob) {
      setIsCapturingPhoto(false);
      setCameraErrorMessage('No se pudo generar la imagen capturada.');
      return;
    }

    const timestamp = Date.now();
    const capturedFile = new File([photoBlob], `captura-${timestamp}.jpg`, {
      type: 'image/jpeg',
    });

    createCameraDraftFromFile(capturedFile, selectedCameraFilterConfig.id);
    stopLiveCameraStream();
    setIsCapturingPhoto(false);
  };

  const handleRetryCameraCapture = async (): Promise<void> => {
    clearCameraDraft();
    const openedLiveCamera = await startLiveCamera();
    if (!openedLiveCamera) {
      cameraCaptureInputRef.current?.click();
    }
  };

  const handleConfirmCameraDraftUpload = async (): Promise<void> => {
    if (!cameraDraft) {
      return;
    }

    const fileToUpload = cameraDraft.file;
    clearCameraDraft();
    await uploadSelectedFiles([fileToUpload]);
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

    const createdLinks: ShareLinkResult[] = [];
    let linkFailures = 0;

    try {
      const createResult = await createLinksForImages(selectedVisibleImages);
      createdLinks.push(...createResult.links);
      linkFailures = createResult.failedCount;

      if (createdLinks.length === 0) {
        setFeedback({
          tone: 'warning',
          message: 'No se pudo generar ningun link temporal para las imagenes seleccionadas.',
        });
        return;
      }

      setLastLink(createdLinks[createdLinks.length - 1] ?? null);
      await shareTemporaryLinks(createdLinks);
      setFeedback({
        tone: linkFailures > 0 ? 'info' : 'success',
        message:
          linkFailures > 0
            ? `Se compartieron ${createdLinks.length} links y ${linkFailures} imagen(es) no pudieron generar link.`
            : `Se compartieron ${createdLinks.length} links temporales para imagenes seleccionadas.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (createdLinks.length > 0) {
          const revokedCount = await revokeLinksBestEffort(createdLinks);
          setLastLink(null);
          setFeedback({
            tone: 'info',
            message: `El envio se cancelo por el usuario. Se revocaron ${revokedCount}/${createdLinks.length} links generados.`,
          });
          return;
        }

        setFeedback({
          tone: 'info',
          message: 'El envio se cancelo por el usuario.',
        });
      } else {
        if (createdLinks.length > 0) {
          void revokeLinksBestEffort(createdLinks);
          setLastLink(null);
        }

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
    const fallbackLinks: ShareLinkResult[] = [];

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
        const createResult = await createLinksForImages(selectedVisibleImages);
        if (createResult.links.length === 0) {
          setFeedback({
            tone: 'warning',
            message:
              'No hubo compatibilidad para compartir archivos y tampoco se pudieron generar links temporales.',
          });
          return;
        }

        fallbackLinks.push(...createResult.links);
        setLastLink(fallbackLinks[fallbackLinks.length - 1] ?? null);
        await shareTemporaryLinks(fallbackLinks);
        setFeedback({
          tone: createResult.failedCount > 0 ? 'info' : 'success',
          message:
            createResult.failedCount > 0
              ? `No hubo compatibilidad para compartir archivos. Se compartieron ${createResult.links.length} links y ${createResult.failedCount} imagen(es) quedaron sin link.`
              : `No hubo compatibilidad para compartir archivos. Se enviaron ${createResult.links.length} links temporales.`,
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (fallbackLinks.length > 0) {
          const revokedCount = await revokeLinksBestEffort(fallbackLinks);
          setLastLink(null);
          setFeedback({
            tone: 'info',
            message: `El envio se cancelo por el usuario. Se revocaron ${revokedCount}/${fallbackLinks.length} links generados.`,
          });
          return;
        }

        setFeedback({
          tone: 'info',
          message: 'El envio se cancelo por el usuario.',
        });
      } else {
        if (fallbackLinks.length > 0) {
          void revokeLinksBestEffort(fallbackLinks);
          setLastLink(null);
        }

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
              disabled={isCreatingSection}
            >
              <span className="category-add-plus">+</span>
              <span>Agregar</span>
            </button>

            {pendingSectionName && (
              <article className="category-card category-card-pending" role="listitem">
                <div className="pending-card-head">
                  <span className="inline-spinner" aria-hidden="true" />
                  <span>Creando...</span>
                </div>
                <button type="button" className="category-select-btn" disabled>
                  {pendingSectionName}
                </button>
                <span className="category-count">Guardando categoria</span>
              </article>
            )}

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
                disabled={isLoadingData || isCreatingSection}
                autoFocus
              />
              <button
                type="submit"
                className="primary-btn"
                disabled={isLoadingData || isCreatingSection}
              >
                {isCreatingSection ? 'Creando...' : 'Agregar'}
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
              multiple
              onChange={(event) => {
                void handleUploadImage(event);
              }}
              disabled={isUploading || !selectedSection}
            />
            <span className="upload-circle-icon" aria-hidden="true">
              <UploadIcon />
            </span>
            <span className="upload-hover-text">
              {isUploading ? 'subiendo imagenes' : 'subir imagen'}
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
              {visiblePendingUploadCards.map((pendingUploadCard) => (
                <article key={pendingUploadCard.id} className="image-card image-card-pending">
                  <div className="image-stage pending-image-stage">
                    <div className="pending-image-loader">
                      <span className="inline-spinner" aria-hidden="true" />
                      <span>Subiendo imagen...</span>
                    </div>
                  </div>

                  <div className="image-meta">
                    <h3>{pendingUploadCard.fileName}</h3>
                    <p>Procesando y guardando en la seccion</p>
                  </div>
                </article>
              ))}

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

            {visibleImages.length === 0 && visiblePendingUploadCards.length === 0 && (
              <p className="empty-state">
                Esta seccion no tiene imagenes. Usa "Subir imagen" para guardar la primera.
              </p>
            )}
          </>
        )}
      </section>

      {/* Native fallback input: rear camera preference on mobile. */}
      <input
        ref={cameraCaptureInputRef}
        className="camera-capture-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCaptureChange}
        disabled={isUploading || !selectedSection}
      />

      {/* Gallery fallback input when camera is not available. */}
      <input
        ref={galleryPickerInputRef}
        className="camera-capture-input"
        type="file"
        accept="image/*"
        onChange={handleGalleryPickerChange}
        disabled={isUploading || !selectedSection}
      />

      {isCameraLiveOpen && (
        <div className="camera-live-overlay" role="dialog" aria-modal="true" aria-label="Camara">
          <video
            ref={cameraVideoRef}
            className="camera-live-video"
            autoPlay
            playsInline
            muted
            style={{ filter: selectedCameraFilterConfig.cssFilter }}
          />

          <div className="camera-live-top">
            <button
              type="button"
              className="secondary-btn"
              onClick={stopLiveCameraStream}
              disabled={isCapturingPhoto}
            >
              Cerrar
            </button>
          </div>

          <div className="camera-filter-row" role="group" aria-label="Filtros de camara">
            {cameraFilterOptions.map((filterOption) => (
              <button
                key={filterOption.id}
                type="button"
                className={
                  filterOption.id === selectedCameraFilter
                    ? 'camera-filter-btn active'
                    : 'camera-filter-btn'
                }
                onClick={() => setSelectedCameraFilter(filterOption.id)}
                disabled={isCapturingPhoto}
              >
                {filterOption.label}
              </button>
            ))}
          </div>

          <div className="camera-live-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleOpenGalleryPicker}
              disabled={isCapturingPhoto}
            >
              Galeria
            </button>

            <button
              type="button"
              className="camera-shutter-btn"
              onClick={() => {
                void handleCapturePhotoFromLiveCamera();
              }}
              disabled={isCapturingPhoto || isCameraStarting}
              aria-label="Tomar foto"
            >
              <span />
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => cameraCaptureInputRef.current?.click()}
              disabled={isCapturingPhoto}
            >
              Camara nativa
            </button>
          </div>

          {cameraErrorMessage && <p className="camera-live-notice">{cameraErrorMessage}</p>}
        </div>
      )}

      {cameraDraft && (
        <section className="camera-canvas-overlay" aria-label="Vista previa de camara en canvas">
          <canvas ref={cameraCanvasRef} className="camera-fullscreen-canvas" />

          <div className="camera-canvas-head">
            <span className="camera-filter-pill">
              Filtro: {cameraFilterOptions.find((item) => item.id === cameraDraft.filterPreset)?.label ?? 'Normal'}
            </span>
          </div>

          <div className="camera-canvas-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                void handleRetryCameraCapture();
              }}
              disabled={isUploading}
            >
              Repetir
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                void handleConfirmCameraDraftUpload();
              }}
              disabled={isUploading || !selectedSection}
            >
              {isUploading ? 'Guardando...' : 'Guardar en galeria'}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={clearCameraDraft}
              disabled={isUploading}
            >
              Cerrar
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        className="camera-fab"
        onClick={() => {
          void handleOpenCameraCapture();
        }}
        disabled={isUploading || !selectedSection}
        aria-label="Abrir camara o galeria"
      >
        <CameraIcon />
        <span className="camera-fab-tooltip">Camara</span>
      </button>

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
