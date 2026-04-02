export type ShareTargetType = 'image' | 'section';

export type ShareLinkRequest = {
  targetType: ShareTargetType;
  targetId: string;
  ttlHours?: number;
};

export type ShareLinkResult = {
  token: string;
  url: string;
  expiresAt: Date;
  targetType: ShareTargetType;
  targetId: string;
};

export type SharedImageView = {
  id: string;
  fileName: string;
  previewUrl: string;
  sectionId: string;
};

export type SharedGalleryResult = {
  token: string;
  targetType: ShareTargetType;
  targetId: string;
  expiresAt: Date;
  sectionName: string;
  images: SharedImageView[];
};

export type ShareOutcome = {
  mode: 'direct-image' | 'temporary-link';
  link: ShareLinkResult;
};
