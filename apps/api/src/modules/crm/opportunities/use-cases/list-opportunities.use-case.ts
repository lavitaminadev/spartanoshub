import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';

@Injectable()
export class ListOpportunitiesUseCase {
  constructor(
    @InjectRepository(Opportunity) private readonly repo: Repository<Opportunity>,
  ) {}

  /**
   * @param allowedClientIds - Cuentas que alcanza quien consulta; `undefined` significa sin
   *   límite, que es el caso de la administración y las direcciones.
   *
   * Una oportunidad sin cuenta es un prospecto que todavía no es cliente, así que no
   * pertenece a la cartera de nadie: se muestra a quien esté acotado en lugar de ocultarla.
   * Es el criterio opuesto al de leads y contactos, y es deliberado — allí un registro sin
   * cuenta es audiencia de un cliente y sí tiene dueño; acá es el embudo de la propia agencia.
   */
  async execute(
    organizationId: string,
    limit = 20,
    offset = 0,
    leadId?: string,
    allowedClientIds?: string[],
  ): Promise<{ data: Opportunity[]; total: number; limit: number; offset: number }> {
    const base: Record<string, unknown> = { organizationId };
    if (leadId) base.leadId = leadId;

    const where = allowedClientIds === undefined
      ? base
      : [
        { ...base, clientId: IsNull() },
        ...(allowedClientIds.length ? [{ ...base, clientId: In(allowedClientIds) }] : []),
      ];

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }
}
