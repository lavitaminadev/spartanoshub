import type { Request } from 'express';
import type { UserRole } from '@espartanos/shared';

/**
 * Usuario autenticado adjuntado al request por la estrategia JWT.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  clientId?: string;
  /** Forma de usar el CRM. Ausente significa «lo que diga el cargo». Ver `lead-visibility.ts`. */
  crmProfile?: string | null;
  /**
   * Sesión desde la que llega la petición.
   *
   * Falta en los tokens anteriores a las sesiones, que siguen valiendo hasta vencer. Quien
   * dependa de él debe tratar la ausencia como «no se puede confirmar», no como «da igual».
   */
  sessionId?: string;
  tenantId: string;
}

/**
 * Request de Express extendido con el usuario autenticado y el tenant resuelto.
 *
 * Usar esto en vez de `Request` en controllers/guards que requieren autenticación.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  /** Id del tenant resuelto. Siempre presente en requests autenticados. */
  organizationId: string;
}
