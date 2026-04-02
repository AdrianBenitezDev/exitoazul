export type GalleryImage = {
  id: string;
  fileName: string;
  sectionId: string;
  previewUrl: string;
  isFavorite: boolean;
};

export type GallerySection = {
  id: string;
  name: string;
};
