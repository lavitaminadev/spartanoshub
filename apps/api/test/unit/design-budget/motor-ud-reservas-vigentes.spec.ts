import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DesignBudgetService } from '../../../src/modules/design-budget/design-budget.service';
import { UDMovementType } from '../../../src/modules/design-budget/ud-movement-type.enum';
import { efectoEnElDisponible } from '../../../src/modules/design-budget/ud-movement-effect';

const pieza = { id: 'p-1', clientId: 'c-1', organizationId: 'o-1', udAmount: 3, title: 'Post' } as any;

function servicio(budgetRepo: any = {}) {
  return new DesignBudgetService(budgetRepo, {} as any, {} as any, { get: vi.fn() } as any, {} as any);
}

describe('confirmConsumption', () => {
  it('falla si la reserva de la pieza ya fue devuelta, aunque otras piezas tengan reservado', async () => {
    const budget = { id: 'b-1', reserved: 10, consumed: 0 };
    const manager = {
      findOne: async () => budget,
      getRepository: () => ({
        findOne: async ({ where }: any) => {
          if (where.type === UDMovementType.RELEASE) return { id: 'rel-1' };
          if (where.type === UDMovementType.RESERVATION) return { id: 'res-1', udBudgetId: 'b-1', amount: 3 };
          return null;
        },
      }),
      save: vi.fn(),
    };
    await expect(servicio().confirmConsumption(pieza, 'a', manager as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(budget.reserved).toBe(10);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('falla si la pieza nunca tuvo reserva', async () => {
    const manager = { findOne: async () => null, getRepository: () => ({ findOne: async () => null }), save: vi.fn() };
    await expect(servicio().confirmConsumption(pieza, 'a', manager as any)).rejects.toThrow(/reserva de UD vigente/);
  });
});

describe('ensureMonthlyBudget', () => {
  it('crea el mes con el contratado de la ficha del cliente, bajo el candado del cliente', async () => {
    const guardado: any[] = [];
    const repo = { findOne: async () => null, create: (d: any) => d, save: async (d: any) => { guardado.push(d); return d; } };
    const findOne = vi.fn(async () => ({ id: 'c-1', defaultUdBudget: 40 }));
    const manager = { findOne, getRepository: () => repo };
    await servicio().ensureMonthlyBudget('c-1', 2026, 10, manager as any);
    expect(guardado[0].contracted).toBe(40);
    expect(findOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
  });
});

describe('efectoEnElDisponible', () => {
  it('el signo sale del tipo y no de cómo se guardó el monto', () => {
    expect(efectoEnElDisponible('reservation', 3)).toBe(-3);
    expect(efectoEnElDisponible('consumption', 3)).toBe(-3);
    expect(efectoEnElDisponible('consumption', -3)).toBe(-3);
    expect(efectoEnElDisponible('release', 3)).toBe(3);
    expect(efectoEnElDisponible('release', -3)).toBe(3);
    expect(efectoEnElDisponible('extra', 5)).toBe(5);
  });

  it('el ajuste lleva su propio signo', () => {
    expect(efectoEnElDisponible('adjustment', 4)).toBe(4);
    expect(efectoEnElDisponible('adjustment', -4)).toBe(-4);
  });
});
