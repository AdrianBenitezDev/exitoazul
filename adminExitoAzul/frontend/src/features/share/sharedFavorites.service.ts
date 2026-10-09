import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { SharedImageView } from './share.types';

export const buildSharedFavoriteId = (token: string, imageId: string): string =>
  `${token}__${imageId}`;

export const subscribeSharedFavorites = (
  db: Firestore,
  uid: string,
  onData: (favoriteIds: string[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  const favoritesRef = collection(db, 'users', uid, 'sharedFavorites');

  return onSnapshot(
    favoritesRef,
    (snapshot) => {
      const favoriteIds = snapshot.docs.map((docSnap) => docSnap.id);
      onData(favoriteIds);
    },
    (error) => {
      onError(error);
    },
  );
};

export const setSharedFavorite = async (params: {
  db: Firestore;
  uid: string;
  token: string;
  image: SharedImageView;
  isFavorite: boolean;
}): Promise<void> => {
  const { db, uid, token, image, isFavorite } = params;
  const favoriteId = buildSharedFavoriteId(token, image.id);
  const favoriteRef = doc(db, 'users', uid, 'sharedFavorites', favoriteId);

  if (!isFavorite) {
    await deleteDoc(favoriteRef);
    return;
  }

  await setDoc(
    favoriteRef,
    {
      token,
      imageId: image.id,
      fileName: image.fileName,
      previewUrl: image.previewUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};
