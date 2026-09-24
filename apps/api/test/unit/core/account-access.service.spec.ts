import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountAccessService } from '../../../src/core/client-scope/account-access.service';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

const ORG = 'org-1';

function userWith(role: UserRole, overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'persona@espartanos.cl',
    name: 'Persona',
    role,
    organizationId: ORG,
    tenantId: ORG,
    ...overrides,
  } as any;
}

describe('AccountAccessService', () => {
  let clients: { find: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
  let podMembers: { find: ReturnType<typeof vi.fn> };
  let assignments: { find: ReturnType<typeof vi.fn> };
  let service: AccountAccessService;

  beforeEach(() => {
    clients = { find: vi.fn().mockResolvedValue([]), findOne: vi.fn() };
    podMembers = { find: vi.fn().mockResolvedValue([]) };
    assignments = { find: vi.fn().mockResolvedValue([]) };
    service = new AccountAccessService(clients as any, podMembers as any, assignments as any);
  });

  it('la administración no tiene límite de cuentas', async () => {
    await expect(service.allowedClientIds(ORG, userWith(UserRole.ADMIN))).resolves.toBeUndefined();
  });

  it('un cliente solo ve su propia cuenta', async () => {
    clients.find.mockResolvedValue([{ id: 'cli-9', status: 'active' }]);
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }));
    expect(scope).toEqual(['cli-9']);
  });

  /*
   * Pausar tiene que notarse en el portal.
   *
   * Cortaba las reservas públicas y nada más: la empresa seguía entrando y operando como si el
   * servicio estuviera corriendo, que es lo contrario de pausarlo.
   */
  it.each(['paused', 'churned', 'cancelled'])('una empresa en %s desaparece del portal', async (estado) => {
    clients.find.mockResolvedValue([{ id: 'cli-9', status: estado }]);
    await expect(service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }))).resolves.toEqual([]);
  });

  it('pausar una empresa no afecta a las demás que atiende', async () => {
    assignments.find.mockResolvedValue([{ clientId: 'cli-otra' }]);
    clients.find.mockResolvedValue([{ id: 'cli-9', status: 'paused' }, { id: 'cli-otra', status: 'active' }]);
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }));
    expect(scope).toEqual(['cli-otra']);
  });

  it('un cliente sin cuenta asociada no ve ninguna', async () => {
    await expect(service.allowedClientIds(ORG, userWith(UserRole.CLIENT))).resolves.toEqual([]);
  });

  /*
   * Estas tres fijan el límite de una cuenta de portal, que es lo que separa a una empresa de
   * otra en todo el sistema: veintinueve sitios preguntan por este alcance para decidir qué
   * datos devuelven. Ampliarlo para que alguien atienda dos locales no puede convertirse en
   * «ve todo», ni siquiera por un fallo en otra parte.
   */
  it('un cliente alcanza su empresa y las que se le asignaron', async () => {
    assignments.find.mockResolvedValue([{ clientId: 'cli-9' }, { clientId: 'cli-otra' }]);
    clients.find.mockResolvedValue([{ id: 'cli-9', status: 'active' }, { id: 'cli-otra', status: 'active' }]);
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }));
    // La suya primero y sin repetirse, aunque figure además como asignación.
    expect(scope).toEqual(['cli-9', 'cli-otra']);
  });

  it('un cliente nunca queda sin límite, tenga las asignaciones que tenga', async () => {
    assignments.find.mockResolvedValue([{ clientId: 'a' }, { clientId: 'b' }, { clientId: 'c' }]);
    clients.find.mockResolvedValue([{ id: 'cli-9', status: 'active' }, { id: 'a', status: 'active' }, { id: 'b', status: 'active' }, { id: 'c', status: 'active' }]);
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }));
    expect(scope).not.toBeUndefined();
    expect(scope).toEqual(['cli-9', 'a', 'b', 'c']);
  });

  it('un cliente no hereda las cuentas de un pod', async () => {
    // Los pods son del equipo interno. Una fila suelta no puede ampliar el alcance de un portal.
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockResolvedValue([{ id: 'cli-9', status: 'active' }]);
    const scope = await service.allowedClientIds(ORG, userWith(UserRole.CLIENT, { clientId: 'cli-9' }));
    expect(scope).toEqual(['cli-9']);
  });

  it.each([
    UserRole.COMMERCIAL_DIRECTOR,
    UserRole.OPERATIONS_DIRECTOR,
    UserRole.CREATIVE_DIRECTOR,
    UserRole.ART_DIRECTOR,
    UserRole.AV_DIRECTOR,
  ])('la direccion %s alcanza todas las cuentas sin asignacion', async (role) => {
    // Lo pide el Documento Maestro —"un director ve todo"— y lo exigen sus tableros: la
    // direccion de operaciones abre "estado de todas las cuentas" y la comercial necesita
    // ocupacion del equipo y rentabilidad por cliente. Acotarlas por pod dejaba esas
    // pantallas vacias mientras el menu las seguia ofreciendo.
    await expect(service.allowedClientIds(ORG, userWith(role))).resolves.toBeUndefined();
  });

  it('el resto del equipo si queda acotado a lo que le asignan', async () => {
    // El liderazgo de IA no es una direccion en el organigrama, asi que entra por pod como
    // el resto. Si su trabajo transversal exige mas, se resuelve con una asignacion directa.
    await expect(service.allowedClientIds(ORG, userWith(UserRole.COMMUNITY_MANAGER))).resolves.toEqual([]);
    await expect(service.allowedClientIds(ORG, userWith(UserRole.DESIGNER))).resolves.toEqual([]);
    await expect(service.allowedClientIds(ORG, userWith(UserRole.AI_LEAD))).resolves.toEqual([]);
  });

  it('hereda del pod las cuentas asignadas al pod', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) =>
      where.podId ? [{ id: 'cli-1' }, { id: 'cli-2' }] : []);

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.DESIGNER));

    expect(scope).toEqual(['cli-1', 'cli-2']);
  });

  it('suma las asignaciones directas a lo que da el pod', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) => (where.podId ? [{ id: 'cli-1' }] : []));
    assignments.find.mockResolvedValue([{ clientId: 'cli-7' }]);

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.AUDIOVISUAL));

    expect(scope).toEqual(['cli-1', 'cli-7']);
  });

  it('conserva el acceso del community manager por la cuenta que tiene a cargo', async () => {
    clients.find.mockImplementation(async ({ where }: any) =>
      (where.communityManagerId ? [{ id: 'cli-3' }] : []));

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.COMMUNITY_MANAGER));

    expect(scope).toEqual(['cli-3']);
  });

  it('no repite una cuenta que llega por dos vías', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) =>
      (where.podId ? [{ id: 'cli-1' }] : where.communityManagerId ? [{ id: 'cli-1' }] : []));

    const scope = await service.allowedClientIds(ORG, userWith(UserRole.COMMUNITY_MANAGER));

    expect(scope).toEqual(['cli-1']);
  });

  it('explica la procedencia de cada cuenta visible', async () => {
    podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
    clients.find.mockImplementation(async ({ where }: any) => (where.podId ? [{ id: 'cli-1' }] : []));
    assignments.find.mockResolvedValue([{ clientId: 'cli-7' }]);

    const reasons = await service.explain(ORG, userWith(UserRole.DESIGNER));

    expect(reasons).toEqual([
      { clientId: 'cli-1', source: 'pod' },
      { clientId: 'cli-7', source: 'assignment' },
    ]);
  });

  describe('assertClient', () => {
    it('deja pasar una cuenta dentro del alcance', async () => {
      clients.findOne.mockResolvedValue({ id: 'cli-1' });
      podMembers.find.mockResolvedValue([{ podId: 'pod-1' }]);
      clients.find.mockImplementation(async ({ where }: any) => (where.podId ? [{ id: 'cli-1' }] : []));

      await expect(service.assertClient(ORG, userWith(UserRole.DESIGNER), 'cli-1')).resolves.toBeUndefined();
    });

    it('responde "no encontrada" ante una cuenta fuera del alcance', async () => {
      // 404 y no 403: confirmar que la cuenta existe pero esta vedada ya revela la cartera
      // de clientes de la agencia.
      clients.findOne.mockResolvedValue({ id: 'cli-9' });

      await expect(service.assertClient(ORG, userWith(UserRole.DESIGNER), 'cli-9'))
        .rejects.toThrow(NotFoundException);
    });

    it('no comprueba nada cuando no se indica cuenta', async () => {
      await expect(service.assertClient(ORG, userWith(UserRole.DESIGNER))).resolves.toBeUndefined();
      expect(clients.findOne).not.toHaveBeenCalled();
    });
  });

  it('descarta lo memorizado de una persona tras cambiar su alcance', async () => {
    podMembers.find.mockResolvedValue([]);
    const user = userWith(UserRole.DESIGNER);

    await service.allowedClientIds(ORG, user);
    await service.allowedClientIds(ORG, user);
    expect(podMembers.find).toHaveBeenCalledTimes(1);

    service.invalidateUser(user.id);
    await service.allowedClientIds(ORG, user);
    expect(podMembers.find).toHaveBeenCalledTimes(2);
  });
});
