import { describe, expect, it } from 'vitest';
import { rutaDatosLegales } from './ClientLegalData';
import { CLIENT_NAV, isClientNavItemVisible } from './client-portal-scope';
import type { User } from '../../core/auth';

function empresa(capabilities: Record<string, boolean>): User {
  return { id: 'u', role: 'client', clientId: 'c', capabilities, permissions: {}, features: {}, moduleLifecycle: {} } as unknown as User;
}

describe('datos legales en el portal', () => {
  const legal = CLIENT_NAV.find((item) => item.path === '/portal/legal')!;

  it('se ven con Reservas o con Encuestas, y no con sólo CRM', () => {
    expect(isClientNavItemVisible(legal, empresa({ reservations: true }))).toBe(true);
    expect(isClientNavItemVisible(legal, empresa({ surveys: true }))).toBe(true);
    expect(isClientNavItemVisible(legal, empresa({ crm: true }))).toBe(false);
  });

  it('usan la ruta del servicio que la empresa tiene', () => {
    expect(rutaDatosLegales({ reservations: true, surveys: true })).toBe('/reservations/company-legal');
    expect(rutaDatosLegales({ reservations: false, surveys: true })).toBe('/surveys/company-legal');
    expect(rutaDatosLegales({ surveys: true })).toBe('/surveys/company-legal');
    expect(rutaDatosLegales({ reservations: true }, 'c 1')).toBe('/reservations/company-legal?clientId=c%201');
  });
});
