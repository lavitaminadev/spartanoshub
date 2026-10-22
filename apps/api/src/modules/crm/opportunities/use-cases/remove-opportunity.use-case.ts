import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { GetOpportunityUseCase } from './get-opportunity.use-case';

@Injectable()
export class RemoveOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
    private readonly getOpportunity: GetOpportunityUseCase,
  ) {}

  /**
   * Borra un trato de una de las empresas que la cuenta alcanza.
   *
   * `allowedClientIds` se pasa a la lectura: un trato de otra empresa da el mismo 404 que si no
   * existiera, en vez de borrarse por conocer su id.
   */
  async execute(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Opportunity> {
    const opportunity = await this.getOpportunity.execute(id, organizationId, allowedClientIds);
    return this.repo.remove(opportunity);
  }
}
