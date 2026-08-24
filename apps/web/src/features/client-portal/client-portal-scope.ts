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
  if (item.capability && user?.capabilities?.[item.capability] === false) return false;
  if (!item.module) return true;
  if (!isModuleInPhaseScope(item.module, user?.moduleLifecycle, user?.role)) return false;
  if (user?.features?.[item.module] === false) return false;
  return (user?.permissions?.[item.module] ?? 'none') !== 'none';
}

export function activePortalCards(user: User | null) {
  return PORTAL_CARDS.filter((card) => (
    user?.capabilities?.[card.capability] !== false
    && user?.features?.[card.module] !== false
    && (user?.permissions?.[card.module] ?? 'none') !== 'none'
  ));
}
