import { env } from '../../config/env';
import type { ShareLinkRequest, ShareLinkResult, ShareOutcome } from './share.types';

const DEFAULT_TTL_HOURS = 24;

const trimFinalSlash = (value: string): string => value.replace(/\/+$/, '');

const getShareBaseUrl = (): string => {
  if (env.publicShareBaseUrl) {
    return trimFinalSlash(env.publicShareBaseUrl);
  }

  if (typeof window !== 'undefined') {
    return trimFinalSlash(window.location.origin);
  }

  return 'http://localhost:5173';
};

const createToken = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replaceAll('-', '');
  }

  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const canUseNavigatorShare = (): boolean => typeof navigator.share === 'function';

const canShareFiles = (file: File): boolean => {
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
    return navigatorWithCanShare.canShare({ files: [file] });
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

export const createTemporaryShareLink = (request: ShareLinkRequest): ShareLinkResult => {
  const ttlHours = request.ttlHours ?? DEFAULT_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const token = createToken();

  return {
    url: `${getShareBaseUrl()}/s/${token}`,
    expiresAt,
    targetType: request.targetType,
    targetId: request.targetId,
  };
};

export const shareTemporaryLink = async (link: ShareLinkResult): Promise<void> => {
  await shareLinkByClient(link.url);
};

export const shareImageWithPolicy = async (params: {
  imageTitle: string;
  temporaryLink: ShareLinkResult;
  sourceFile?: File;
}): Promise<ShareOutcome> => {
  const { imageTitle, temporaryLink, sourceFile } = params;

  if (sourceFile && canShareFiles(sourceFile)) {
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
