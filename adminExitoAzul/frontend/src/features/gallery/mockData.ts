import type { GalleryImage, GallerySection } from './gallery.types';
import { buildAutoImageName } from './naming';

export const initialGallerySections: GallerySection[] = [
  {
    id: 'favoritas',
    name: 'Favoritas',
  },
  {
    id: 'campana-abril',
    name: 'Campana Abril',
  },
  {
    id: 'clientes-vip',
    name: 'Clientes VIP',
  },
];

export const initialGalleryImages: GalleryImage[] = [
  {
    id: 'img-001',
    fileName: buildAutoImageName('Favoritas', 1),
    sectionId: 'favoritas',
    previewUrl: 'https://picsum.photos/id/1011/700/520',
    isFavorite: true,
  },
  {
    id: 'img-002',
    fileName: buildAutoImageName('Campana Abril', 1),
    sectionId: 'campana-abril',
    previewUrl: 'https://picsum.photos/id/1060/700/520',
    isFavorite: false,
  },
  {
    id: 'img-003',
    fileName: buildAutoImageName('Campana Abril', 2),
    sectionId: 'campana-abril',
    previewUrl: 'https://picsum.photos/id/1074/700/520',
    isFavorite: false,
  },
  {
    id: 'img-004',
    fileName: buildAutoImageName('Clientes VIP', 1),
    sectionId: 'clientes-vip',
    previewUrl: 'https://picsum.photos/id/1082/700/520',
    isFavorite: true,
  },
  {
    id: 'img-005',
    fileName: buildAutoImageName('Clientes VIP', 2),
    sectionId: 'clientes-vip',
    previewUrl: 'https://picsum.photos/id/1084/700/520',
    isFavorite: false,
  },
];
