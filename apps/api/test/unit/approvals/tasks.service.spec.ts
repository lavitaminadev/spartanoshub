import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksService } from '../../../src/modules/approvals/tasks.service';
import { ApprovalRequestStatus, PendingKind } from '../../../src/modules/approvals/approval-request-status.enum';

/**
 * Las tareas comparten tabla con las aprobaciones porque comparten forma: dueño, vencimiento,
 * estado y registro al que pertenecen. Lo que las distingue es cómo se cierran —una la decide
 * el cliente, la otra la completa quien la tiene asignada— y eso es lo que estas pruebas fijan.
 */
describe('TasksService', () => {
  const repo = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ id: 'task-1', ...value })),
    find: vi.fn(),
    findOne: vi.fn(),
  };
  const users = { findOne: vi.fn() };
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    users.findOne.mockResolvedValue({ id: 'user-1' });
    service = new TasksService(repo as never, users as never);
  });

  const nuevaTarea = (extra: Record<string, unknown> = {}) => ({
    title: 'Llamar al prospecto',
    entityType: 'lead',
    entityId: 'lead-1',
    ...extra,
  }) as never;

  describe('crear', () => {
    it('nace como tarea pendiente, no como aprobación', async () => {
      const task = await service.create('org-1', 'user-9', nuevaTarea());
      expect(task).toMatchObject({
        kind: PendingKind.TASK,
        status: ApprovalRequestStatus.PENDING,
        requestedBy: 'user-9',
        entityType: 'lead',
      });
    });

    /**
     * Una tarea sobre un tipo que ninguna pantalla sabe mostrar queda invisible para siempre:
     * nadie la ve, nadie la cierra y sigue contando como pendiente.
     */
    it('rechaza un registro que no admite tareas', async () => {
      await expect(service.create('org-1', 'user-9', nuevaTarea({ entityType: 'factura' })))
        .rejects.toThrow(/no se pueden crear tareas/i);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('no la asigna a alguien dado de baja', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.create('org-1', 'user-9', nuevaTarea({ assignedTo: 'user-baja' })))
        .rejects.toThrow(/no está activa/i);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('acepta una tarea sin cliente, como las del embudo comercial', async () => {
      const task = await service.create('org-1', 'user-9', nuevaTarea());
      expect(task.clientId).toBeUndefined();
    });
  });

  describe('actualizar', () => {
    beforeEach(() => {
      repo.findOne.mockResolvedValue({
        id: 'task-1', organizationId: 'org-1', kind: PendingKind.TASK,
        status: ApprovalRequestStatus.PENDING, title: 'Llamar',
      });
    });

    it('se completa y registra cuándo', async () => {
      const task = await service.update('org-1', 'task-1', { status: ApprovalRequestStatus.DONE } as never);
      expect(task.status).toBe(ApprovalRequestStatus.DONE);
      expect(task.decisionAt).toBeInstanceOf(Date);
    });

    /**
     * Reabrir limpia la fecha de cierre: si vuelve a estar pendiente, la fecha anterior
     * describe algo que ya no es cierto y confundiría cualquier informe de cumplimiento.
     */
    it('reabrirla borra la fecha de cierre', async () => {
      repo.findOne.mockResolvedValue({
        id: 'task-1', organizationId: 'org-1', kind: PendingKind.TASK,
        status: ApprovalRequestStatus.DONE, decisionAt: new Date('2026-08-01'),
      });
      const task = await service.update('org-1', 'task-1', { status: ApprovalRequestStatus.PENDING } as never);
      expect(task.decisionAt).toBeUndefined();
    });

    /**
     * Aprobar y rechazar son la decisión de una aprobación. Aceptarlos acá dejaría tareas en
     * un estado que ninguna pantalla de tareas sabe mostrar ni cerrar.
     */
    it('no acepta los estados de una aprobación', async () => {
      for (const status of [ApprovalRequestStatus.APPROVED, ApprovalRequestStatus.REJECTED]) {
        await expect(service.update('org-1', 'task-1', { status } as never))
          .rejects.toThrow(/se completa o se cancela/i);
      }
    });

    it('desasigna con cadena vacía', async () => {
      const task = await service.update('org-1', 'task-1', { assignedTo: '' } as never);
      expect(task.assignedTo).toBeUndefined();
      // Sin persona que verificar, no hay que consultar usuarios.
      expect(users.findOne).not.toHaveBeenCalled();
    });

    it('no encuentra una aprobación por la vía de las tareas', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('org-1', 'aprobacion-1', { status: ApprovalRequestStatus.DONE } as never))
        .rejects.toThrow(/no encontrada/i);
    });
  });

  describe('listar', () => {
    it('pone lo abierto primero aunque venza después', async () => {
      repo.find.mockResolvedValue([
        { id: 'a', status: ApprovalRequestStatus.DONE },
        { id: 'b', status: ApprovalRequestStatus.PENDING },
        { id: 'c', status: ApprovalRequestStatus.CANCELLED },
        { id: 'd', status: ApprovalRequestStatus.VIEWED },
      ]);
      const tasks = await service.listForEntity('org-1', 'lead', 'lead-1');
      expect(tasks.map((task) => task.id)).toEqual(['b', 'd', 'a', 'c']);
    });

    it('lo mío solo trae lo que sigue abierto', async () => {
      repo.find.mockResolvedValue([]);
      await service.listMine('org-1', 'user-1');
      const where = repo.find.mock.calls[0][0].where;
      expect(where.kind).toBe(PendingKind.TASK);
      expect(where.assignedTo).toBe('user-1');
    });
  });
});
