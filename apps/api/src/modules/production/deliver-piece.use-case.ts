import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { XPService } from '../gamification/xp.service';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import type { AuthUser } from '../../shared/types/request';

/**
 * Entrega una pieza aprobada y confirma el consumo de sus unidades.
 *
 * El alcance de empresa se comprueba acá y no en el controlador. Entregar confirma el consumo
 * del presupuesto de una empresa concreta, así que quien lo pide tiene que alcanzarla; puesta la
 * comprobación en el caso de uso no queda ruta que pueda llegar sin ella.
 */
@Injectable()
export class DeliverPieceUseCase {
  constructor(
    @InjectRepository(Piece) private repo: Repository<Piece>,
    private designBudget: DesignBudgetService,
    private xp: XPService,
    private eventEmitter: EventEmitter2,
    private readonly accountAccess: AccountAccessService,
  ) {}

  /**
   * @param actor - Quien entrega. Va en la firma, y no sólo su id, porque de él salen las dos
   * cosas que hacen falta: a quién se le anota la entrega y el alcance con el que se comprueba
   * la empresa de la pieza.
   */
  async execute(pieceId: string, organizationId: string, actor: AuthUser) {
    const actorId = actor?.id;
    // La empresa se comprueba antes de abrir la transacción: resolver el alcance son tres
    // consultas más, y dentro no hay por qué tenerlas.
    const dePieza = await this.repo.findOne({ where: { id: pieceId, organizationId }, select: { id: true, clientId: true } });
    if (!dePieza) throw new NotFoundException('Pieza no encontrada');
    await this.accountAccess.assertClient(organizationId, actor, dePieza.clientId);

    const saved = await this.repo.manager.transaction(async (manager: EntityManager) => {
      const piece = await manager.findOne(Piece, { where: { id: pieceId, organizationId } });
      if (!piece) throw new NotFoundException('Pieza no encontrada');
      if (piece.status !== PieceStatus.APPROVED) throw new BadRequestException('La pieza debe estar aprobada antes de entregarse');

      const deliveredAt = new Date();
      piece.status = PieceStatus.DELIVERED;
      piece.deliveredAt = deliveredAt;
      const deliveredPiece = await manager.save(Piece, piece);
      await this.designBudget.confirmConsumption(deliveredPiece, actorId, manager);
      if (deliveredPiece.assignedTo) {
        await this.xp.registerDelivery(deliveredPiece, deliveredPiece.assignedTo, deliveredAt, manager);
      }

      return deliveredPiece;
    });
    this.eventEmitter.emit('piece.delivered', { organizationId, pieceId: saved.id });
    return saved;
  }
}
