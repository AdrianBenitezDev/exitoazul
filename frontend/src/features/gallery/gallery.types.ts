export type GalleryImage = {
  id: string;
  fileName: string;
  sectionId: string;
  previewUrl: string;
  thumbnailUrl?: string;
  isFavorite: boolean;
  storagePath?: string;
  thumbStoragePath?: string;
};

export type GallerySection = {
  id: string;
  name: string;
};
