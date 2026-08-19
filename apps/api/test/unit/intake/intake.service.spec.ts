import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { IntakeService } from '../../../src/modules/intake/intake.service';
import { WorkRequestArea, WorkRequestStatus } from '../../../src/modules/intake/work-request.entity';
import { Session } from '../../../src/modules/audiovisual/session.entity';
import { PieceStatus } from '../../../src/modules/production/piece-status.enum';
import { PieceType } from '../../../src/modules/production/piece-type.enum';

const requests = {
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  save: vi.fn(),
  createQueryBuilder: vi.fn(),
};
const clients = { findOne: vi.fn() };
const users = { findOne: vi.fn(), find: vi.fn(), count: vi.fn() };

/**
 * Moodboards del cliente. Por defecto devuelve uno aprobado, que es la precondición para
 * agendar: sin ella toda conversión audiovisual sería rechazada y las pruebas de ese camino
 * medirían la barrera en vez de lo que quieren medir.
 */
const moodboards = {
  findOne: vi.fn(async () => ({ id: 'mb-1', clientId: 'client-1', title: 'Moodboard aprobado', status: 'approved' })),
};

/**
 * Simula la transacción devolviendo un `manager` que registra lo guardado.
 *
 * `getRepository` devuelve el mismo doble para cualquier entidad porque lo único que se ejerce
 * dentro de la transacción es el bloqueo de la organización y la búsqueda del último correlativo.
 */
function transactionalDataSource(saved: unknown[]) {
  const lockedQueryBuilder = {
    setLock: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue({ id: 'org-1' }),
  };
  const manager = {
    getRepository: vi.fn().mockReturnValue({ ...requests, createQueryBuilder: () => lockedQueryBuilder }),
    create: vi.fn((_entity: unknown, data: unknown) => data),
    save: vi.fn(async (entity: unknown, data: unknown) => {
      saved.push(data);
      if (Array.isArray(data)) return data.map((row, index) => ({ ...(row as object), id: `piece-${index + 1}` }));
      // Solo se le asigna identificador a lo que nace en esta transacción; la solicitud, que
      // ya lo tiene, se devuelve tal cual para poder comprobar sus campos.
      return entity === Session ? { ...(data as object), id: 'session-1' } : data;
    }),
  };
  return {
    dataSource: { transaction: (work: (m: unknown) => Promise<unknown>) => work(manager) },
    manager,
    lockedQueryBuilder,
  };
}

function build(saved: unknown[] = []) {
  const { dataSource, manager, lockedQueryBuilder } = transactionalDataSource(saved);
  const udValues = { udFor: async () => 1 };
  const pieceTypes = { assertUsable: async () => undefined };
  const service = new IntakeService(requests as any, clients as any, users as any, moodboards as any, dataSource as any, udValues as any, pieceTypes as any, createProcessHistoryDouble());
  return { service, manager, lockedQueryBuilder };
}

const scoped = ['client-1'];

describe('IntakeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clients.findOne.mockResolvedValue({ id: 'client-1' });
    requests.find.mockResolvedValue([]);
  });

  describe('create', () => {
    it('asigna el primer correlativo cuando no hay solicitudes', async () => {
      const { service } = build();

      const created = await service.create('org-1', 'user-1', {
        clientId: 'client-1',
        area: WorkRequestArea.DESIGN,
        title: 'Carrusel de lanzamiento',
      } as any, scoped);

      expect(created.code).toBe('SOL-00001');
      expect(created.status).toBe(WorkRequestStatus.NEW);
      expect(created.requestedBy).toBe('user-1');
    });

    it('continúa el correlativo desde el último código, no desde la cantidad de filas', async () => {
      requests.find.mockResolvedValue([{ id: 'r-9', code: 'SOL-00042' }]);
      const { service } = build();

      const created = await service.create('org-1', 'user-1', {
        clientId: 'client-1', area: WorkRequestArea.DESIGN, title: 'Otra pieza',
      } as any, scoped);

      expect(created.code).toBe('SOL-00043');
    });

    it('bloquea la fila de la organización antes de leer el último correlativo', async () => {
      const { service, lockedQueryBuilder } = build();

      await service.create('org-1', 'user-1', {
        clientId: 'client-1', area: WorkRequestArea.DESIGN, title: 'Pieza',
      } as any, scoped);

      expect(lockedQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(lockedQueryBuilder.getOne).toHaveBeenCalled();
    });

    it('rechaza una cuenta de otra organización', async () => {
      clients.findOne.mockResolvedValue(null);
      const { service } = build();

      await expect(service.create('org-1', 'user-1', {
        clientId: 'ajena', area: WorkRequestArea.DESIGN, title: 'Pieza',
      } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una cuenta fuera del alcance de quien pide', async () => {
      const { service } = build();

      await expect(service.create('org-1', 'user-1', {
        clientId: 'client-1', area: WorkRequestArea.DESIGN, title: 'Pieza',
      } as any, ['otro-cliente'])).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('no consulta la base cuando el alcance está vacío', async () => {
      const { service } = build();

      const result = await service.list('org-1', {}, []);

      expect(result).toEqual({ data: [], total: 0 });
      expect(requests.findAndCount).not.toHaveBeenCalled();
    });

    it('devuelve vacío cuando se filtra por una cuenta fuera del alcance', async () => {
      const { service } = build();

      const result = await service.list('org-1', { clientId: 'ajena' }, scoped);

      expect(result).toEqual({ data: [], total: 0 });
      expect(requests.findAndCount).not.toHaveBeenCalled();
    });

    it('limita la consulta a las cuentas alcanzadas', async () => {
      requests.findAndCount.mockResolvedValue([[], 0]);
      const { service } = build();

      await service.list('org-1', {}, scoped);

      const [options] = requests.findAndCount.mock.calls[0];
      expect(options.where.organizationId).toBe('org-1');
      expect(options.where.clientId).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('responde no encontrada, y no prohibida, para una solicitud fuera del alcance', async () => {
      requests.findOne.mockResolvedValue({ id: 'r-1', clientId: 'otra-cuenta' });
      const { service } = build();

      await expect(service.findOne('org-1', 'r-1', scoped)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no permite saltar el filtro de área con un identificador directo', async () => {
      requests.findOne.mockResolvedValue({
        id: 'r-1', clientId: 'client-1', area: WorkRequestArea.AUDIOVISUAL,
        requestedBy: 'otra-persona', assignedTo: 'otra-persona',
      });
      const { service } = build();

      await expect(service.findOne('org-1', 'r-1', undefined, { id: 'designer-1', role: 'designer' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('mantiene desarrollo transversal en el detalle de solicitudes', async () => {
      const request = { id: 'r-1', clientId: 'client-1', area: WorkRequestArea.AUDIOVISUAL, requestedBy: 'otra-persona' };
      requests.findOne.mockResolvedValue(request);
      const { service } = build();

      await expect(service.findOne('org-1', 'r-1', undefined, { id: 'dev-1', role: 'dev' })).resolves.toBe(request);
    });
  });

  describe('update', () => {
    function existing(overrides: Record<string, unknown> = {}) {
      return { id: 'r-1', clientId: 'client-1', area: WorkRequestArea.DESIGN, status: WorkRequestStatus.NEW, ...overrides };
    }

    beforeEach(() => {
      requests.save.mockImplementation(async (row: unknown) => row);
    });

    it('acepta una transición declarada', async () => {
      requests.findOne.mockResolvedValue(existing());
      const { service } = build();

      const updated = await service.update('org-1', 'r-1', { status: WorkRequestStatus.IN_REVIEW }, scoped);

      expect(updated.status).toBe(WorkRequestStatus.IN_REVIEW);
      expect(updated.reviewedAt).toBeInstanceOf(Date);
    });

    it('impide que una dirección coordine un área ajena', async () => {
      requests.findOne.mockResolvedValue(existing({ area: WorkRequestArea.DESIGN }));
      const { service } = build();

      await expect(service.update(
        'org-1', 'r-1', { status: WorkRequestStatus.IN_REVIEW }, scoped,
        { id: 'av-director-1', role: 'av_director' },
      )).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza saltarse la revisión', async () => {
      requests.findOne.mockResolvedValue(existing());
      const { service } = build();

      await expect(service.update('org-1', 'r-1', { status: WorkRequestStatus.ACCEPTED }, scoped))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('no reabre una solicitud convertida', async () => {
      requests.findOne.mockResolvedValue(existing({ status: WorkRequestStatus.CONVERTED }));
      const { service } = build();

      await expect(service.update('org-1', 'r-1', { status: WorkRequestStatus.IN_REVIEW }, scoped))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('exige motivo al rechazar', async () => {
      requests.findOne.mockResolvedValue(existing());
      const { service } = build();

      await expect(service.update('org-1', 'r-1', { status: WorkRequestStatus.REJECTED }, scoped))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('registra el momento de resolución al rechazar con motivo', async () => {
      requests.findOne.mockResolvedValue(existing());
      const { service } = build();

      const updated = await service.update('org-1', 'r-1', {
        status: WorkRequestStatus.REJECTED, rejectionReason: 'La cuenta no tiene presupuesto este mes',
      }, scoped);

      expect(updated.resolvedAt).toBeInstanceOf(Date);
      expect(updated.rejectionReason).toBe('La cuenta no tiene presupuesto este mes');
    });

    it('rechaza asignar a alguien que no es usuario activo de la organización', async () => {
      requests.findOne.mockResolvedValue(existing());
      users.findOne.mockResolvedValue(null);
      const { service } = build();

      await expect(service.update('org-1', 'r-1', { assignedTo: 'user-9' }, scoped))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('no asigna un diseñador a una solicitud audiovisual', async () => {
      // El error que motivó separar las áreas: diseño y audiovisual son flujos distintos con
      // gente distinta, y una lista única los hacía intercambiables de un clic.
      requests.findOne.mockResolvedValue(existing({ area: WorkRequestArea.AUDIOVISUAL }));
      users.findOne.mockResolvedValue({ id: 'user-9', role: 'designer' });
      const { service } = build();

      await expect(service.update('org-1', 'r-1', { assignedTo: 'user-9' }, scoped))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('asigna a alguien del área que corresponde', async () => {
      requests.findOne.mockResolvedValue(existing({ area: WorkRequestArea.AUDIOVISUAL }));
      users.findOne.mockResolvedValue({ id: 'user-9', role: 'audiovisual' });
      const { service } = build();

      const updated = await service.update('org-1', 'r-1', { assignedTo: 'user-9' }, scoped);

      expect(updated.assignedTo).toBe('user-9');
    });

    it('desasigna con cadena vacía sin consultar usuarios', async () => {
      requests.findOne.mockResolvedValue(existing({ assignedTo: 'user-9' }));
      const { service } = build();

      const updated = await service.update('org-1', 'r-1', { assignedTo: '' }, scoped);

      expect(updated.assignedTo).toBeNull();
      expect(users.findOne).not.toHaveBeenCalled();
    });
  });

  describe('convert', () => {
    function accepted(area: WorkRequestArea, overrides: Record<string, unknown> = {}) {
      return { id: 'r-1', clientId: 'client-1', status: WorkRequestStatus.ACCEPTED, area, ...overrides };
    }

    it('solo convierte una solicitud aceptada', async () => {
      requests.findOne.mockResolvedValue({ id: 'r-1', clientId: 'client-1', area: WorkRequestArea.DESIGN, status: WorkRequestStatus.NEW });
      const { service } = build();

      await expect(service.convert('org-1', 'r-1', {
        pieces: [{ title: 'Post', type: PieceType.POST_SIMPLE }],
      }, scoped)).rejects.toBeInstanceOf(ConflictException);
    });

    describe('diseño', () => {
      it('crea las piezas, arrastra plazo y responsable, y cierra la solicitud', async () => {
        const neededBy = new Date('2026-09-01T00:00:00Z');
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.DESIGN, {
          assignedTo: 'user-7', neededBy, description: 'Bajada de campaña',
        }));
        const saved: unknown[] = [];
        const { service } = build(saved);

        const result = await service.convert('org-1', 'r-1', {
          pieces: [
            { title: 'Carrusel', type: PieceType.CAROUSEL, carouselSlides: 5 },
            { title: 'Historia', type: PieceType.STORY_ORIGINAL },
          ],
        }, scoped);

        const pieces = saved[0] as Array<Record<string, unknown>>;
        expect(pieces).toHaveLength(2);
        expect(pieces[0]).toMatchObject({
          clientId: 'client-1',
          status: PieceStatus.BACKLOG,
          assignedTo: 'user-7',
          deadlineAt: neededBy,
          description: 'Bajada de campaña',
        });
        expect(pieces[0].udAmount).toBeGreaterThan(0);
        expect(result.status).toBe(WorkRequestStatus.CONVERTED);
        expect(result.pieceIds).toEqual(['piece-1', 'piece-2']);
        expect(result.sessionId).toBeUndefined();
        expect(result.resolvedAt).toBeInstanceOf(Date);
      });

      it('rechaza convertir sin piezas', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.DESIGN));
        const { service } = build();

        await expect(service.convert('org-1', 'r-1', { pieces: [] }, scoped))
          .rejects.toBeInstanceOf(BadRequestException);
      });

      it('no agenda una sesión desde una solicitud de diseño', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.DESIGN));
        const { service } = build();

        await expect(service.convert('org-1', 'r-1', {
          session: { type: 'reel', date: '2026-09-01' },
        }, scoped)).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe('audiovisual', () => {
      it('agenda una sesión y no crea piezas gráficas', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.AUDIOVISUAL, { assignedTo: 'user-7' }));
        users.count.mockResolvedValue(2);
        const saved: unknown[] = [];
        const { service } = build(saved);

        const result = await service.convert('org-1', 'r-1', {
          session: { type: 'sesion_foto', date: '2026-09-01', location: 'Terraza', assignedTeam: ['user-9'], moodboardId: 'mb-1' },
        }, scoped);

        const session = saved[0] as Record<string, unknown>;
        expect(session).toMatchObject({ clientId: 'client-1', type: 'sesion_foto', location: 'Terraza', status: 'scheduled', moodboardId: 'mb-1' });
        // El responsable de la solicitud entra al equipo aunque no lo repitan al agendar.
        expect(session.assignedTeam).toEqual(['user-9', 'user-7']);
        expect(result.status).toBe(WorkRequestStatus.CONVERTED);
        expect(result.sessionId).toBe('session-1');
        expect(result.pieceIds).toBeUndefined();
      });

      /**
       * La misma regla que protege el agendamiento directo desde Audiovisual.
       *
       * Se comprueba también en esta conversión porque escribe la sesión por su cuenta, dentro
       * de su propia transacción, y no pasa por `AudiovisualService`: sin esta barrera toda
       * sesión convertida desde una solicitud nacía sin moodboard.
       */
      it('no agenda sin moodboard', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.AUDIOVISUAL));
        const saved: unknown[] = [];
        const { service } = build(saved);

        await expect(service.convert('org-1', 'r-1', {
          session: { type: 'reel', date: '2026-09-01' },
        }, scoped)).rejects.toThrow(/moodboard aprobado/i);

        expect(saved).toEqual([]);
      });

      it('no agenda con un moodboard que todavía no está aprobado', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.AUDIOVISUAL));
        moodboards.findOne.mockResolvedValueOnce({ id: 'mb-2', clientId: 'client-1', title: 'Borrador', status: 'draft' });
        const saved: unknown[] = [];
        const { service } = build(saved);

        await expect(service.convert('org-1', 'r-1', {
          session: { type: 'reel', date: '2026-09-01', moodboardId: 'mb-2' },
        }, scoped)).rejects.toThrow(/todavía no está aprobado/i);

        expect(saved).toEqual([]);
      });

      it('rechaza crear piezas gráficas desde una solicitud audiovisual', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.AUDIOVISUAL));
        const { service } = build();

        await expect(service.convert('org-1', 'r-1', {
          pieces: [{ title: 'Post', type: PieceType.POST_SIMPLE }],
        }, scoped)).rejects.toBeInstanceOf(BadRequestException);
      });

      it('exige los datos de la sesión', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.AUDIOVISUAL));
        const { service } = build();

        await expect(service.convert('org-1', 'r-1', {}, scoped)).rejects.toBeInstanceOf(BadRequestException);
      });

      it('rechaza el equipo si alguien no es usuario activo', async () => {
        requests.findOne.mockResolvedValue(accepted(WorkRequestArea.AUDIOVISUAL));
        users.count.mockResolvedValue(0);
        const { service } = build();

        await expect(service.convert('org-1', 'r-1', {
          session: { type: 'reel', date: '2026-09-01', assignedTeam: ['fantasma'] },
        }, scoped)).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    it('community todavía no tiene destino y lo dice en vez de crear una pieza', async () => {
      requests.findOne.mockResolvedValue(accepted(WorkRequestArea.COMMUNITY));
      const saved: unknown[] = [];
      const { service } = build(saved);

      await expect(service.convert('org-1', 'r-1', {
        pieces: [{ title: 'Post', type: PieceType.POST_SIMPLE }],
      }, scoped)).rejects.toBeInstanceOf(ConflictException);
      expect(saved).toEqual([]);
    });
  });

  describe('assigneeOptions', () => {
    it('cada área ofrece solo a su propia gente', async () => {
      users.find.mockResolvedValue([]);
      const { service } = build();

      await service.assigneeOptions('org-1', WorkRequestArea.DESIGN);
      const design = users.find.mock.calls[0][0].where.role.value;
      await service.assigneeOptions('org-1', WorkRequestArea.AUDIOVISUAL);
      const av = users.find.mock.calls[1][0].where.role.value;

      expect(design).toEqual(['designer', 'art_director']);
      expect(av).toEqual(['audiovisual', 'av_director']);
      // La comprobación que importa: no comparten a nadie.
      expect(design.filter((role: string) => av.includes(role))).toEqual([]);
    });
  });

  describe('counts', () => {
    it('devuelve vacío sin consultar cuando el alcance está vacío', async () => {
      const { service } = build();

      expect(await service.counts('org-1', [])).toEqual({});
      expect(requests.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('convierte los totales a número', async () => {
      requests.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { status: 'new', total: '3' },
          { status: 'accepted', total: '1' },
        ]),
      });
      const { service } = build();

      expect(await service.counts('org-1', scoped)).toEqual({ new: 3, accepted: 1 });
    });
  });
});
