import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import type { GalleryImage, GallerySection } from './gallery.types';
import { buildAutoImageName, getNextImageSequence } from './naming';

type SectionDoc = {
  name?: string;
};

type ImageDoc = {
  fileName?: string;
  sectionId?: string;
  isFavorite?: boolean;
  storagePath?: string;
  downloadUrl?: string;
  thumbStoragePath?: string;
  thumbnailUrl?: string;
};

const THUMBNAIL_MAX_DIMENSION = 520;
const THUMBNAIL_QUALITY = 0.74;
const UPLOAD_MAX_DIMENSION = 2400;
const UPLOAD_QUALITY = 0.86;
const UPLOAD_MIN_SAVINGS_RATIO = 0.98;

const sectionsCollection = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'sections');

const imagesCollection = (db: Firestore, uid: string) =>
  collection(db, 'users', uid, 'images');

const getExtensionFromMimeType = (mimeType: string): string => {
  const subtype = mimeType.split('/')[1] ?? '';

  if (!subtype) {
    return '';
  }

  return subtype.split('+')[0]?.toLowerCase() ?? '';
};

const getFileExtension = (file: File): string => {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  if (fromName) {
    return fromName;
  }

  return getExtensionFromMimeType(file.type);
};

const loadImageElementFromFile = async (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const imageElement = new Image();

    imageElement.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageElement);
    };

    imageElement.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo preparar la imagen para miniatura.'));
    };

    imageElement.src = objectUrl;
  });

const getScaledSize = (
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } => {
  const largestSide = Math.max(width, height);
  if (largestSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / largestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const createThumbnailFile = async (
  file: File,
  baseName: string,
): Promise<File | null> => {
  if (!file.type.startsWith('image/')) {
    return null;
  }

  const imageElement = await loadImageElementFromFile(file);
  const target = getScaledSize(
    imageElement.naturalWidth,
    imageElement.naturalHeight,
    THUMBNAIL_MAX_DIMENSION,
  );
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(imageElement, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', THUMBNAIL_QUALITY);
  });

  if (!blob) {
    return null;
  }

  return new File([blob], `thumb_${baseName}.webp`, {
    type: 'image/webp',
  });
};

const createOptimizedUploadFile = async (
  file: File,
  baseName: string,
): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const imageElement = await loadImageElementFromFile(file);
  const target = getScaledSize(
    imageElement.naturalWidth,
    imageElement.naturalHeight,
    UPLOAD_MAX_DIMENSION,
  );
  const resized =
    target.width !== imageElement.naturalWidth ||
    target.height !== imageElement.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext('2d');

  if (!context) {
    return file;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(imageElement, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', UPLOAD_QUALITY);
  });

  if (!blob) {
    return file;
  }

  const optimizedFile = new File([blob], `${baseName}.webp`, {
    type: 'image/webp',
  });
  const hasGoodSavings = optimizedFile.size <= file.size * UPLOAD_MIN_SAVINGS_RATIO;

  if (resized || hasGoodSavings) {
    return optimizedFile;
  }

  return file;
};

export const subscribeUserSections = (
  db: Firestore,
  uid: string,
  onData: (sections: GallerySection[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  const q = query(sectionsCollection(db, uid), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const sections = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as SectionDoc;
        return {
          id: docSnap.id,
          name: data.name?.trim() || 'Seccion',
        } satisfies GallerySection;
      });

      onData(sections);
    },
    (error) => {
      onError(error);
    },
  );
};

export const subscribeUserImages = (
  db: Firestore,
  uid: string,
  onData: (images: GalleryImage[]) => void,
  onError: (error: Error) => void,
  pageSize: number = 60,
): Unsubscribe => {
  const q = query(
    imagesCollection(db, uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const images = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as ImageDoc;
        return {
          id: docSnap.id,
          fileName: data.fileName?.trim() || docSnap.id,
          sectionId: data.sectionId ?? '',
          previewUrl: data.downloadUrl ?? '',
          thumbnailUrl: data.thumbnailUrl ?? data.downloadUrl ?? '',
          isFavorite: Boolean(data.isFavorite),
          storagePath: data.storagePath,
          thumbStoragePath: data.thumbStoragePath,
        } satisfies GalleryImage;
      });

      onData(images);
    },
    (error) => {
      onError(error);
    },
  );
};

export const ensureDefaultSection = async (db: Firestore, uid: string): Promise<void> => {
  const sections = await getDocs(sectionsCollection(db, uid));

  if (!sections.empty) {
    return;
  }

  await addDoc(sectionsCollection(db, uid), {
    name: 'Favoritas',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const createUserSection = async (
  db: Firestore,
  uid: string,
  sectionName: string,
): Promise<string> => {
  const docRef = await addDoc(sectionsCollection(db, uid), {
    name: sectionName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
};

export const uploadImageForSection = async (params: {
  db: Firestore;
  storage: FirebaseStorage;
  uid: string;
  sectionId: string;
  sectionName: string;
  file: File;
  existingSectionImages: GalleryImage[];
}): Promise<{ id: string; fileName: string }> => {
  const { db, storage, uid, sectionId, sectionName, file, existingSectionImages } = params;

  const nextSequence = getNextImageSequence(existingSectionImages, sectionName);
  const autoBaseName = buildAutoImageName(sectionName, nextSequence);
  const optimizedUploadFile = await createOptimizedUploadFile(file, autoBaseName);
  const extension = getFileExtension(optimizedUploadFile);
  const storageFileName = extension ? `${autoBaseName}.${extension}` : autoBaseName;

  const imageDocRef = doc(imagesCollection(db, uid));
  const storagePath = `users/${uid}/images/${imageDocRef.id}/${storageFileName}`;
  const storageRef = ref(storage, storagePath);
  const thumbnailFile = await createThumbnailFile(optimizedUploadFile, autoBaseName);
  const thumbStoragePath = thumbnailFile
    ? `users/${uid}/images/${imageDocRef.id}/thumb_${autoBaseName}.webp`
    : '';
  const thumbnailStorageRef = thumbnailFile ? ref(storage, thumbStoragePath) : null;
  const uploadedStorageRefs = [storageRef];

  await uploadBytes(storageRef, optimizedUploadFile, {
    contentType: optimizedUploadFile.type || 'application/octet-stream',
  });

  if (thumbnailFile && thumbnailStorageRef) {
    await uploadBytes(thumbnailStorageRef, thumbnailFile, {
      contentType: thumbnailFile.type,
    });
    uploadedStorageRefs.push(thumbnailStorageRef);
  }

  try {
    const downloadUrl = await getDownloadURL(storageRef);
    const thumbnailUrl =
      thumbnailStorageRef ? await getDownloadURL(thumbnailStorageRef) : null;

    await setDoc(imageDocRef, {
      fileName: autoBaseName,
      sectionId,
      isFavorite: false,
      storagePath,
      downloadUrl,
      thumbStoragePath: thumbStoragePath || null,
      thumbnailUrl,
      mimeType: optimizedUploadFile.type || null,
      sizeBytes: optimizedUploadFile.size,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await Promise.all(
      uploadedStorageRefs.map((uploadedStorageRef) =>
        deleteObject(uploadedStorageRef).catch(() => null),
      ),
    );
    throw error;
  }

  return {
    id: imageDocRef.id,
    fileName: autoBaseName,
  };
};

export const setUserImageFavorite = async (params: {
  db: Firestore;
  uid: string;
  imageId: string;
  isFavorite: boolean;
}): Promise<void> => {
  const { db, uid, imageId, isFavorite } = params;

  const imageRef = doc(db, 'users', uid, 'images', imageId);
  await updateDoc(imageRef, {
    isFavorite,
    updatedAt: serverTimestamp(),
  });
};

export const deleteUserImage = async (params: {
  db: Firestore;
  storage: FirebaseStorage;
  uid: string;
  image: GalleryImage;
}): Promise<void> => {
  const { db, storage, uid, image } = params;

  if (image.storagePath) {
    await deleteObject(ref(storage, image.storagePath)).catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'storage/object-not-found'
      ) {
        return;
      }

      throw error;
    });
  }

  if (image.thumbStoragePath) {
    await deleteObject(ref(storage, image.thumbStoragePath)).catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'storage/object-not-found'
      ) {
        return;
      }

      throw error;
    });
  }

  const imageRef = doc(db, 'users', uid, 'images', image.id);
  await deleteDoc(imageRef);
};
