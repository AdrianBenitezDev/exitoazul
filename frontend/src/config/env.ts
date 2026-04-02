const clean = (value: string | undefined): string => value?.trim() ?? '';

export const env = {
  firebaseApiKey: clean(import.meta.env.VITE_FIREBASE_API_KEY),
  firebaseAuthDomain: clean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  firebaseProjectId: clean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  firebaseStorageBucket: clean(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  firebaseMessagingSenderId: clean(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  firebaseAppId: clean(import.meta.env.VITE_FIREBASE_APP_ID),
  publicShareBaseUrl: clean(import.meta.env.VITE_PUBLIC_SHARE_BASE_URL),
};

export const firebaseIsConfigured = [
  env.firebaseApiKey,
  env.firebaseAuthDomain,
  env.firebaseProjectId,
  env.firebaseStorageBucket,
  env.firebaseMessagingSenderId,
  env.firebaseAppId,
].every(Boolean);
