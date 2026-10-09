export type AdminUserEmail = {
  uid: string;
  email: string;
  displayName: string | null;
};

export type AdminCatalogImage = {
  id: string;
  fileName: string;
  previewUrl: string;
  thumbnailUrl: string;
  createdAtIso: string | null;
};

export type AdminCatalogSection = {
  id: string;
  name: string;
  imageCount: number;
  coverImage: AdminCatalogImage | null;
  images: AdminCatalogImage[];
};

export type AdminUserCatalog = {
  user: {
    uid: string;
    email: string;
    displayName: string | null;
  };
  sections: AdminCatalogSection[];
};

export type AdminPaymentUser = {
  uid: string;
  email: string;
  displayName: string | null;
  createdAtIso: string | null;
  lastSignInIso: string | null;
  disabled: boolean;
};

export type AdminPaymentUsersPage = {
  users: AdminPaymentUser[];
  nextPageToken: string | null;
  limit: number;
};

