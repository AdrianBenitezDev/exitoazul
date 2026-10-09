import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth, type UserRecord} from "firebase-admin/auth";
import {Timestamp, getFirestore} from "firebase-admin/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {ensureAdminRequest} from "./guard";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

const CALLABLE_REGION = "us-south1";
const CALLABLE_MAX_INSTANCES = 10;
const AUTH_LIST_BATCH_SIZE = 1000;
const PAYMENTS_DEFAULT_LIMIT = 10;
const PAYMENTS_MAX_LIMIT = 50;
const MAX_IMAGES_PER_SECTION = 60;
const SECTION_FALLBACK_ID = "__sin_categoria__";
const SECTION_FALLBACK_NAME = "Sin categoria";

type AdminListUserEmailsResponse = {
  users: Array<{
    uid: string;
    email: string;
    displayName: string | null;
  }>;
  total: number;
};

type AdminGetUserCatalogRequest = {
  email?: string;
};

type AdminGetUserCatalogResponse = {
  user: {
    uid: string;
    email: string;
    displayName: string | null;
  };
  sections: Array<{
    id: string;
    name: string;
    imageCount: number;
    coverImage: {
      id: string;
      fileName: string;
      previewUrl: string;
      thumbnailUrl: string;
      createdAtIso: string | null;
    } | null;
    images: Array<{
      id: string;
      fileName: string;
      previewUrl: string;
      thumbnailUrl: string;
      createdAtIso: string | null;
    }>;
  }>;
};

type AdminListPaymentsUsersRequest = {
  limit?: number;
  pageToken?: string;
};

type AdminListPaymentsUsersResponse = {
  users: Array<{
    uid: string;
    email: string;
    displayName: string | null;
    createdAtIso: string | null;
    lastSignInIso: string | null;
    disabled: boolean;
  }>;
  nextPageToken: string | null;
  limit: number;
};

type SectionDoc = {
  name?: string;
};

type ImageDoc = {
  fileName?: string;
  sectionId?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  createdAt?: Timestamp;
};

type MutableSection = {
  id: string;
  name: string;
  imageCount: number;
  images: Array<{
    id: string;
    fileName: string;
    previewUrl: string;
    thumbnailUrl: string;
    createdAtIso: string | null;
  }>;
  sortIndex: number;
};

const normalizeEmail = (value: string | undefined): string =>
  value?.trim().toLowerCase() ?? "";

const parseEmail = (value: string | undefined): string => {
  const email = normalizeEmail(value);

  if (!email) {
    throw new HttpsError("invalid-argument", "El email es obligatorio.");
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!validEmail) {
    throw new HttpsError(
      "invalid-argument",
      "El email no tiene formato valido.",
    );
  }

  return email;
};

const parsePageToken = (value: string | undefined): string | undefined => {
  const token = value?.trim() ?? "";
  return token || undefined;
};

const parsePageLimit = (value: number | undefined): number => {
  const parsed =
    typeof value === "number" && Number.isFinite(value) ?
      Math.floor(value) :
      PAYMENTS_DEFAULT_LIMIT;

  if (parsed < 1 || parsed > PAYMENTS_MAX_LIMIT) {
    throw new HttpsError(
      "invalid-argument",
      `limit debe estar entre 1 y ${PAYMENTS_MAX_LIMIT}.`,
    );
  }

  return parsed;
};

const toIsoOrNull = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const parseAuthDate = (value: string | undefined): string | null => {
  const source = value?.trim() ?? "";
  if (!source) {
    return null;
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const sortUsersByEmail = (
  users: Array<{uid: string; email: string; displayName: string | null}>,
) => users.sort((left, right) =>
  left.email.localeCompare(right.email, "es", {sensitivity: "base"}),
);

const listAllAuthUsersWithEmail = async (): Promise<
Array<{uid: string; email: string; displayName: string | null}>
> => {
  let pageToken: string | undefined;
  const users: Array<{
    uid: string;
    email: string;
    displayName: string | null;
  }> = [];

  do {
    const page = await auth.listUsers(AUTH_LIST_BATCH_SIZE, pageToken);
    page.users.forEach((userRecord) => {
      const email = normalizeEmail(userRecord.email);

      if (!email) {
        return;
      }

      users.push({
        uid: userRecord.uid,
        email,
        displayName: userRecord.displayName?.trim() || null,
      });
    });
    pageToken = page.pageToken;
  } while (pageToken);

  return sortUsersByEmail(users);
};

const mapPaymentUser = (userRecord: UserRecord) => ({
  uid: userRecord.uid,
  email: normalizeEmail(userRecord.email),
  displayName: userRecord.displayName?.trim() || null,
  createdAtIso: parseAuthDate(userRecord.metadata.creationTime),
  lastSignInIso: parseAuthDate(userRecord.metadata.lastSignInTime),
  disabled: Boolean(userRecord.disabled),
});

const getUserByEmailOrThrow = async (
  email: string,
): Promise<UserRecord> => {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    const authErrorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as {code?: unknown}).code === "string" ?
        String((error as {code: string}).code) :
        "";

    if (authErrorCode === "auth/user-not-found") {
      throw new HttpsError("not-found", "No existe un usuario con ese email.");
    }

    throw error;
  }
};

const getOrCreateSection = (
  sectionsMap: Map<string, MutableSection>,
  sectionId: string,
  nextSortIndex: {value: number},
): MutableSection => {
  const existing = sectionsMap.get(sectionId);
  if (existing) {
    return existing;
  }

  const fallbackSection: MutableSection = {
    id: SECTION_FALLBACK_ID,
    name: SECTION_FALLBACK_NAME,
    imageCount: 0,
    images: [],
    sortIndex: nextSortIndex.value,
  };
  nextSortIndex.value += 1;
  sectionsMap.set(SECTION_FALLBACK_ID, fallbackSection);
  return fallbackSection;
};

export const adminListUserEmails = onCall(
  {region: CALLABLE_REGION, maxInstances: CALLABLE_MAX_INSTANCES},
  async (request): Promise<AdminListUserEmailsResponse> => {
    ensureAdminRequest(request);

    const users = await listAllAuthUsersWithEmail();

    return {
      users,
      total: users.length,
    };
  },
);

export const adminGetUserCatalog = onCall(
  {region: CALLABLE_REGION, maxInstances: CALLABLE_MAX_INSTANCES},
  async (request): Promise<AdminGetUserCatalogResponse> => {
    ensureAdminRequest(request);

    const data = (request.data ?? {}) as AdminGetUserCatalogRequest;
    const email = parseEmail(data.email);
    const userRecord = await getUserByEmailOrThrow(email);
    const userRef = db.collection("users").doc(userRecord.uid);

    const [sectionsSnapshot, imagesSnapshot] = await Promise.all([
      userRef.collection("sections").orderBy("createdAt", "asc").get(),
      userRef.collection("images").orderBy("createdAt", "desc").get(),
    ]);

    const sectionsMap = new Map<string, MutableSection>();

    sectionsSnapshot.docs.forEach((docSnapshot, index) => {
      const data = docSnapshot.data() as SectionDoc;
      sectionsMap.set(docSnapshot.id, {
        id: docSnapshot.id,
        name: data.name?.trim() || "Seccion",
        imageCount: 0,
        images: [],
        sortIndex: index,
      });
    });

    const nextSortIndex = {value: sectionsSnapshot.size};

    imagesSnapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as ImageDoc;
      const sectionId = data.sectionId?.trim() || SECTION_FALLBACK_ID;
      const targetSection = getOrCreateSection(
        sectionsMap,
        sectionId,
        nextSortIndex,
      );
      const previewUrl = data.downloadUrl?.trim() ?? "";

      targetSection.imageCount += 1;

      if (
        !previewUrl ||
        targetSection.images.length >= MAX_IMAGES_PER_SECTION
      ) {
        return;
      }

      targetSection.images.push({
        id: docSnapshot.id,
        fileName: data.fileName?.trim() || docSnapshot.id,
        previewUrl,
        thumbnailUrl: data.thumbnailUrl?.trim() || previewUrl,
        createdAtIso: toIsoOrNull(data.createdAt?.toDate()),
      });
    });

    const sections = Array.from(sectionsMap.values())
      .sort((left, right) => left.sortIndex - right.sortIndex)
      .map((section) => ({
        id: section.id,
        name: section.name,
        imageCount: section.imageCount,
        coverImage: section.images[0] ?? null,
        images: section.images,
      }));

    return {
      user: {
        uid: userRecord.uid,
        email,
        displayName: userRecord.displayName?.trim() || null,
      },
      sections,
    };
  },
);

export const adminListPaymentsUsers = onCall(
  {region: CALLABLE_REGION, maxInstances: CALLABLE_MAX_INSTANCES},
  async (request): Promise<AdminListPaymentsUsersResponse> => {
    ensureAdminRequest(request);

    const data = (request.data ?? {}) as AdminListPaymentsUsersRequest;
    const limit = parsePageLimit(data.limit);
    const pageToken = parsePageToken(data.pageToken);
    const page = await auth.listUsers(limit, pageToken);

    return {
      users: page.users
        .map((userRecord) => mapPaymentUser(userRecord))
        .filter((user) => Boolean(user.email)),
      nextPageToken: page.pageToken ?? null,
      limit,
    };
  },
);
