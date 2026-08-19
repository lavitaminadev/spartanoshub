import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { Correction } from './correction.entity';
import { PieceRulesService } from './piece-rules.service';
import { ProcessHistoryService } from '../../core/process-history/process-history.service';
import { ProcessSubject } from '../../core/process-history/process-stage-change.entity';
import { PieceStatus } from './piece-status.enum';
import { CorrectionOrigin } from './correction-origin.enum';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { XPService } from '../gamification/xp.service';
import { BillingService } from '../billing/billing.service';
import { PieceType } from './piece-type.enum';

@Injectable()
export class ProductionWorkflowService {
  constructor(
    @InjectRepository(Piece) private pieceRepo: Repository<Piece>,
    @InjectRepository(PieceVersion) private versionRepo: Repository<PieceVersion>,
    @InjectRepository(Correction) private correctionRepo: Repository<Correction>,
    private designBudget: DesignBudgetService,
    private xp: XPService,
    private billing: BillingService,
    private pieceRules: PieceRulesService,
    private history: ProcessHistoryService,
  ) {}

  async assign(
    piece: Piece,
    designerId: string,
    pieceType: PieceType,
    difficultyLevel: number,
    carouselSlides = 0,
    actorId?: string,
  ): Promise<void> {
    const etapaPrevia = piece.status;
    await this.pieceRepo.manager.transaction(async (manager) => {
      const udAmount = await this.designBudget.calculateForPiece(pieceType, carouselSlides, piece.organizationId);

      piece.assignedTo = designerId;
      piece.type = pieceType;
      piece.difficultyLevel = difficultyLevel;
      piece.udAmount = udAmount;
      piece.status = PieceStatus.ASSIGNED;

      await manager.save(Piece, piece);
      await this.designBudget.reserveForPiece(piece, actorId, manager);
    });

    // El registro va fuera de la transacción en los cuatro pasos: si el historial fallara
    // dentro, revertiría el avance del trabajo, y perder una fila de informe nunca justifica
    // impedir que alguien asigne, entregue o corrija una pieza.
    await this.history.recordStageChange(
      piece.organizationId, ProcessSubject.PIECE, piece.id, etapaPrevia, piece.status, actorId,
    );
  }

  async submitVersion(piece: Piece, fileName: string, driveFileId: string | undefined, userId: string): Promise<PieceVersion> {
    const maxResult = await this.versionRepo.findOne({
      where: { pieceId: piece.id },
      order: { versionNumber: 'DESC' },
    });
    const nextVersion = (maxResult?.versionNumber ?? 0) + 1;

    const version = this.versionRepo.create({
      pieceId: piece.id,
      versionNumber: nextVersion,
      fileName,
      driveFileId,
      createdBy: userId,
    });
    const saved = await this.versionRepo.save(version);

    const etapaPrevia = piece.status;
    piece.status = PieceStatus.INTERNAL_REVIEW;
    await this.pieceRepo.save(piece);
    await this.history.recordStageChange(
      piece.organizationId, ProcessSubject.PIECE, piece.id, etapaPrevia, piece.status, userId,
    );

    return saved;
  }

  /**
   * Emite las notas de cobro de las rondas que excedieron lo incluido.
   *
   * Se llama al aprobar la pieza y no en cada rechazo. Cobrar al rechazar emitía la nota antes
   * de saber cómo terminaba el trabajo: si después resultaba que la ronda fue por un error del
   * equipo, quedaba una nota emitida que alguien tenía que anular a mano. Al cerrar ya se sabe
   * cuántas rondas hubo y cuáles fueron del cliente.
   *
   * Es idempotente: una corrección que ya tiene nota no genera otra, así que reintentar o
   * aprobar dos veces no duplica el cobro.
   *
   * @param actorId - Quien aprueba. Queda como responsable de la nota.
   */
  async settleBillableCorrections(piece: Piece, actorId?: string, manager?: EntityManager): Promise<number> {
    const runner = manager ?? this.pieceRepo.manager;

    const pendientes = await runner.find(Correction, {
      where: { pieceId: piece.id, chargeNoteRequired: true },
      order: { createdAt: 'ASC' },
    });
    if (!pendientes.length) return 0;

    // Una sola consulta para todas: preguntar por cada corrección haría una lectura por ronda.
    const yaCobradas = await runner.query(
      `SELECT correction_id FROM charge_notes WHERE correction_id IN (${pendientes.map(() => '?').join(',')})`,
      pendientes.map((item: Correction) => item.id),
    ) as Array<{ correction_id: string }>;
    const cobradas = new Set(yaCobradas.map((row) => row.correction_id));

    let emitidas = 0;
    for (const [index, correction] of pendientes.entries()) {
      if (cobradas.has(correction.id)) continue;
      await this.billing.createCorrectionCharge({
        organizationId: piece.organizationId,
        clientId: piece.clientId,
        pieceId: piece.id,
        correctionId: correction.id,
        // El número de ronda que le tocó, no el contador final: la nota debe decir cuál fue.
        correctionNumber: index + 1,
        createdBy: actorId,
      }, runner);
      emitidas += 1;
    }
    return emitidas;
  }

  async rejectByClient(piece: Piece, version: PieceVersion, comment: string, clientUserId: string): Promise<void> {
    const etapaPrevia = piece.status;
    await this.pieceRepo.manager.transaction(async (manager) => {
      piece.clientCorrectionCount = (piece.clientCorrectionCount ?? 0) + 1;
      piece.correctionCount = (piece.correctionCount ?? 0) + 1;

      // El límite sale de la configuración, no de un número escrito acá: con el 3 fijo, subirlo
      // dejaba esta pantalla cobrando lo que la aprobación consideraba incluido.
      const excedeLoIncluido = await this.pieceRules.shouldGenerateInvoice(
        piece.clientCorrectionCount,
        piece.organizationId,
      );

      const correction = manager.create(Correction, {
        pieceId: piece.id,
        pieceVersionId: version.id,
        origin: CorrectionOrigin.CLIENT_REQUEST,
        description: comment,
        requestedBy: clientUserId,
        billableExtra: excedeLoIncluido,
        chargeNoteRequired: excedeLoIncluido,
      });
      await manager.save(Correction, correction);

      /*
       * Se marca cobrable, pero **no se cobra todavía**.
       *
       * El cobro se genera al aprobar la pieza, en `settleBillableCorrections`. Cobrar en cada
       * rechazo emitía la nota antes de saber cómo terminaba el trabajo: si después se
       * determinaba que la ronda fue por un error del equipo, ya había una nota emitida que
       * alguien tenía que anular a mano.
       */

      piece.status = PieceStatus.CORRECTION;
      await manager.save(Piece, piece);
    });

    // El comentario del cliente viaja como motivo: es lo que explica esta vuelta atrás, y sin
    // él el historial muestra un retroceso sin causa.
    await this.history.recordStageChange(
      piece.organizationId, ProcessSubject.PIECE, piece.id,
      etapaPrevia, piece.status, clientUserId, comment,
    );
  }

  async deliver(piece: Piece, actorId?: string): Promise<void> {
    const etapaPrevia = piece.status;
    await this.pieceRepo.manager.transaction(async (manager) => {
      piece.status = PieceStatus.DELIVERED;
      piece.deliveredAt = new Date();
      await manager.save(Piece, piece);

      const freshPiece = await manager.findOne(Piece, { where: { id: piece.id } });

      await this.designBudget.confirmConsumption(piece, actorId, manager);

      if (freshPiece?.assignedTo) {
        await this.xp.registerDelivery(freshPiece, freshPiece.assignedTo, new Date(), manager);
      }
    });

    await this.history.recordStageChange(
      piece.organizationId, ProcessSubject.PIECE, piece.id, etapaPrevia, piece.status, actorId,
    );
  }

  async flagDesignerError(piece: Piece, version: PieceVersion, description: string, artDirectorId: string): Promise<void> {
    await this.pieceRepo.manager.transaction(async (manager) => {
      piece.correctionCount = (piece.correctionCount ?? 0) + 1;

      const correction = manager.create(Correction, {
        pieceId: piece.id,
        pieceVersionId: version.id,
        origin: CorrectionOrigin.DESIGNER_ERROR,
        description,
        requestedBy: artDirectorId,
        billableExtra: false,
        chargeNoteRequired: false,
      });
      await manager.save(Correction, correction);

      if (piece.assignedTo) {
        await this.xp.registerDesignerErrorPenalty(piece, piece.assignedTo, manager);
      }
    });
  }
}
