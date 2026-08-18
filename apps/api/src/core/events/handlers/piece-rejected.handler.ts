import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingService } from '../../../modules/billing/billing.service';
import { Correction } from '../../../modules/production/correction.entity';
import { Piece } from '../../../modules/production/piece.entity';

@Injectable()
export class PieceRejectedHandler {
  private readonly logger = new Logger(PieceRejectedHandler.name);

  constructor(
    @InjectRepository(Correction) private readonly corrections: Repository<Correction>,
    @InjectRepository(Piece) private readonly pieces: Repository<Piece>,
    private readonly billing: BillingService,
  ) {}

  /**
   * Deja constancia de que la ronda quedó marcada como cobrable.
   *
   * **Ya no emite la nota de cobro.** Antes la creaba en cada rechazo, es decir antes de saber
   * cómo terminaba el trabajo: si después resultaba que la ronda fue por un error del equipo,
   * quedaba una nota emitida que alguien tenía que anular a mano. Ahora la emisión ocurre al
   * aprobar la pieza, en `ProductionWorkflowService.settleBillableCorrections`, cuando ya se
   * sabe cuántas rondas hubo y cuáles fueron del cliente.
   *
   * El registro se conserva porque es la señal que permite revisar la ronda antes de que se
   * cobre, que es justamente la ventana que se buscaba abrir.
   */
  @OnEvent('piece.rejected')
  async handle(payload: { organizationId: string; pieceId: string; correctionId: string; requestedBy?: string }) {
    try {
      const correction = await this.corrections.findOne({ where: { id: payload.correctionId, pieceId: payload.pieceId } });
      if (!correction?.chargeNoteRequired) return;

      const piece = await this.pieces.findOne({ where: { id: payload.pieceId, organizationId: payload.organizationId } });
      if (!piece) return;

      this.logger.log(
        `Pieza ${piece.id}: ronda ${piece.clientCorrectionCount} del cliente supera lo incluido. `
        + 'Queda marcada como cobrable; la nota se emitirá al aprobar.',
      );
    } catch (error) {
      this.logger.error(`Error procesando piece.rejected para pieza ${payload.pieceId} / correccion ${payload.correctionId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
