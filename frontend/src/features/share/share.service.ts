import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { env } from '../../config/env';
import { firebaseFunctions } from '../../lib/firebase';
import type { SharedGalleryResult, ShareLinkRequest, ShareLinkResult, ShareOutcome } from './share.types';

type CreateShareLinkResponse = {
  token: string;
  url: string;
  expiresAt: string;
  targetType: 'image' | 'section';
  targetId: string;
};

type RevokeShareLinkResponse = {
  token: string;
  revoked: boolean;
};

type ResolveSharedGalleryResponse = {
  token: string;
  targetType: 'image' | 'section';
  targetId: string;
  expiresAt: string;
  sectionName: string;
  images: Array<{
    id: string;
    fileName: string;
    previewUrl: string;
    sectionId: string;
  }>;
};

const trimFinalSlash = (value: string): string => value.replace(/\/+$/, '');

const isLocalhostOrigin = (origin: string): boolean =>
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);

const getFirebaseHostedBaseUrl = (): string => {
  if (env.firebaseProjectId) {
    return `https://${env.firebaseProjectId}.web.app`;
  }

  return 'https://exitoazul-87247.web.app';
};

const getShareBaseUrl = (): string => {
  if (env.publicShareBaseUrl) {
    return trimFinalSlash(env.publicShareBaseUrl);
  }

  if (typeof window !== 'undefined') {
    const origin = trimFinalSlash(window.location.origin);
    if (!isLocalhostOrigin(origin)) {
      return origin;
    }
  }

  return trimFinalSlash(getFirebaseHostedBaseUrl());
};

const normalizeDate = (value: string): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const canUseNavigatorShare = (): boolean => typeof navigator.share === 'function';

const canShareFiles = (files: File[]): boolean => {
  if (files.length === 0) {
    return false;
  }

  if (!canUseNavigatorShare()) {
    return false;
  }

  const navigatorWithCanShare = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof navigatorWithCanShare.canShare !== 'function') {
    return false;
  }

  try {
    return navigatorWithCanShare.canShare({ files });
  } catch {
    return false;
  }
};

const shareLinkByClient = async (url: string): Promise<void> => {
  const text = `Galeria privada de Exito Azul: ${url}`;

  if (canUseNavigatorShare()) {
    await navigator.share({
      title: 'Exito Azul',
      text,
      url,
    });
    return;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

const requireFunctions = () => {
  if (!firebaseFunctions) {
    throw new Error('El servicio de compartido no esta configurado en este entorno.');
  }

  return firebaseFunctions;
};

export const getShareErrorMessage = (
  error: unknown,
  fallback: string = 'No fue posible completar la accion de compartido.',
): string => {
  const code =
    error instanceof FirebaseError
      ? error.code
      : typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';

  switch (code) {
    case 'functions/unauthenticated':
      return 'Debes iniciar sesion para gestionar links temporales.';
    case 'functions/not-found':
      return 'No se encontro el recurso solicitado.';
    case 'functions/permission-denied':
      return 'No tienes permisos para realizar esta accion.';
    case 'functions/failed-precondition':
      return 'El link temporal esta vencido o fue revocado.';
    case 'functions/invalid-argument':
      return 'Los datos enviados son invalidos.';
    case 'functions/unavailable':
      return 'El servicio de compartido no esta disponible temporalmente.';
    default:
      return fallback;
  }
};

export const createTemporaryShareLink = async (
  request: ShareLinkRequest,
): Promise<ShareLinkResult> => {
  const callable = httpsCallable<
    ShareLinkRequest & { baseUrl: string },
    CreateShareLinkResponse
  >(requireFunctions(), 'createShareLink');

  const response = await callable({
    ...request,
    baseUrl: getShareBaseUrl(),
  });

  return {
    token: response.data.token,
    url: response.data.url,
    expiresAt: normalizeDate(response.data.expiresAt),
    targetType: response.data.targetType,
    targetId: response.data.targetId,
  };
};

export const revokeTemporaryShareLink = async (token: string): Promise<boolean> => {
  const callable = httpsCallable<{ token: string }, RevokeShareLinkResponse>(
    requireFunctions(),
    'revokeShareLink',
  );

  const response = await callable({
    token,
  });

  return response.data.revoked;
};

export const resolveSharedGalleryByToken = async (token: string): Promise<SharedGalleryResult> => {
  const callable = httpsCallable<{ token: string }, ResolveSharedGalleryResponse>(
    requireFunctions(),
    'resolveSharedGallery',
  );

  const response = await callable({
    token,
  });

  return {
    token: response.data.token,
    targetType: response.data.targetType,
    targetId: response.data.targetId,
    expiresAt: normalizeDate(response.data.expiresAt),
    sectionName: response.data.sectionName,
    images: response.data.images,
  };
};

export const shareTemporaryLink = async (link: ShareLinkResult): Promise<void> => {
  await shareLinkByClient(link.url);
};

export const shareTemporaryLinks = async (links: ShareLinkResult[]): Promise<void> => {
  if (links.length === 0) {
    return;
  }

  if (links.length === 1) {
    await shareTemporaryLink(links[0]);
    return;
  }

  const urls = links.map((link) => link.url);
  const text = `Links temporales de Exito Azul:\n${urls.join('\n')}`;

  if (canUseNavigatorShare()) {
    await navigator.share({
      title: 'Exito Azul',
      text,
    });
    return;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return;
  }

  window.open(urls[0], '_blank', 'noopener,noreferrer');
};

export const shareFilesDirect = async (params: {
  title: string;
  text: string;
  files: File[];
}): Promise<boolean> => {
  const { title, text, files } = params;

  if (!canShareFiles(files)) {
    return false;
  }

  try {
    await navigator.share({
      title,
      text,
      files,
    });

    return true;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return false;
  }
};

export const shareImageWithPolicy = async (params: {
  imageTitle: string;
  temporaryLink: ShareLinkResult;
  sourceFile?: File;
}): Promise<ShareOutcome> => {
  const { imageTitle, temporaryLink, sourceFile } = params;

  if (sourceFile && canShareFiles([sourceFile])) {
    try {
      await navigator.share({
        title: imageTitle,
        text: 'Imagen compartida desde Exito Azul',
        files: [sourceFile],
      });

      return {
        mode: 'direct-image',
        link: temporaryLink,
      };
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
    }
  }

  await shareLinkByClient(temporaryLink.url);

  return {
    mode: 'temporary-link',
    link: temporaryLink,
  };
};
