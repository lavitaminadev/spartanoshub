import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { CreateOpportunityDto } from '../dto/create-opportunity.dto';
import { OpportunityReferenceValidator } from '../opportunity-reference-validator.service';
import { OpportunityStageHistoryService } from '../opportunity-stage-history.service';

@Injectable()
export class CreateOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    private readonly referenceValidator: OpportunityReferenceValidator,
    private readonly stageHistory: OpportunityStageHistoryService,
  ) {}

  /**
   * @param actorId - Persona que abre el trato, para el historial de etapas.
   */
  /**
   * Crea un trato en una de las empresas que la cuenta alcanza.
   *
   * `allowedClientIds` acota la empresa que el cuerpo puede nombrar: el validador comprueba que
   * exista en la organización, que no es lo mismo que estar al alcance de quien crea.
   */
  async execute(dto: CreateOpportunityDto, organizationId: string, actorId?: string, allowedClientIds?: string[]): Promise<Opportunity> {
    if (dto.clientId && allowedClientIds !== undefined && !allowedClientIds.includes(dto.clientId)) {
      throw new BadRequestException('No puedes crear el trato en esa empresa');
    }
    await this.referenceValidator.validate(dto, organizationId);
    const opportunity = this.repo.create({
      ...dto,
      organizationId,
      name: dto.name.trim().replace(/\s+/g, ' '),
      stage: dto.stage?.trim().toLowerCase() || 'new',
      expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      nextAction: dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined,
      nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : undefined,
    });
    const saved = await this.repo.save(opportunity);
    await this.stageHistory.recordCreated(saved, actorId);
    return saved;
  }
}
