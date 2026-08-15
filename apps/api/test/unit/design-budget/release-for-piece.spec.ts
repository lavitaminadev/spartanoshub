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
