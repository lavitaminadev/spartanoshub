import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';

@Injectable()
export class GetOpportunityUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
  ) {}

  /**
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` es sin límite.
   *
   * Responde 404 y no 403 cuando la oportunidad está fuera de alcance: confirmar que existe
   * pero está vedada ya revela con quién está negociando la agencia.
   */
  async execute(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Opportunity> {
    const opportunity = await this.repo.findOne({ where: { id, organizationId } });
    if (!opportunity) throw new NotFoundException('Opportunity not found');
    if (allowedClientIds !== undefined && opportunity.clientId && !allowedClientIds.includes(opportunity.clientId)) {
      throw new NotFoundException('Opportunity not found');
    }
    return opportunity;
  }
}
