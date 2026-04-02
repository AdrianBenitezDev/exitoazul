import type { GalleryImage } from './gallery.types';

const normalizeAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const toSectionSlug = (sectionName: string): string => {
  const normalized = normalizeAccents(sectionName.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'seccion';
};

export const buildAutoImageName = (sectionName: string, sequence: number): string =>
  `${toSectionSlug(sectionName)}_${sequence}`;

export const getNextImageSequence = (
  images: GalleryImage[],
  sectionName: string,
): number => {
  const prefix = `${toSectionSlug(sectionName)}_`;

  const maxFound = images.reduce((max, image) => {
    if (!image.fileName.startsWith(prefix)) {
      return max;
    }

    const suffix = image.fileName.slice(prefix.length);
    const sequence = Number.parseInt(suffix, 10);

    if (Number.isNaN(sequence)) {
      return max;
    }

    return Math.max(max, sequence);
  }, 0);

  return maxFound + 1;
};
