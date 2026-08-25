import type { User } from '../../core/auth';
import { isModuleInPhaseScope } from '../../core/phase-scope';

export interface ClientPortalEntry {
  label: string;
  path: string;
  icon: string;
  module?: string;
  capability?: string;
}

export const CLIENT_NAV: ClientPortalEntry[] = [
  { label: 'Inicio', path: '/portal', icon: 'IN' },
  { label: 'CRM', path: '/crm', icon: 'CR', module: 'crm', capability: 'crm' },
  { label: 'Reservas', path: '/portal/reservations', icon: 'RS', module: 'reservations', capability: 'reservations' },
];

export const PORTAL_CARDS = [
  {
    title: 'CRM',
    description: 'Revisa los contactos y el avance comercial de tu empresa.',
    link: '/crm',
    action: 'Abrir CRM',
    module: 'crm',
    capability: 'crm',
  },
  {
    title: 'Reservas',
    description: 'Administra tus reservas, horarios y disponibilidad.',
    link: '/portal/reservations',
    action: 'Abrir reservas',
    module: 'reservations',
    capability: 'reservations',
  },
];

export function isClientNavItemVisible(item: ClientPortalEntry, user: User | null): boolean {
  // En el portal la ausencia no significa «sí». Una sesión antigua, incompleta o una empresa
  // sin el servicio explícitamente activo debe fallar cerrada y no anunciar algo no contratado.
  if (item.capability && user?.capabilities?.[item.capability] !== true) return false;
  if (!item.module) return true;
  if (!isModuleInPhaseScope(item.module, user?.moduleLifecycle, user?.role)) return false;
  if (user?.features?.[item.module] === false) return false;
  return (user?.permissions?.[item.module] ?? 'none') !== 'none';
}

export function activePortalCards(user: User | null) {
  return PORTAL_CARDS.filter((card) => (
    user?.capabilities?.[card.capability] === true
    && user?.features?.[card.module] !== false
    && (user?.permissions?.[card.module] ?? 'none') !== 'none'
  ));
}

/** El pulso pertenece a Reportes; no se consulta ni se anuncia mientras ese módulo no exista para el portal. */
export function isPortalPulseVisible(user: User | null): boolean {
  return isModuleInPhaseScope('reports', user?.moduleLifecycle, user?.role)
    && user?.features?.reports === true
    && (user?.permissions?.reports ?? 'none') !== 'none';
}
