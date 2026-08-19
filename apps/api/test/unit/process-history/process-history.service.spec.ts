import { describe, expect, it, vi } from 'vitest';
import { ProcessHistoryService } from '../../../src/core/process-history/process-history.service';
import { ProcessSubject } from '../../../src/core/process-history/process-stage-change.entity';

/**
 * El registro de recorrido tiene dos obligaciones que se contradicen si se descuidan: dejar
 * constancia fiel de lo que pasó, y no detener nunca al que mueve el trabajo. Estas pruebas
 * fijan ambas.
 */
function crear(overrides: Partial<Record<string, unknown>> = {}) {
  const filas: Record<string, unknown>[] = [];
  const repo = {
    create: vi.fn((fila) => fila),
    save: vi.fn(async (fila) => { filas.push(fila); return fila; }),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    createQueryBuilder: vi.fn(),
    ...overrides,
  };
  return { service: new ProcessHistoryService(repo as never), repo, filas };
}

describe('registro de recorrido', () => {
  it('guarda la apertura sin etapa de origen ni duración', async () => {
    const { service, filas } = crear();
    await service.recordCreated('org-1', ProcessSubject.WORK_REQUEST, 'sol-1', 'new', 'user-1');

    expect(filas[0]).toMatchObject({
      subjectType: ProcessSubject.WORK_REQUEST,
      subjectId: 'sol-1',
      fromStage: null,
      toStage: 'new',
      durationHours: null,
      changedBy: 'user-1',
    });
  });

  /**
   * Una fila por cada edición del título llenaría el historial de transiciones que nunca
   * ocurrieron, y el promedio por etapa se hundiría con duraciones de cero.
   */
  it('no registra nada cuando la etapa no cambió', async () => {
    const { service, repo } = crear();
    await service.recordStageChange('org-1', ProcessSubject.PIECE, 'p-1', 'assigned', 'assigned');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('mide la duración contra la transición anterior, no contra la creación', async () => {
    const haceDosHoras = new Date(Date.now() - 2 * 3_600_000);
    const { service, filas } = crear({ findOne: vi.fn().mockResolvedValue({ createdAt: haceDosHoras }) });

    await service.recordStageChange('org-1', ProcessSubject.PIECE, 'p-1', 'assigned', 'internal_review');

    expect(Number(filas[0].durationHours)).toBeCloseTo(2, 1);
  });

  /** Inventar una duración que nadie midió ensucia el informe más que dejarla vacía. */
  it('deja la duración vacía cuando no hay transición previa', async () => {
    const { service, filas } = crear();
    await service.recordStageChange('org-1', ProcessSubject.PIECE, 'p-1', 'assigned', 'delivered');
    expect(filas[0].durationHours).toBeNull();
  });

  it('guarda el motivo cuando quien mueve da uno', async () => {
    const { service, filas } = crear();
    await service.recordStageChange(
      'org-1', ProcessSubject.APPROVAL, 'a-1', 'pending', 'rejected', 'user-1', 'Falta el logo',
    );
    expect(filas[0].reason).toBe('Falta el logo');
  });

  /** Nulo distingue un avance real de uno provocado por una automatización o un vencimiento. */
  it('deja sin autor lo que movió el sistema', async () => {
    const { service, filas } = crear();
    await service.recordStageChange('org-1', ProcessSubject.PIECE, 'p-1', 'assigned', 'delivered');
    expect(filas[0].changedBy).toBeNull();
  });

  /**
   * La garantía central: perder una fila de historial degrada un informe, mientras que impedir
   * que alguien apruebe una pieza detiene el trabajo.
   */
  it('no propaga su propio fallo a quien mueve el trabajo', async () => {
    const { service } = crear({ save: vi.fn().mockRejectedValue(new Error('base caída')) });

    await expect(
      service.recordStageChange('org-1', ProcessSubject.PIECE, 'p-1', 'assigned', 'delivered'),
    ).resolves.toBeUndefined();

    await expect(
      service.recordCreated('org-1', ProcessSubject.PIECE, 'p-1', 'backlog'),
    ).resolves.toBeUndefined();
  });

  it('devuelve el recorrido del más antiguo al más reciente', async () => {
    const { service, repo } = crear();
    await service.timeline(ProcessSubject.WORK_REQUEST, 'sol-1');
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'ASC' } }));
  });
});
