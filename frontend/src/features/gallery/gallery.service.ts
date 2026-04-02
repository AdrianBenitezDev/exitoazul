import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
};

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
): Unsubscribe => {
  const q = query(imagesCollection(db, uid), orderBy('createdAt', 'desc'));

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
          isFavorite: Boolean(data.isFavorite),
          storagePath: data.storagePath,
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
  const extension = getFileExtension(file);
  const storageFileName = extension ? `${autoBaseName}.${extension}` : autoBaseName;

  const imageDocRef = doc(imagesCollection(db, uid));
  const storagePath = `users/${uid}/images/${imageDocRef.id}/${storageFileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  });

  try {
    const downloadUrl = await getDownloadURL(storageRef);

    await setDoc(imageDocRef, {
      fileName: autoBaseName,
      sectionId,
      isFavorite: false,
      storagePath,
      downloadUrl,
      mimeType: file.type || null,
      sizeBytes: file.size,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await deleteObject(storageRef).catch(() => null);
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

  const imageRef = doc(db, 'users', uid, 'images', image.id);
  await deleteDoc(imageRef);
};
