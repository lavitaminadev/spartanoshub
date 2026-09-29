import { describe, expect, it, vi } from 'vitest';
import { AccountAccessService } from '../../../src/core/client-scope/account-access.service';

/*
 * La columna Alcance de Usuarios muestra todas las empresas que alcanza cada persona: la propia,
 * las de sus pods, las asignadas y las que maneja como community manager. Sin límite, «todas».
 */
function servicio() {
  const clients = {
    find: vi.fn(async ({ where }: { where: Record<string, unknown> }) => (
      'podId' in where
        ? [{ id: 'c-pod-1', podId: 'pod-a' }, { id: 'c-pod-2', podId: 'pod-a' }]
        : [{ id: 'c-cm', communityManagerId: 'valentina' }]
    )),
  };
  const podMembers = { find: vi.fn(async () => [{ userId: 'valentina', podId: 'pod-a' }]) };
  const assignments = { find: vi.fn(async () => [{ userId: 'valentina', clientId: 'c-prestada' }, { userId: 'ana', clientId: 'c-otra' }]) };
  return new AccountAccessService(clients as never, podMembers as never, assignments as never);
}

describe('empresas de cada persona', () => {
  it('suma pods, asignaciones y cuentas que maneja, sin repetir', async () => {
    const mapa = await servicio().empresasDe('org', [{ id: 'valentina', role: 'community_manager' }]);
    expect(mapa.get('valentina')).toEqual(['c-pod-1', 'c-pod-2', 'c-prestada', 'c-cm']);
  });

  it('una cuenta de empresa: la propia primero y luego las asignadas', async () => {
    const mapa = await servicio().empresasDe('org', [{ id: 'ana', role: 'client', clientId: 'c-propia' }]);
    expect(mapa.get('ana')).toEqual(['c-propia', 'c-otra']);
  });

  it('los cargos sin límite alcanzan todas', async () => {
    const mapa = await servicio().empresasDe('org', [{ id: 'rodrigo', role: 'admin' }]);
    expect(mapa.get('rodrigo')).toBe('todas');
  });
});
