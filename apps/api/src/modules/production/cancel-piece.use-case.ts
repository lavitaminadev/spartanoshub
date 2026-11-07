import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { CancelOrigin, CANCEL_ORIGIN_LABELS } from './cancel-origin.enum';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import type { AuthUser } from '../../shared/types/request';

/**
 * Cancela una pieza y devuelve sus unidades según la regla configurada.
 *
 * Cancelar es distinto de rechazar: una pieza rechazada vuelve a corrección porque el trabajo
 * sigue en pie. Una cancelada no se va a hacer, y por eso lo que descontó del presupuesto del
 * cliente deja de corresponder a algo.
 *
 * La cancelación exige un motivo. Es lo que después permite distinguir una cancelación del
 * cliente de un error interno, que no deberían tratarse igual al revisar el mes.
 *
 * El alcance de empresa se comprueba acá y no en el controlador. Cancelar mueve el presupuesto de
 * una empresa concreta, así que quien lo pide tiene que alcanzarla; puesta la comprobación en el
 * caso de uso no queda ruta que pueda llegar sin ella.
 */
@Injectable()
export class CancelPieceUseCase {
  constructor(
    @InjectRepository(Piece) private readonly pieces: Repository<Piece>,
    private readonly designBudget: DesignBudgetService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  /**
   * @param actor - Quien cancela. Va en la firma, y no sólo su id, porque de él salen las dos
   * cosas que hacen falta: la constancia de quién lo hizo y el alcance con el que se comprueba
   * la empresa de la pieza.
   */
  async execute(pieceId: string, organizationId: string, reason: string, origin: CancelOrigin, actor: AuthUser): Promise<Piece> {
    const motivo = reason?.trim();
    if (!motivo) throw new BadRequestException('Indica por qué se cancela la pieza');
    const actorId = actor?.id;

    /*
     * La empresa se comprueba antes de abrir la transacción.
     *
     * Resolver el alcance son tres consultas más, y dentro de la transacción la fila de la pieza
     * queda bloqueada: hacerlo fuera mantiene el bloqueo tan corto como el trabajo que lo pide.
     * La relectura de dentro sigue siendo la que manda sobre el estado.
     */
    const dePieza = await this.pieces.findOne({ where: { id: pieceId, organizationId }, select: { id: true, clientId: true } });
    if (!dePieza) throw new NotFoundException('Pieza no encontrada');
    await this.accountAccess.assertClient(organizationId, actor, dePieza.clientId);

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
