import { describe, expect, it, vi } from 'vitest';
import { DesignBudgetService } from '../../../src/modules/design-budget/design-budget.service';
import { UDMovementType } from '../../../src/modules/design-budget/ud-movement-type.enum';
import { BadRequestException } from '@nestjs/common';

const piece = { id: 'piece-1', clientId: 'client-1', organizationId: 'org-1', udAmount: 3, title: 'Post' } as any;

/**
 * Presupuesto con una reserva de 3 unidades ya aplicada, que es el estado desde el que se
 * cancela: la pieza se asignó, descontó del saldo, y ahora no se va a hacer.
 */
function contexto(options: { budgetStatus?: string; consumido?: boolean; yaDevuelto?: boolean } = {}) {
  const budget = { id: 'budget-1', year: 2026, month: 8, contracted: 10, reserved: 3, consumed: options.consumido ? 3 : 0, status: options.budgetStatus ?? 'open' };
  if (options.consumido) budget.reserved = 0;

  const saved: any[] = [];
  const manager = {
    getRepository: () => ({
      findOne: async ({ where }: any) => {
        if (where.type === UDMovementType.RELEASE) return options.yaDevuelto ? { id: 'release-previo' } : null;
        if (where.type === UDMovementType.RESERVATION) return { id: 'mov-1', udBudgetId: budget.id, amount: 3 };
        if (where.type === UDMovementType.CONSUMPTION) return options.consumido ? { id: 'mov-2' } : null;
        return null;
      },
    }),
    findOne: async () => budget,
    create: (_entity: unknown, data: any) => data,
    save: async (_entity: unknown, data: any) => { saved.push(data); return data; },
  };
  return { budget, manager, saved };
}

function service(config: Record<string, unknown>) {
  const parameters = { get: vi.fn(async (key: string) => config[key] ?? null) } as any;
  return new DesignBudgetService({} as any, {} as any, {} as any, parameters, {} as any);
}

describe('DesignBudgetService.releaseForPiece', () => {
  it('devuelve al saldo reservado lo que la pieza había descontado', async () => {
    const { budget, manager, saved } = contexto();
    const movimiento = await service({ 'ud.reversal_mode': 'automatic' })
      .releaseForPiece(piece, 'Cancelación: el cliente bajó la campaña', 'actor-1', manager as any);

    expect(budget.reserved).toBe(0);
    expect(movimiento?.type).toBe(UDMovementType.RELEASE);
    expect(movimiento?.amount).toBe(3);
    expect(saved.some((row) => row.reason?.includes('el cliente bajó la campaña'))).toBe(true);
  });

  it('descuenta de lo consumido cuando la pieza ya se había entregado', async () => {
    const { budget, manager } = contexto({ consumido: true });
    await service({ 'ud.reversal_mode': 'automatic' }).releaseForPiece(piece, 'Anulada', 'actor-1', manager as any);
    expect(budget.consumed).toBe(0);
    expect(budget.reserved).toBe(0);
  });

  it('no devuelve dos veces si se cancela de nuevo', async () => {
    const { budget, manager } = contexto({ yaDevuelto: true });
    const movimiento = await service({ 'ud.reversal_mode': 'automatic' }).releaseForPiece(piece, 'Otra vez', 'actor-1', manager as any);
    expect(movimiento?.id).toBe('release-previo');
    expect(budget.reserved).toBe(3);
  });

  it('no devuelve nada cuando la configuración es «no se devuelve»', async () => {
    const { budget, manager } = contexto();
    const movimiento = await service({ 'ud.reversal_mode': 'none' }).releaseForPiece(piece, 'Cancelada', 'actor-1', manager as any);
    expect(movimiento).toBeNull();
    expect(budget.reserved).toBe(3);
  });

  it('exige ajuste autorizado cuando la configuración es manual', async () => {
    const { budget, manager } = contexto();
    await expect(service({ 'ud.reversal_mode': 'manual' }).releaseForPiece(piece, 'Cancelada', 'actor-1', manager as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(budget.reserved).toBe(3);
  });

  it('no toca un mes cerrado salvo que la configuración lo permita', async () => {
    const cerrado = contexto({ budgetStatus: 'closed' });
    await expect(service({ 'ud.reversal_mode': 'automatic' })
      .releaseForPiece(piece, 'Cancelada', 'actor-1', cerrado.manager as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(cerrado.budget.reserved).toBe(3);

    const permitido = contexto({ budgetStatus: 'closed' });
    await service({ 'ud.reversal_mode': 'automatic', 'ud.reversal_allows_closed_budget': true })
      .releaseForPiece(piece, 'Cancelada', 'actor-1', permitido.manager as any);
    expect(permitido.budget.reserved).toBe(0);
  });

  it('devuelve lo que se cobró, no el valor actual del tipo de pieza', async () => {
    // La reserva registró 3 unidades. Si después alguien configuró ese tipo en 8, devolver 8
    // dejaría al cliente con más saldo del que tenía antes de pedir el trabajo.
    const { budget, manager } = contexto();
    const revalorizada = { ...piece, udAmount: 8 };
    const movimiento = await service({ 'ud.reversal_mode': 'automatic' })
      .releaseForPiece(revalorizada as any, 'Cancelada', 'actor-1', manager as any);

    expect(movimiento?.amount).toBe(3);
    expect(budget.reserved).toBe(0);
  });
});

describe('CancelPieceUseCase', () => {
  it('exige declarar de quién fue la decisión y la deja en la pieza', async () => {
    const { CancelPieceUseCase } = await import('../../../src/modules/production/cancel-piece.use-case');
    const { CancelOrigin } = await import('../../../src/modules/production/cancel-origin.enum');
    const { PieceStatus } = await import('../../../src/modules/production/piece-status.enum');

    const guardada = { id: 'piece-1', clientId: 'c1', organizationId: 'org-1', status: PieceStatus.ASSIGNED } as any;
    const manager = { findOne: async () => guardada, save: async (_e: unknown, row: any) => row };
    const pieces = { findOne: async () => guardada, manager: { transaction: (cb: any) => cb(manager) } } as any;
    const budget = { releaseForPiece: vi.fn(async () => null) } as any;
    // El alcance de empresa se comprueba en el caso de uso; acá se concede para poder probar el
    // resto. Que lo pida está cubierto en la prueba de abajo.
    const acceso = { assertClient: vi.fn(async () => undefined) } as any;

    const useCase = new CancelPieceUseCase(pieces, budget, acceso);
    const resultado = await useCase.execute('piece-1', 'org-1', 'El cliente bajó la campaña', CancelOrigin.CLIENT, { id: 'cm-1' } as any);

    // Se comprueba contra la empresa de la pieza, no contra la que venga en la petición.
    expect(acceso.assertClient).toHaveBeenCalledWith('org-1', { id: 'cm-1' }, 'c1');

    expect(resultado.status).toBe(PieceStatus.CANCELLED);
    expect(resultado.cancelOrigin).toBe(CancelOrigin.CLIENT);
    expect(resultado.cancelReason).toBe('El cliente bajó la campaña');
    expect(resultado.cancelledBy).toBe('cm-1');
    expect(resultado.cancelledAt).toBeInstanceOf(Date);
    // El motivo viaja al movimiento con la responsabilidad ya nombrada, para que la bitácora
    // del presupuesto se lea sin tener que cruzarla con la pieza.
    expect(budget.releaseForPiece.mock.calls[0][1]).toContain('Lo pidió el cliente');
  });

  it('no cancela sin motivo', async () => {
    const { CancelPieceUseCase } = await import('../../../src/modules/production/cancel-piece.use-case');
    const { CancelOrigin } = await import('../../../src/modules/production/cancel-origin.enum');
    const useCase = new CancelPieceUseCase({ manager: {} } as any, {} as any, {} as any);
    await expect(useCase.execute('p', 'org-1', '   ', CancelOrigin.CLIENT, { id: 'u' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Una pieza de una empresa fuera de alcance no se cancela, y responde 404.
   *
   * Es el caso que el controlador no cubría: `approve` comprobaba la empresa y `cancel` no, de
   * modo que con el id de una pieza ajena se movía el presupuesto de una cuenta que esa persona
   * no atiende. Puesta la comprobación acá, la ruta ya no puede omitirla.
   */
  it('no cancela una pieza de una empresa que la persona no alcanza', async () => {
    const { CancelPieceUseCase } = await import('../../../src/modules/production/cancel-piece.use-case');
    const { CancelOrigin } = await import('../../../src/modules/production/cancel-origin.enum');
    const { NotFoundException } = await import('@nestjs/common');

    const pieces = { findOne: async () => ({ id: 'piece-1', clientId: 'ajena' }), manager: { transaction: () => { throw new Error('no debió abrirse la transacción'); } } } as any;
    const budget = { releaseForPiece: vi.fn() } as any;
    const acceso = { assertClient: async () => { throw new NotFoundException('Client not found'); } } as any;

    const useCase = new CancelPieceUseCase(pieces, budget, acceso);
    await expect(useCase.execute('piece-1', 'org-1', 'motivo suficiente', CancelOrigin.PRODUCTION, { id: 'cm-1' } as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(budget.releaseForPiece).not.toHaveBeenCalled();
  });
});
