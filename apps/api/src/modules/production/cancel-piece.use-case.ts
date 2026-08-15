import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { CancelOrigin, CANCEL_ORIGIN_LABELS } from './cancel-origin.enum';

/**
 * Cancela una pieza y devuelve sus unidades según la regla configurada.
 *
 * Cancelar es distinto de rechazar: una pieza rechazada vuelve a corrección porque el trabajo
 * sigue en pie. Una cancelada no se va a hacer, y por eso lo que descontó del presupuesto del
 * cliente deja de corresponder a algo.
 *
 * La cancelación exige un motivo. Es lo que después permite distinguir una cancelación del
 * cliente de un error interno, que no deberían tratarse igual al revisar el mes.
 */
@Injectable()
export class CancelPieceUseCase {
  constructor(
    @InjectRepository(Piece) private readonly pieces: Repository<Piece>,
    private readonly designBudget: DesignBudgetService,
  ) {}

  async execute(pieceId: string, organizationId: string, reason: string, origin: CancelOrigin, actorId?: string): Promise<Piece> {
    const motivo = reason?.trim();
    if (!motivo) throw new BadRequestException('Indica por qué se cancela la pieza');

    return this.pieces.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, {
        where: { id: pieceId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!piece) throw new NotFoundException('Pieza no encontrada');
      if (piece.status === PieceStatus.CANCELLED) return piece;

      // La devolución va primero: si la configuración la rechaza —un mes cerrado, o un modo que
      // exige ajuste autorizado— la transacción se deshace y la pieza no queda cancelada con sus
      // unidades retenidas, que es el estado que nadie sabría corregir después.
      await this.designBudget.releaseForPiece(piece, `Cancelación (${CANCEL_ORIGIN_LABELS[origin]}): ${motivo}`, actorId, manager);

      piece.status = PieceStatus.CANCELLED;
      piece.cancelOrigin = origin;
      piece.cancelReason = motivo.slice(0, 500);
      piece.cancelledAt = new Date();
      piece.cancelledBy = actorId;
      return manager.save(Piece, piece);
    });
  }
}
