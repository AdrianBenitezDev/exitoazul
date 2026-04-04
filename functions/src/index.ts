import {randomBytes} from "node:crypto";
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {
  HttpsError,
  onCall,
  onRequest,
  type CallableRequest,
} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

setGlobalOptions({maxInstances: 10});

initializeApp();
const db = getFirestore();

type ShareTargetType = "image" | "section" | "images";

type ShareLinkDoc = {
  ownerId: string;
  ownerNickname?: string;
  targetType: ShareTargetType;
  targetId: string;
  targetIds?: string[];
  expiresAt: Timestamp;
  isRevoked: boolean;
};

type CreateShareLinkRequest = {
  targetType?: string;
  targetId?: string;
  targetIds?: unknown;
  ttlHours?: number;
  baseUrl?: string;
};

type CheckNicknameAvailabilityRequest = {
  nickname?: string;
};

type ClaimNicknameRequest = {
  nickname?: string;
  fullName?: string;
};

type RevokeShareLinkRequest = {
  token?: string;
};

type ResolveSharedGalleryRequest = {
  token?: string;
  baseUrl?: string;
};

type ImageDoc = {
  fileName?: string;
  sectionId?: string;
  storagePath?: string;
  downloadUrl?: string;
  createdAt?: Timestamp;
};

type SectionDoc = {
  name?: string;
};

type UserProfileDoc = {
  nickname?: string;
  nicknameKey?: string;
  fullName?: string;
};

type NicknameDoc = {
  ownerId?: string;
  nickname?: string;
};

type SharedImageItem = {
  id: string;
  fileName: string;
  storagePath: string;
  sectionId: string;
  createdAtMillis: number;
};

const DEFAULT_TTL_HOURS = 24;
const MIN_TTL_HOURS = 1;
const MAX_TTL_HOURS = 24 * 7;
const MAX_SHARED_IMAGES = 120;
const SHARE_TOKEN_LENGTH = 10;
const SHARE_TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_NICKNAME_LENGTH = 14;
const NICKNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const trimFinalSlash = (value: string): string => value.replace(/\/+$/, "");

const getUidFromRequest = (request: CallableRequest<unknown>): string => {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  return uid;
};

const parseTargetType = (value: string | undefined): ShareTargetType => {
  if (value === "image" || value === "section" || value === "images") {
    return value;
  }

  throw new HttpsError("invalid-argument", "targetType invalido.");
};

const parseTargetId = (value: string | undefined): string => {
  const targetId = value?.trim() ?? "";

  if (!targetId) {
    throw new HttpsError("invalid-argument", "targetId es obligatorio.");
  }

  return targetId;
};

const parseImageId = (value: string | undefined): string => {
  const imageId = value?.trim() ?? "";

  if (!imageId) {
    throw new HttpsError("invalid-argument", "imageId es obligatorio.");
  }

  if (!/^[A-Za-z0-9_-]{1,200}$/.test(imageId)) {
    throw new HttpsError("invalid-argument", "Formato de imageId invalido.");
  }

  return imageId;
};

const parseImageIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    throw new HttpsError(
      "invalid-argument",
      "targetIds es obligatorio para compartir multiples imagenes.",
    );
  }

  const parsed = value.map((entry) => {
    if (typeof entry !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "targetIds contiene elementos con formato invalido.",
      );
    }

    return parseImageId(entry);
  });

  const uniqueImageIds: string[] = [];
  const seen = new Set<string>();

  parsed.forEach((imageId) => {
    if (seen.has(imageId)) {
      return;
    }

    seen.add(imageId);
    uniqueImageIds.push(imageId);
  });

  if (uniqueImageIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Debes indicar al menos una imagen para compartir.",
    );
  }

  if (uniqueImageIds.length > MAX_SHARED_IMAGES) {
    throw new HttpsError(
      "invalid-argument",
      `No puedes compartir mas de ${MAX_SHARED_IMAGES} imagenes por link.`,
    );
  }

  return uniqueImageIds;
};

const parseTtlHours = (value: number | undefined): number => {
  const ttl = typeof value === "number" && Number.isFinite(value) ?
    Math.floor(value) :
    DEFAULT_TTL_HOURS;

  if (ttl < MIN_TTL_HOURS || ttl > MAX_TTL_HOURS) {
    throw new HttpsError(
      "invalid-argument",
      `ttlHours debe estar entre ${MIN_TTL_HOURS} y ${MAX_TTL_HOURS}.`,
    );
  }

  return ttl;
};

const parseToken = (value: string | undefined): string => {
  const token = value?.trim() ?? "";

  if (!token) {
    throw new HttpsError("invalid-argument", "token es obligatorio.");
  }

  if (!/^[A-Za-z0-9_-]{10,128}$/.test(token)) {
    throw new HttpsError("invalid-argument", "Formato de token invalido.");
  }

  return token;
};

const generateShareToken = (length: number = SHARE_TOKEN_LENGTH): string => {
  const bytes = randomBytes(length);
  let token = "";

  for (let index = 0; index < length; index += 1) {
    const alphabetIndex = bytes[index] % SHARE_TOKEN_ALPHABET.length;
    token += SHARE_TOKEN_ALPHABET[alphabetIndex];
  }

  return token;
};

const normalizeNickname = (value: string): string => value.trim().toLowerCase();

const parseNickname = (value: string | undefined): string => {
  const nickname = value?.trim() ?? "";

  if (!nickname) {
    throw new HttpsError("invalid-argument", "El apodo es obligatorio.");
  }

  if (nickname.length > MAX_NICKNAME_LENGTH) {
    const maxCharsRule =
      "El apodo debe tener menos de 15 caracteres " +
      `(maximo ${MAX_NICKNAME_LENGTH}).`;

    throw new HttpsError(
      "invalid-argument",
      maxCharsRule,
    );
  }

  if (!NICKNAME_PATTERN.test(nickname)) {
    const nicknameRule =
      "El apodo solo puede contener letras, numeros, " +
      "punto, guion o guion bajo.";

    throw new HttpsError(
      "invalid-argument",
      nicknameRule,
    );
  }

  return nickname;
};

const getDefaultShareBaseUrl = (): string => {
  const projectId = process.env.GCLOUD_PROJECT ?? "";

  if (projectId) {
    return `https://${projectId}.web.app`;
  }

  return "http://localhost:5173";
};

const getShareBaseUrl = (value: string | undefined): string => {
  const candidate = value?.trim() ?? "";
  const fallback = getDefaultShareBaseUrl();

  if (!candidate) {
    return fallback;
  }

  if (!/^https?:\/\//.test(candidate)) {
    return fallback;
  }

  return trimFinalSlash(candidate);
};

const getSectionRef = (uid: string, sectionId: string) =>
  db.collection("users").doc(uid).collection("sections").doc(sectionId);

const getImageRef = (uid: string, imageId: string) =>
  db.collection("users").doc(uid).collection("images").doc(imageId);

const getShareRef = (token: string) => db.collection("publicShares").doc(token);
const getUserRef = (uid: string) => db.collection("users").doc(uid);
const getNicknameRef = (nicknameKey: string) =>
  db.collection("nicknames").doc(nicknameKey);

const getShareImageIds = (shareData: ShareLinkDoc): string[] => {
  if (shareData.targetType === "images") {
    const source = Array.isArray(shareData.targetIds) ?
      shareData.targetIds :
      [];
    const normalized: string[] = [];
    const seen = new Set<string>();

    source.forEach((imageId) => {
      const safeImageId = imageId?.trim() ?? "";
      if (!safeImageId || seen.has(safeImageId)) {
        return;
      }

      seen.add(safeImageId);
      normalized.push(safeImageId);
    });

    return normalized;
  }

  return shareData.targetId ? [shareData.targetId] : [];
};

const readQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

const extractStoragePathFromDownloadUrl = (
  value: string | undefined,
): string => {
  const source = value?.trim() ?? "";

  if (!source) {
    return "";
  }

  const matched = source.match(/\/o\/([^?]+)/);
  if (!matched || !matched[1]) {
    return "";
  }

  try {
    return decodeURIComponent(matched[1]);
  } catch {
    return "";
  }
};

const resolveImageStoragePath = (data: ImageDoc): string =>
  data.storagePath?.trim() ||
  extractStoragePathFromDownloadUrl(data.downloadUrl);

const buildSharedImageProxyUrl = (
  shareBaseUrl: string,
  token: string,
  imageId: string,
): string =>
  `${trimFinalSlash(shareBaseUrl)}/api/shared-image` +
  `?token=${encodeURIComponent(token)}` +
  `&imageId=${encodeURIComponent(imageId)}`;

const readActiveShare = async (token: string): Promise<{
  shareData: ShareLinkDoc;
  expiresAtDate: Date;
}> => {
  const shareSnapshot = await getShareRef(token).get();

  if (!shareSnapshot.exists) {
    throw new HttpsError("not-found", "Link temporal inexistente.");
  }

  const shareData = shareSnapshot.data() as ShareLinkDoc;
  const expiresAtDate = shareData.expiresAt instanceof Timestamp ?
    shareData.expiresAt.toDate() :
    new Date(0);

  if (shareData.isRevoked) {
    throw new HttpsError("failed-precondition", "Este link fue revocado.");
  }

  if (expiresAtDate.getTime() <= Date.now()) {
    throw new HttpsError("failed-precondition", "Este link temporal expiro.");
  }

  return {
    shareData,
    expiresAtDate,
  };
};

const getHttpStatusFromHttpsError = (error: HttpsError): number => {
  switch (error.code) {
  case "invalid-argument":
    return 400;
  case "permission-denied":
    return 403;
  case "not-found":
    return 404;
  case "failed-precondition":
    return 410;
  default:
    return 500;
  }
};

const ensureTargetOwnership = async (
  ownerId: string,
  targetType: ShareTargetType,
  targetId: string,
): Promise<void> => {
  if (targetType === "image") {
    const imageSnapshot = await getImageRef(ownerId, targetId).get();
    if (!imageSnapshot.exists) {
      throw new HttpsError("not-found", "La imagen indicada no existe.");
    }
    return;
  }

  const sectionSnapshot = await getSectionRef(ownerId, targetId).get();
  if (!sectionSnapshot.exists) {
    throw new HttpsError("not-found", "La seccion indicada no existe.");
  }
};

const ensureImagesOwnership = async (
  ownerId: string,
  imageIds: string[],
): Promise<void> => {
  const snapshots = await Promise.all(
    imageIds.map((imageId) => getImageRef(ownerId, imageId).get()),
  );

  const missingImageId = snapshots.findIndex((snapshot) => !snapshot.exists);
  if (missingImageId >= 0) {
    throw new HttpsError(
      "not-found",
      `La imagen indicada no existe: ${imageIds[missingImageId]}.`,
    );
  }
};

const readOwnerNickname = async (uid: string): Promise<string> => {
  const userSnapshot = await getUserRef(uid).get();

  if (!userSnapshot.exists) {
    return "Usuario";
  }

  const userData = userSnapshot.data() as UserProfileDoc;
  const nickname = userData.nickname?.trim() ?? "";
  return nickname || "Usuario";
};

const toSharedImageItem = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): SharedImageItem | null => {
  const data = snapshot.data() as ImageDoc;
  const storagePath = resolveImageStoragePath(data);

  if (!storagePath) {
    return null;
  }

  const createdAtMillis = data.createdAt instanceof Timestamp ?
    data.createdAt.toMillis() :
    0;

  return {
    id: snapshot.id,
    fileName: data.fileName?.trim() || snapshot.id,
    storagePath,
    sectionId: data.sectionId ?? "",
    createdAtMillis,
  };
};

const toPublicImage = (
  image: SharedImageItem,
  shareBaseUrl: string,
  token: string,
) => ({
  id: image.id,
  fileName: image.fileName,
  previewUrl: buildSharedImageProxyUrl(shareBaseUrl, token, image.id),
  sectionId: image.sectionId,
});

const readSectionName = async (
  ownerId: string,
  sectionId: string,
): Promise<string> => {
  if (!sectionId) {
    return "Seccion compartida";
  }

  const sectionSnapshot = await getSectionRef(ownerId, sectionId).get();
  if (!sectionSnapshot.exists) {
    return "Seccion compartida";
  }

  const sectionData = sectionSnapshot.data() as SectionDoc;
  return sectionData.name?.trim() || "Seccion compartida";
};

const resolveImageTarget = async (params: {
  ownerId: string;
  imageId: string;
  shareToken: string;
  shareBaseUrl: string;
}) => {
  const {ownerId, imageId, shareToken, shareBaseUrl} = params;
  const imageSnapshot = await getImageRef(ownerId, imageId).get();

  if (!imageSnapshot.exists) {
    throw new HttpsError("not-found", "La imagen compartida no existe.");
  }

  const imageData = imageSnapshot.data() as ImageDoc;
  const storagePath = resolveImageStoragePath(imageData);

  if (!storagePath) {
    throw new HttpsError(
      "failed-precondition",
      "La imagen no tiene una ruta valida en almacenamiento.",
    );
  }

  const sectionName = await readSectionName(ownerId, imageData.sectionId ?? "");
  const sharedImage: SharedImageItem = {
    id: imageSnapshot.id,
    fileName: imageData.fileName?.trim() || imageSnapshot.id,
    storagePath,
    sectionId: imageData.sectionId ?? "",
    createdAtMillis: imageData.createdAt instanceof Timestamp ?
      imageData.createdAt.toMillis() :
      0,
  };

  return {
    sectionName,
    images: [toPublicImage(sharedImage, shareBaseUrl, shareToken)],
  };
};

const resolveImagesTarget = async (params: {
  ownerId: string;
  imageIds: string[];
  shareToken: string;
  shareBaseUrl: string;
}) => {
  const {ownerId, imageIds, shareToken, shareBaseUrl} = params;
  const snapshots = await Promise.all(
    imageIds.map((imageId) => getImageRef(ownerId, imageId).get()),
  );

  const images: SharedImageItem[] = [];
  let firstSectionId = "";

  snapshots.forEach((snapshot) => {
    if (!snapshot.exists) {
      return;
    }

    const imageData = snapshot.data() as ImageDoc;
    const storagePath = resolveImageStoragePath(imageData);
    if (!storagePath) {
      return;
    }

    if (!firstSectionId) {
      firstSectionId = imageData.sectionId ?? "";
    }

    images.push({
      id: snapshot.id,
      fileName: imageData.fileName?.trim() || snapshot.id,
      storagePath,
      sectionId: imageData.sectionId ?? "",
      createdAtMillis: imageData.createdAt instanceof Timestamp ?
        imageData.createdAt.toMillis() :
        0,
    });
  });

  const sectionName = firstSectionId ?
    await readSectionName(ownerId, firstSectionId) :
    "Seleccion compartida";

  return {
    sectionName,
    images: images.map(
      (image) => toPublicImage(image, shareBaseUrl, shareToken),
    ),
  };
};

const resolveSectionTarget = async (params: {
  ownerId: string;
  sectionId: string;
  shareToken: string;
  shareBaseUrl: string;
}) => {
  const {ownerId, sectionId, shareToken, shareBaseUrl} = params;

  const sectionSnapshot = await getSectionRef(ownerId, sectionId).get();
  if (!sectionSnapshot.exists) {
    throw new HttpsError("not-found", "La seccion compartida no existe.");
  }

  const sectionData = sectionSnapshot.data() as SectionDoc;
  const sectionName = sectionData.name?.trim() || "Seccion compartida";

  const imagesSnapshot = await db.collection("users")
    .doc(ownerId)
    .collection("images")
    .where("sectionId", "==", sectionId)
    .limit(MAX_SHARED_IMAGES)
    .get();

  const images = imagesSnapshot.docs
    .map((docSnapshot) => toSharedImageItem(docSnapshot))
    .filter((image): image is SharedImageItem => image !== null)
    .sort((a, b) => b.createdAtMillis - a.createdAtMillis)
    .map((image) => toPublicImage(image, shareBaseUrl, shareToken));

  return {
    sectionName,
    images,
  };
};

export const health = onRequest((request, response) => {
  logger.info("Health check", {method: request.method, path: request.path});
  response.status(200).send("Exito Azul Functions OK");
});

export const serveSharedImage = onRequest(async (request, response) => {
  if (request.method !== "GET") {
    response.set("Allow", "GET");
    response.status(405).send("Method not allowed");
    return;
  }

  try {
    const token = parseToken(readQueryValue(request.query.token));
    const imageId = parseImageId(readQueryValue(request.query.imageId));
    const {shareData} = await readActiveShare(token);

    if (shareData.targetType === "image" && shareData.targetId !== imageId) {
      throw new HttpsError(
        "permission-denied",
        "La imagen solicitada no corresponde al token.",
      );
    }

    if (shareData.targetType === "images") {
      const allowedImageIds = getShareImageIds(shareData);

      if (!allowedImageIds.includes(imageId)) {
        throw new HttpsError(
          "permission-denied",
          "La imagen solicitada no corresponde al lote compartido.",
        );
      }
    }

    const imageSnapshot = await getImageRef(shareData.ownerId, imageId).get();
    if (!imageSnapshot.exists) {
      throw new HttpsError("not-found", "La imagen solicitada no existe.");
    }

    const imageData = imageSnapshot.data() as ImageDoc;
    if (
      shareData.targetType === "section" &&
      imageData.sectionId !== shareData.targetId
    ) {
      throw new HttpsError(
        "permission-denied",
        "La imagen solicitada no pertenece a la seccion compartida.",
      );
    }

    const storagePath = resolveImageStoragePath(imageData);
    if (!storagePath) {
      throw new HttpsError(
        "failed-precondition",
        "La imagen no tiene ruta valida en almacenamiento.",
      );
    }

    const file = getStorage().bucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", "El archivo de imagen no existe.");
    }

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/octet-stream";
    const fileName = (imageData.fileName?.trim() || imageSnapshot.id)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    response.set("Cache-Control", "private, no-store, max-age=0");
    response.set("Pragma", "no-cache");
    response.set("X-Content-Type-Options", "nosniff");
    response.set("Content-Disposition", `inline; filename="${fileName}"`);
    response.set("Content-Type", contentType);
    response.status(200).send(buffer);
  } catch (error) {
    if (error instanceof HttpsError) {
      response.status(getHttpStatusFromHttpsError(error)).send(error.message);
      return;
    }

    logger.error("Shared image delivery failed", error);
    response.status(500).send("No fue posible resolver la imagen compartida.");
  }
});

export const checkNicknameAvailability = onCall(async (request) => {
  const data = (request.data ?? {}) as CheckNicknameAvailabilityRequest;
  const nickname = parseNickname(data.nickname);
  const nicknameKey = normalizeNickname(nickname);
  const nicknameSnapshot = await getNicknameRef(nicknameKey).get();

  return {
    nickname,
    nicknameKey,
    available: !nicknameSnapshot.exists,
  };
});

export const claimNickname = onCall(async (request) => {
  const uid = getUidFromRequest(request);
  const data = (request.data ?? {}) as ClaimNicknameRequest;
  const nickname = parseNickname(data.nickname);
  const nicknameKey = normalizeNickname(nickname);
  const fullName = data.fullName?.trim() ?? "";
  const userRef = getUserRef(uid);
  const nicknameRef = getNicknameRef(nicknameKey);

  await db.runTransaction(async (transaction) => {
    const nicknameSnapshot = await transaction.get(nicknameRef);

    if (nicknameSnapshot.exists) {
      const nicknameData = nicknameSnapshot.data() as NicknameDoc;
      if (nicknameData.ownerId !== uid) {
        throw new HttpsError("already-exists", "El apodo ya esta en uso.");
      }
    }

    const userSnapshot = await transaction.get(userRef);
    const userData = userSnapshot.data() as UserProfileDoc | undefined;
    const previousNicknameKey = userData?.nicknameKey?.trim().toLowerCase() ??
      "";
    const removePreviousNickname =
      previousNicknameKey && previousNicknameKey !== nicknameKey;

    if (removePreviousNickname) {
      const previousNicknameRef = getNicknameRef(previousNicknameKey);
      const previousNicknameSnapshot = await transaction.get(
        previousNicknameRef,
      );

      if (previousNicknameSnapshot.exists) {
        const previousNicknameData =
          previousNicknameSnapshot.data() as NicknameDoc;
        if (previousNicknameData.ownerId === uid) {
          transaction.delete(previousNicknameRef);
        }
      }
    }

    const nicknamePayload: Record<string, unknown> = {
      ownerId: uid,
      nickname,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!nicknameSnapshot.exists) {
      nicknamePayload.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(nicknameRef, nicknamePayload, {merge: true});

    const userPayload: Record<string, unknown> = {
      nickname,
      nicknameKey,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!userSnapshot.exists) {
      userPayload.createdAt = FieldValue.serverTimestamp();
    }

    if (fullName) {
      userPayload.fullName = fullName;
    }

    transaction.set(userRef, userPayload, {merge: true});
  });

  return {
    nickname,
    nicknameKey,
  };
});

export const createShareLink = onCall(async (request) => {
  const uid = getUidFromRequest(request);
  const data = (request.data ?? {}) as CreateShareLinkRequest;
  const targetType = parseTargetType(data.targetType);
  const ttlHours = parseTtlHours(data.ttlHours);
  const ownerNickname = await readOwnerNickname(uid);
  let targetId = "";
  let targetIds: string[] | undefined;

  if (targetType === "images") {
    targetIds = parseImageIds(data.targetIds);
    targetId = targetIds[0];
    await ensureImagesOwnership(uid, targetIds);
  } else {
    targetId = parseTargetId(data.targetId);
    await ensureTargetOwnership(uid, targetType, targetId);
  }

  const token = generateShareToken();
  const expiresAtDate = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const expiresAt = Timestamp.fromDate(expiresAtDate);
  const shareBaseUrl = getShareBaseUrl(data.baseUrl);
  const url = `${shareBaseUrl}/s/${token}`;

  const shareDoc: ShareLinkDoc = {
    ownerId: uid,
    ownerNickname,
    targetType,
    targetId,
    targetIds,
    expiresAt,
    isRevoked: false,
  };

  await db.collection("publicShares").doc(token).set({
    ...shareDoc,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info("Share link created", {
    ownerId: uid,
    ownerNickname,
    targetType,
    targetId,
    targetIdsCount: targetIds?.length ?? 0,
    token,
    ttlHours,
  });

  return {
    token,
    url,
    expiresAt: expiresAtDate.toISOString(),
    targetType,
    targetId,
    targetIds: targetIds ?? [targetId],
    ownerNickname,
  };
});

export const revokeShareLink = onCall(async (request) => {
  const uid = getUidFromRequest(request);
  const data = (request.data ?? {}) as RevokeShareLinkRequest;
  const token = parseToken(data.token);
  const shareRef = db.collection("publicShares").doc(token);
  const shareSnapshot = await shareRef.get();

  if (!shareSnapshot.exists) {
    throw new HttpsError("not-found", "El link temporal no existe.");
  }

  const shareData = shareSnapshot.data() as ShareLinkDoc;
  if (shareData.ownerId !== uid) {
    throw new HttpsError("permission-denied", "No puedes revocar este link.");
  }

  await shareRef.set({
    isRevoked: true,
    revokedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});

  logger.info("Share link revoked", {
    ownerId: uid,
    token,
  });

  return {
    token,
    revoked: true,
  };
});

export const resolveSharedGallery = onCall(async (request) => {
  const data = (request.data ?? {}) as ResolveSharedGalleryRequest;
  const token = parseToken(data.token);
  const shareBaseUrl = getShareBaseUrl(data.baseUrl);
  const {shareData, expiresAtDate} = await readActiveShare(token);
  const targetIds = getShareImageIds(shareData);

  const target = shareData.targetType === "image" ?
    await resolveImageTarget({
      ownerId: shareData.ownerId,
      imageId: shareData.targetId,
      shareToken: token,
      shareBaseUrl,
    }) :
    shareData.targetType === "section" ?
      await resolveSectionTarget({
        ownerId: shareData.ownerId,
        sectionId: shareData.targetId,
        shareToken: token,
        shareBaseUrl,
      }) :
      await resolveImagesTarget({
        ownerId: shareData.ownerId,
        imageIds: targetIds,
        shareToken: token,
        shareBaseUrl,
      });

  logger.info("Share link resolved", {
    token,
    targetType: shareData.targetType,
    targetId: shareData.targetId,
    targetIdsCount: targetIds.length,
  });

  return {
    token,
    targetType: shareData.targetType,
    targetId: shareData.targetId,
    targetIds,
    ownerNickname: shareData.ownerNickname ?? "Usuario",
    expiresAt: expiresAtDate.toISOString(),
    sectionName: target.sectionName,
    images: target.images,
  };
});
