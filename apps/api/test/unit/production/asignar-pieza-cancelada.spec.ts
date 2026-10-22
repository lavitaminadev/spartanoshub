import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AssignPieceUseCase } from '../../../src/modules/production/assign-piece.use-case';
import { PieceStatus } from '../../../src/modules/production/piece-status.enum';

describe('AssignPieceUseCase', () => {
  it.each([PieceStatus.CANCELLED, PieceStatus.DELIVERED])('no reasigna una pieza %s ni reserva UD', async (status) => {
    const reserve = vi.fn();
    const manager = { findOne: async () => ({ id: 'p-1', status }), save: vi.fn() };
    const repo = { manager: { transaction: (fn: any) => fn(manager) } };
    const useCase = new AssignPieceUseCase(repo as any, {} as any, { reserveForPiece: reserve } as any, {} as any, { emit: vi.fn() } as any);
    await expect(useCase.execute('p-1', 'd-1', 'o-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(reserve).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
