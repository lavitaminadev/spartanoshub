import type { User } from '../../core/auth';
import { isModuleInPhaseScope } from '../../core/phase-scope';

export interface ClientPortalEntry {
  label: string;
  path: string;
  icon: string;
  module?: string;
  capability?: string;
  /** Visible si la empresa tiene al menos uno de estos servicios. */
  anyCapability?: string[];
  /** Visible si la persona tiene permiso en al menos uno de estos módulos. */
  anyModule?: string[];
}

export const CLIENT_NAV: ClientPortalEntry[] = [
  { label: 'Inicio', path: '/portal', icon: 'IN' },
  { label: 'CRM', path: '/crm', icon: 'CR', module: 'crm', capability: 'crm' },
  { label: 'Reservas', path: '/portal/reservations', icon: 'RS', module: 'reservations', capability: 'reservations' },
  { label: 'Encuestas', path: '/portal/surveys', icon: 'EN', module: 'surveys', capability: 'surveys' },
  // Sin servicio asociado: administrar el propio equipo no es algo que se contrate, es un
  // permiso que la agencia entrega empresa por empresa.
  { label: 'Equipo', path: '/users', icon: 'EQ', module: 'users' },
  // Los avisos que salen a nombre de la empresa. Se muestra si tiene alguno de los tres
  // servicios: son ellos los que generan correo.
  // Los avisos que salen a nombre de la empresa. Pide las dos cosas: que tenga alguno de los
  // servicios que generan correo, y permiso en él. Con el servicio solo, una persona sin acceso
  // a ese módulo vería —y editaría— lo que sale a nombre de la empresa.
  { label: 'Correos', path: '/correos', icon: 'CO', anyCapability: ['reservations', 'surveys', 'crm'], anyModule: ['reservations', 'surveys', 'crm'] },
  // Lo usan Reservas y Encuestas: basta con tener uno de los dos.
  { label: 'Datos legales', path: '/portal/legal', icon: 'DL', anyCapability: ['reservations', 'surveys'] },
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
  {
    title: 'Encuestas',
    description: 'Mira qué opinan tus clientes y lee cada respuesta.',
    link: '/portal/surveys',
    action: 'Ver encuestas',
    module: 'surveys',
    capability: 'surveys',
  },
  {
    title: 'Equipo',
    description: 'Crea las cuentas de tu empresa y decide qué ve cada persona.',
    link: '/users',
    action: 'Administrar equipo',
    module: 'users',
  },
];

export function isClientNavItemVisible(item: ClientPortalEntry, user: User | null): boolean {
  // En el portal la ausencia no significa «sí». Una sesión antigua, incompleta o una empresa
  // sin el servicio explícitamente activo debe fallar cerrada y no anunciar algo no contratado.
  if (item.capability && user?.capabilities?.[item.capability] !== true) return false;
  if (item.anyCapability && !item.anyCapability.some((servicio) => user?.capabilities?.[servicio] === true)) return false;
  /*
   * Con varios módulos basta uno, pero uno de verdad.
   *
   * Se exige la misma terna que un módulo único: fase, servicio contratado y permiso distinto de
   * «ninguno». Sin la última, una feature encendida se confundía con un acceso concedido.
   */
  if (item.anyModule) {
    return item.anyModule.some((modulo) => (
      isModuleInPhaseScope(modulo, user?.moduleLifecycle, user?.role)
      && user?.capabilities?.[modulo] === true
      && (user?.permissions?.[modulo] ?? 'none') !== 'none'
    ));
  }
  if (!item.module) return true;
  if (!isModuleInPhaseScope(item.module, user?.moduleLifecycle, user?.role)) return false;
  if (user?.features?.[item.module] === false) return false;
  return (user?.permissions?.[item.module] ?? 'none') !== 'none';
}

export function activePortalCards(user: User | null) {
  return PORTAL_CARDS.filter((card) => (
    // Una tarjeta sin servicio asociado no se contrata: basta el permiso. Con la comprobación
    // anterior, exigirlo dejaba fuera al Equipo, que no es un servicio sino una atribución.
    (!card.capability || user?.capabilities?.[card.capability] === true)
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
