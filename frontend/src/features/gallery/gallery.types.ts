export type GalleryImage = {
  id: string;
  fileName: string;
  sectionId: string;
  previewUrl: string;
  isFavorite: boolean;
  storagePath?: string;
};

export type GallerySection = {
  id: string;
  name: string;
};
