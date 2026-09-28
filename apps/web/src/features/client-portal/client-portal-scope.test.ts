import { describe, expect, it } from 'vitest';
import type { User } from '../../core/auth';
import { activePortalCards, CLIENT_NAV, isClientNavItemVisible, isPortalPulseVisible } from './client-portal-scope';

function client(overrides: Partial<User> = {}): User {
  return {
    id: 'client-user',
    name: 'Empresa de prueba',
    email: 'cliente@example.com',
    role: 'client',
    capabilities: { crm: true, reservations: false },
    features: { crm: true, reservations: true },
    permissions: { crm: 'view', reservations: 'edit' },
    ...overrides,
  };
}

describe('portal del cliente en la operación inicial', () => {
  it('solo publica Inicio y los servicios efectivamente contratados', () => {
    const visible = CLIENT_NAV.filter((item) => isClientNavItemVisible(item, client())).map((item) => item.label);

    // Sin administrar la empresa no hay Correos: qué sale a su nombre lo decide quien la administra.
    expect(visible).toEqual(['Inicio', 'CRM']);
    expect(CLIENT_NAV.map((item) => item.label)).not.toContain('Aprobaciones');
    expect(CLIENT_NAV.map((item) => item.label)).not.toContain('Informes');
  });

  it('no confunde una feature encendida con un permiso efectivo', () => {
    const user = client({ permissions: { crm: 'none', reservations: 'edit' } });

    expect(CLIENT_NAV.filter((item) => isClientNavItemVisible(item, user)).map((item) => item.label)).toEqual(['Inicio']);
    expect(activePortalCards(user)).toEqual([]);
  });

  it('muestra CRM y Reservas juntos cuando ambos servicios están activos', () => {
    const user = client({ capabilities: { crm: true, reservations: true } });

    expect(activePortalCards(user).map((card) => card.title)).toEqual(['CRM', 'Reservas']);
  });

  it('ante capacidades ausentes no ofrece ningún servicio por defecto', () => {
    const user = client({ capabilities: undefined });

    expect(CLIENT_NAV.filter((item) => isClientNavItemVisible(item, user)).map((item) => item.label)).toEqual(['Inicio']);
    expect(activePortalCards(user)).toEqual([]);
  });

  it('no consulta Pulso mientras Reportes esté fuera del portal inicial', () => {
    const user = client({ features: { crm: true, reservations: true, reports: true }, permissions: { crm: 'view', reservations: 'edit', reports: 'view' } });
    expect(isPortalPulseVisible(user)).toBe(false);
  });
});

/*
 * Correos, dentro de una empresa, es de quien la administra.
 *
 * El resto de su equipo trabaja con sus reservas o sus leads, pero no decide qué correos salen a
 * nombre de la empresa. El servidor ya les negaba la entrada; el enlace aparecía igual en el menú.
 */
describe('Correos en el portal', () => {
  const correos = CLIENT_NAV.find((item) => item.label === 'Correos')!;

  it('lo ve quien administra su empresa', () => {
    expect(isClientNavItemVisible(correos, client({ permissions: { crm: 'view', reservations: 'edit', users: 'manage' } }))).toBe(true);
  });

  it('no lo ve el resto de su equipo, aunque trabaje con el servicio', () => {
    expect(isClientNavItemVisible(correos, client({ permissions: { crm: 'manage', reservations: 'manage', users: 'view' } }))).toBe(false);
  });

  it('ni el administrador lo ve si la empresa no tiene servicios que envíen correos', () => {
    expect(isClientNavItemVisible(correos, client({ capabilities: { crm: false, reservations: false }, permissions: { users: 'manage' } }))).toBe(false);
  });
});
