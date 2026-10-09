import {HttpsError, type CallableRequest} from "firebase-functions/v2/https";

export const ADMIN_EMAIL = "artbenitezdev@gmail.com";

const normalizeEmail = (value: string | undefined): string =>
  value?.trim().toLowerCase() ?? "";

export const ensureAdminRequest = (
  request: CallableRequest<unknown>,
): void => {
  const uid = request.auth?.uid?.trim() ?? "";
  const tokenEmailRaw = request.auth?.token.email;
  const tokenEmail =
    typeof tokenEmailRaw === "string" ? normalizeEmail(tokenEmailRaw) : "";

  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  if (!tokenEmail || tokenEmail !== ADMIN_EMAIL) {
    throw new HttpsError(
      "permission-denied",
      "Solo el administrador puede usar este modulo.",
    );
  }
};

