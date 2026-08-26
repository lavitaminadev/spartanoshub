import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interaction } from './interaction.entity';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { UpdateInteractionDto } from './dto/update-interaction.dto';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';

/**
 * Lógica de negocio para las interacciones de CRM.
 */
@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(Interaction) private readonly repo: Repository<Interaction>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
  ) {}

  async create(dto: CreateInteractionDto, organizationId: string, actorId: string): Promise<Interaction> {
    await this.validateReferences(dto, organizationId);
    const interaction = this.repo.create({
      ...dto,
      organizationId,
      type: dto.type.trim().toLowerCase(),
      description: dto.description?.trim() || undefined,
      date: dto.date ? new Date(dto.date) : new Date(),
      createdBy: actorId,
    });
    return this.repo.save(interaction);
  }

  async findAll(
    organizationId: string,
    limit = 50,
    offset = 0,
    leadId?: string,
    allowedClientIds?: string[],
    clientId?: string,
    /**
     * Rango de la actividad. Lo usa el calendario para pedir exactamente el período que dibuja,
     * en vez de «las últimas N» —que dejaba los meses anteriores vacíos y truncaba los llenos—.
     */
    rango?: { from?: string; to?: string },
  ): Promise<{ data: Interaction[]; total: number; limit: number; offset: number }> {
    // El mismo rango se aplica a los dos caminos, así que se arma una vez.
    const acotarRango = (aplicar: (sql: string, params: Record<string, unknown>) => void) => {
      if (rango?.from) aplicar('interaction.date >= :from', { from: rango.from });
      if (rango?.to) aplicar('interaction.date <= :to', { to: rango.to });
    };

    if (allowedClientIds !== undefined || clientId || rango?.from || rango?.to) {
      if (allowedClientIds !== undefined && allowedClientIds.length === 0) return { data: [], total: 0, limit, offset };
      const query = this.repo.createQueryBuilder('interaction')
        .leftJoin(Lead, 'lead', 'lead.id = interaction.lead_id AND lead.organization_id = interaction.organization_id')
        .leftJoin(Contact, 'contact', 'contact.id = interaction.contact_id AND contact.organization_id = interaction.organization_id')
        .where('interaction.organization_id = :organizationId', { organizationId });
      if (clientId) {
        query.andWhere('(lead.client_id = :clientId OR contact.client_id = :clientId)', { clientId });
      } else if (allowedClientIds !== undefined) {
        query.andWhere('(lead.client_id IN (:...allowedClientIds) OR contact.client_id IN (:...allowedClientIds))', { allowedClientIds });
      }
      if (leadId) query.andWhere('interaction.lead_id = :leadId', { leadId });
      acotarRango((sql, params) => { query.andWhere(sql, params); });
      const [data, total] = await query.orderBy('interaction.date', 'DESC').skip(offset).take(limit).getManyAndCount();
      return { data, total, limit, offset };
    }
    const where: Record<string, unknown> = { organizationId };
    if (leadId) where.leadId = leadId;

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { date: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string, organizationId: string): Promise<Interaction> {
    const interaction = await this.repo.findOne({ where: { id, organizationId } });
    if (!interaction) throw new NotFoundException('Interaction not found');
    return interaction;
  }

  async update(id: string, dto: UpdateInteractionDto, organizationId: string): Promise<Interaction> {
    const interaction = await this.findOne(id, organizationId);
    await this.validateReferences(dto, organizationId);
    Object.assign(interaction, dto);
    if (dto.type !== undefined) interaction.type = dto.type.trim().toLowerCase();
    if (dto.description !== undefined) interaction.description = dto.description.trim() || undefined;
    if (dto.date !== undefined) interaction.date = new Date(dto.date);
    return this.repo.save(interaction);
  }

  async remove(id: string, organizationId: string): Promise<Interaction> {
    const interaction = await this.findOne(id, organizationId);
    return this.repo.remove(interaction);
  }

  /** Empresa a la que pertenecen las referencias propuestas para una interacción. */
  async referenceClientId(
    dto: { leadId?: string | null; contactId?: string | null },
    organizationId: string,
  ): Promise<string | undefined> {
    const [lead, contact] = await Promise.all([
      dto.leadId
        ? this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true, clientId: true } })
        : null,
      dto.contactId
        ? this.contacts.findOne({ where: { id: dto.contactId, organizationId }, select: { id: true, clientId: true, leadId: true } })
        : null,
    ]);
    if (dto.leadId && !lead) throw new NotFoundException('Interaction not found');
    if (dto.contactId && !contact) throw new NotFoundException('Interaction not found');
    return lead?.clientId ?? contact?.clientId;
  }

  /** Empresa efectiva de una interacción existente o de cómo quedaría tras actualizarla. */
  async effectiveClientId(
    interaction: Interaction,
    dto: { leadId?: string | null; contactId?: string | null },
    organizationId: string,
  ): Promise<string | undefined> {
    return this.referenceClientId({
      leadId: dto.leadId !== undefined ? dto.leadId : interaction.leadId,
      contactId: dto.contactId !== undefined ? dto.contactId : interaction.contactId,
    }, organizationId);
  }

  private async validateReferences(
    dto: { leadId?: string | null; contactId?: string | null },
    organizationId: string,
  ): Promise<void> {
    if (dto.leadId) {
      const lead = await this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true } });
      if (!lead) throw new BadRequestException('El lead no pertenece a esta organización');
    }
    if (dto.contactId) {
      const contact = await this.contacts.findOne({ where: { id: dto.contactId, organizationId }, select: { id: true, leadId: true } });
      if (!contact) throw new BadRequestException('El contacto no pertenece a esta organización');
      if (dto.leadId && contact.leadId && contact.leadId !== dto.leadId) {
        throw new BadRequestException('El contacto no pertenece al lead indicado');
      }
    }
  }
}
