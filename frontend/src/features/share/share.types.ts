export type ShareTargetType = 'image' | 'section';

export type ShareLinkRequest = {
  targetType: ShareTargetType;
  targetId: string;
  ttlHours?: number;
};

export type ShareLinkResult = {
  url: string;
  expiresAt: Date;
  targetType: ShareTargetType;
  targetId: string;
};

export type ShareOutcome = {
  mode: 'direct-image' | 'temporary-link';
  link: ShareLinkResult;
};
