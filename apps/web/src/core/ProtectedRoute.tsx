/**
 * @fileoverview Route guard que redirige a usuarios no autenticados a `/login`.
 */

import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from './auth';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { getAllowedRolesForPath, isPathEnabled, isRoleAllowedForPath } from './navigation.registry';
import { AccessDenied } from './AccessDenied';
import type { UserRole } from '@espartanos/shared';

/**
 * Props del route guard protegido.
 */
export interface ProtectedRouteProps {
  /** Elemento(s) de ruta hijo a renderizar cuando está autenticado. */
  children: React.ReactNode;
  /** Ruta opcional usada para derivar restricciones de rol desde los manifiestos de features. */
  path?: string;
  /** Lista blanca de roles explícita opcional. */
  allowedRoles?: UserRole[];
}

/**
 * Envuelve rutas que requieren una sesión autenticada.
 */
export function ProtectedRoute({ children, path, allowedRoles }: ProtectedRouteProps): JSX.Element {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  const needsFirstAccess = Boolean(user.mustChangePassword || user.mustCompleteProfile || user.mustAcceptTerms);
  if (needsFirstAccess && path !== '/first-access') {
    return <Navigate to="/first-access" replace />;
  }
  if (!needsFirstAccess && path === '/first-access') {
    return <Navigate to={user.role === 'client' ? '/portal' : '/dashboard'} replace />;
  }
  // Las rutas de módulos sin acceso se bloquean también por URL directa, no solo se ocultan
  // del menú.
  const isPersonalRoute = path === '/first-access' || path === '/change-password' || path === '/sesiones';
  // El portal vive bajo `/portal`, salvo estas rutas personales. La comprobación debe ocurrir
  // después de reconocerlas: una cuenta nueva necesita abrir `/first-access`; devolverla al
  // portal desde ahí crea un bucle `/portal` -> `/first-access` -> `/portal` y deja todo blanco.
  // El CRM contratado conserva sus rutas canónicas: duplicarlo bajo `/portal/crm` obligaría a
  // mantener dos árboles de enlaces y terminaría separando la vista del cliente del mismo dato.
  // La matriz efectiva sigue siendo la puerta: un cliente sin CRM recibe el bloqueo normal.
  const isClientCrmRoute = path === '/crm' || path?.startsWith('/crm/');
  if (user.role === 'client' && path && !path.startsWith('/portal') && !isPersonalRoute && !isClientCrmRoute) {
    return <Navigate to="/portal" replace />;
  }
  // El dashboard es la superficie base de cualquier cuenta interna. Si una respuesta
  // transitoria de permisos llega incompleta durante el arranque, no debemos redirigirlo
  // sobre sí mismo (ni convertir el inicio de sesión en un 404). Los módulos secundarios
  // siguen protegidos por feature, ciclo de vida y permiso efectivo.
  const isInternalDashboard = path === '/dashboard' && user.role !== 'client';
  // Un bloqueo se explica, no se disimula. Antes ambos casos devolvían al inicio en silencio y
  // eso se reporta como pantalla rota, cuando en realidad es un permiso que falta.
  const roles = allowedRoles ?? (path ? getAllowedRolesForPath(path) : undefined);
  if (path && !isPersonalRoute && !isInternalDashboard && !isPathEnabled(path, user.features, user.permissions, user.moduleLifecycle, user.role)) {
    return <AccessDenied path={path} userRole={user.role} allowedRoles={roles} reason="module" />;
  }
  if (!isRoleAllowedForPath(roles, user.role)) {
    return <AccessDenied path={path} userRole={user.role} allowedRoles={roles} reason="role" />;
  }
  return <>{children}</>;
}
