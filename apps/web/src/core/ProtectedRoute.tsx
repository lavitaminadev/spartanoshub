/**
 * @fileoverview Route guard que redirige a usuarios no autenticados a `/login`.
 */

import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from './auth';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { getAllowedRolesForPath, isPathEnabled } from './navigation.registry';
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
  if (user.role === 'client' && path && !path.startsWith('/portal')) {
    return <Navigate to="/portal" replace />;
  }
  // Las rutas de módulos sin acceso se bloquean también por URL directa, no solo se ocultan
  // del menú.
  const isPersonalRoute = path === '/first-access' || path === '/change-password' || path === '/sesiones';
  if (path && !isPersonalRoute && !isPathEnabled(path, user.features, user.permissions, user.moduleLifecycle)) {
    return <Navigate to="/404" replace />;
  }
  const roles = allowedRoles ?? (path ? getAllowedRolesForPath(path) : undefined);
  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/404" replace />;
  }
  return <>{children}</>;
}
