/**
 * @fileoverview Route guard que restringe el acceso a las rutas del portal de clientes.
 */

import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from './auth';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { AccessDenied } from './AccessDenied';

/**
 * Props del route guard de cliente.
 */
export interface ClientRouteProps {
  /** Elemento(s) de ruta hijo a renderizar cuando el usuario es un cliente. */
  children: React.ReactNode;
  /** Servicio contratado que exige esta rama del portal. */
  capability?: 'crm' | 'reservations' | 'surveys';
  /** Alternativa a `capability`: basta con que la empresa tenga uno de estos servicios. */
  anyCapability?: Array<'crm' | 'reservations' | 'surveys'>;
}

/**
 * Envuelve rutas disponibles solo para usuarios con el rol `client`.
 */
export function ClientRoute({ children, capability, anyCapability }: ClientRouteProps): JSX.Element {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'client') return <Navigate to="/dashboard" replace />;
  // El cambio de clave temporal es obligatorio antes de operar el portal, con el mismo
  // criterio que `ProtectedRoute` aplica a las cuentas del equipo.
  if (user.mustChangePassword || user.mustCompleteProfile || user.mustAcceptTerms) return <Navigate to="/first-access" replace />;
  if (capability && user.capabilities?.[capability] !== true) {
    return <AccessDenied userRole={user.role} reason="module" />;
  }
  if (anyCapability && !anyCapability.some((servicio) => user.capabilities?.[servicio] === true)) {
    return <AccessDenied userRole={user.role} reason="module" />;
  }
  return <>{children}</>;
}
