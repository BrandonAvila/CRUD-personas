// Autenticación con Amazon Cognito sin dependencias extra: el endpoint
// cognito-idp acepta JSON plano con el header X-Amz-Target (el mismo
// protocolo que usa la AWS CLI). Solo se necesita el Client ID del app
// client (público, sin secret) y la región.

const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? '';
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? 'us-east-1';
const CLAVE_SESION = 'crud-personas.sesion';

// Sin Client ID configurado, el frontend trabaja sin login (ej. API local sin Cognito).
export const autenticacionHabilitada = CLIENT_ID !== '';

export type Sesion = {
  correo: string;
  idToken: string;
  refreshToken: string;
  expiraEn: number; 
};

export class ErrorSesionExpirada extends Error {
  constructor() {
    super('La sesión expiró. Inicia sesión de nuevo.');
    this.name = 'ErrorSesionExpirada';
  }
}

const MENSAJES_COGNITO: Record<string, string> = {
  NotAuthorizedException: 'Correo o contraseña incorrectos',
  UserNotFoundException: 'Correo o contraseña incorrectos',
  UserNotConfirmedException: 'El usuario no está confirmado',
  PasswordResetRequiredException: 'Este usuario debe restablecer su contraseña',
  TooManyRequestsException: 'Demasiados intentos; espera un momento y reintenta',
  LimitExceededException: 'Demasiados intentos; espera un momento y reintenta',
};

async function llamarCognito(operacion: string, cuerpo: unknown): Promise<any> {
  const res = await fetch(`https://cognito-idp.${REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${operacion}`,
    },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json();
  if (!res.ok) {
    // __type puede venir como "NotAuthorizedException" o "com.amazon...#NotAuthorizedException"
    const tipo = String(datos.__type ?? '').split('#').pop() ?? '';
    throw new Error(MENSAJES_COGNITO[tipo] ?? datos.message ?? 'Error de autenticación');
  }
  return datos;
}

export function obtenerSesion(): Sesion | null {
  if (typeof window === 'undefined') return null;
  const guardada = window.sessionStorage.getItem(CLAVE_SESION);
  if (!guardada) return null;
  try {
    return JSON.parse(guardada) as Sesion;
  } catch {
    return null;
  }
}

function guardarSesion(sesion: Sesion) {
  window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

export function cerrarSesion() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(CLAVE_SESION);
}

export async function iniciarSesion(correo: string, contrasena: string): Promise<Sesion> {
  const datos = await llamarCognito('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
  });
  const resultado = datos.AuthenticationResult;
  if (!resultado?.IdToken) {
    throw new Error('Cognito pidió un paso extra no soportado por esta demo (¿contraseña temporal?)');
  }
  const sesion: Sesion = {
    correo,
    idToken: resultado.IdToken,
    refreshToken: resultado.RefreshToken,
    expiraEn: Date.now() + resultado.ExpiresIn * 1000,
  };
  guardarSesion(sesion);
  return sesion;
}

async function renovarSesion(sesion: Sesion): Promise<Sesion | null> {
  try {
    const datos = await llamarCognito('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: sesion.refreshToken },
    });
    const resultado = datos.AuthenticationResult;
    if (!resultado?.IdToken) return null;
    const renovada: Sesion = {
      ...sesion,
      idToken: resultado.IdToken,
      expiraEn: Date.now() + resultado.ExpiresIn * 1000,
    };
    guardarSesion(renovada);
    return renovada;
  } catch {
    return null;
  }
}

/**
 * Igual que fetch, pero agrega el header Authorization cuando la autenticación
 * está habilitada, renueva el token si está por expirar y reintenta una vez
 * ante un 401. Lanza ErrorSesionExpirada si ya no hay sesión válida.
 */
export async function fetchAutorizado(url: string, init?: RequestInit): Promise<Response> {
  if (!autenticacionHabilitada) return fetch(url, init);

  let sesion = obtenerSesion();
  if (!sesion) throw new ErrorSesionExpirada();

  // Renovación anticipada: 1 minuto antes de expirar.
  if (Date.now() > sesion.expiraEn - 60_000) {
    sesion = await renovarSesion(sesion);
    if (!sesion) {
      cerrarSesion();
      throw new ErrorSesionExpirada();
    }
  }

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${sesion.idToken}`);
  let res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    const renovada = await renovarSesion(sesion);
    if (!renovada) {
      cerrarSesion();
      throw new ErrorSesionExpirada();
    }
    headers.set('Authorization', `Bearer ${renovada.idToken}`);
    res = await fetch(url, { ...init, headers });
  }
  return res;
}
