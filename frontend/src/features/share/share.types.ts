export type ShareTargetType = 'image' | 'section' | 'images';

export type ShareLinkRequest = {
  targetType: ShareTargetType;
  targetId?: string;
  targetIds?: string[];
  ttlHours?: number;
};

export type ShareLinkResult = {
  token: string;
  url: string;
  expiresAt: Date;
  targetType: ShareTargetType;
  targetId: string;
  targetIds: string[];
  ownerNickname: string;
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
  targetIds: string[];
  ownerNickname: string;
  expiresAt: Date;
  sectionName: string;
  images: SharedImageView[];
};

export type ShareOutcome = {
  mode: 'direct-image' | 'temporary-link';
  link: ShareLinkResult;
};
