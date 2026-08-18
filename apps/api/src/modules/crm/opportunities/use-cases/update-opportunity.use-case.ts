import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { UpdateOpportunityDto } from '../dto/update-opportunity.dto';
import { OpportunityReferenceValidator } from '../opportunity-reference-validator.service';
import { OpportunityStageHistoryService } from '../opportunity-stage-history.service';
import { GetOpportunityUseCase } from './get-opportunity.use-case';

@Injectable()
export class UpdateOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    private readonly referenceValidator: OpportunityReferenceValidator,
    private readonly getOpportunity: GetOpportunityUseCase,
    private readonly stageHistory: OpportunityStageHistoryService,
  ) {}

  /**
   * @param actorId - Persona que realiza el cambio, para el historial de etapas.
   */
  async execute(id: string, dto: UpdateOpportunityDto, organizationId: string, actorId?: string): Promise<Opportunity> {
    const opportunity = await this.getOpportunity.execute(id, organizationId);
    // Se lee antes de aplicar el DTO: después, `opportunity.stage` ya trae el valor nuevo y
    // la transición sería indistinguible de una edición que no movió el trato.
    const previousStage = opportunity.stage;
    await this.referenceValidator.validate(dto, organizationId);
    const movingToLost = dto.stage?.trim().toLowerCase() === 'lost' && opportunity.stage !== 'lost';
    if (movingToLost && !dto.lossReason && !opportunity.lossReason) {
      throw new BadRequestException('Indica el motivo de pérdida antes de cerrar la oportunidad como perdida');
    }
    Object.assign(opportunity, dto);
    if (dto.name !== undefined) opportunity.name = dto.name.trim().replace(/\s+/g, ' ');
    if (dto.stage !== undefined) opportunity.stage = dto.stage.trim().toLowerCase();
    if (dto.lossReason !== undefined) opportunity.lossReason = dto.lossReason.trim();
    if (dto.lossNote !== undefined) opportunity.lossNote = dto.lossNote?.trim() || undefined;
    if (dto.expectedCloseDate !== undefined) opportunity.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined;
    if (dto.nextAction !== undefined) opportunity.nextAction = dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined;
    if (dto.nextActionAt !== undefined) opportunity.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : undefined;
    const saved = await this.repo.save(opportunity);
    // Después de guardar: un historial que registre una transición que la base rechazó
    // describiría un recorrido que no ocurrió.
    await this.stageHistory.recordStageChange(saved, previousStage, actorId);
    return saved;
  }
}
