const FALLBACK_MESSAGE = 'No se pudo completar la autenticacion. Intenta nuevamente.';

const authErrorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Ese email ya esta registrado. Prueba iniciar sesion.',
  'auth/invalid-email': 'El formato del email no es valido.',
  'auth/weak-password': 'La clave es muy debil. Usa al menos 6 caracteres.',
  'auth/user-not-found': 'No existe una cuenta con ese email.',
  'auth/wrong-password': 'La clave es incorrecta.',
  'auth/invalid-credential': 'Email o clave incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Fallo de red. Revisa tu conexion e intenta otra vez.',
  'auth/operation-not-allowed': 'Metodo de login no habilitado.',
};

export const getAuthErrorMessage = (
  error: unknown,
  fallback: string = FALLBACK_MESSAGE,
): string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const errorCode = (error as { code?: string }).code;
    if (errorCode && authErrorMessages[errorCode]) {
      return authErrorMessages[errorCode];
    }
  }

  return fallback;
};
