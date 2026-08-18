import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Moodboard } from './moodboard.entity';
import { Session } from './session.entity';
import { CreateMoodboardDto } from './dto/create-moodboard.dto';
import { UpdateMoodboardDto } from './dto/update-moodboard.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

/**
 * Estado en que un moodboard habilita agendar.
 *
 * Coincide con el valor que acepta `CreateMoodboardDto` y con el que escribe «Aprobar» en la
 * pantalla. Se declara acá para que la regla de agendamiento y la de aprobación no puedan
 * describir estados distintos.
 */
const MOODBOARD_APPROVED = 'approved';

/**
 * Lógica de negocio para moodboards y sesiones audiovisuales.
 */
@Injectable()
export class AudiovisualService {
  constructor(
    @InjectRepository(Moodboard) private readonly moodboardRepo: Repository<Moodboard>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // CRUD de moodboard
  async createMoodboard(dto: CreateMoodboardDto, organizationId: string, createdBy: string): Promise<Moodboard> {
    await this.validateClient(dto.clientId, organizationId);
    const entity = this.moodboardRepo.create({
      ...dto,
      organizationId,
      createdBy,
      title: dto.title.trim(),
      description: dto.description?.trim() || undefined,
    });
    return this.moodboardRepo.save(entity);
  }

  async findAllMoodboards(organizationId: string, limit = 50, offset = 0): Promise<{ data: Moodboard[]; total: number; limit: number; offset: number }> {
    const [data, total] = await this.moodboardRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: { client: true },
      take: limit,
      skip: offset,
    });
    return { data, total, limit, offset };
  }

  async findOneMoodboard(id: string, organizationId: string): Promise<Moodboard> {
    const entity = await this.moodboardRepo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Moodboard not found');
    return entity;
  }

  async updateMoodboard(id: string, dto: UpdateMoodboardDto, organizationId: string): Promise<Moodboard> {
    const entity = await this.findOneMoodboard(id, organizationId);
    await this.validateUsers(dto.verifiedBy ? [dto.verifiedBy] : [], organizationId);
    Object.assign(entity, dto);
    if (dto.title !== undefined) entity.title = dto.title.trim();
    if (dto.description !== undefined) entity.description = dto.description.trim() || undefined;
    return this.moodboardRepo.save(entity);
  }

  async removeMoodboard(id: string, organizationId: string): Promise<Moodboard> {
    const entity = await this.findOneMoodboard(id, organizationId);
    return this.moodboardRepo.remove(entity);
  }

  // CRUD de sesión
  async createSession(dto: CreateSessionDto, organizationId: string): Promise<Session> {
    // Al agendar el moodboard aprobado es obligatorio: es el momento en que se convoca al equipo.
    await this.validateSessionReferences(dto.clientId, dto.moodboardId, dto.assignedTeam, organizationId, true);
    const entity = this.sessionRepo.create({
      ...dto,
      organizationId,
      date: new Date(dto.date),
      location: dto.location?.trim() || undefined,
    });
    return this.sessionRepo.save(entity);
  }

  async findAllSessions(organizationId: string, limit = 50, offset = 0, assignedTo?: string): Promise<{ data: Session[]; total: number; limit: number; offset: number }> {
    const query = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.client', 'client')
      .where('session.organization_id = :organizationId', { organizationId })
      .orderBy('session.date', 'DESC')
      .take(limit)
      .skip(offset);
    if (assignedTo) query.andWhere('JSON_CONTAINS(session.assigned_team, :assignedTo)', { assignedTo: JSON.stringify(assignedTo) });
    const [data, total] = await query.getManyAndCount();
    return { data, total, limit, offset };
  }

  async findOneSession(id: string, organizationId: string): Promise<Session> {
    const entity = await this.sessionRepo.findOne({ where: { id, organizationId } });
    if (!entity) throw new NotFoundException('Session not found');
    return entity;
  }

  async updateSession(id: string, dto: UpdateSessionDto, organizationId: string): Promise<Session> {
    const entity = await this.findOneSession(id, organizationId);
    // `false`: una sesión ya agendada se confirma y se completa sin volver a exigir moodboard.
    // Si el cambio incluye uno nuevo, ese sí tiene que estar aprobado.
    await this.validateSessionReferences(entity.clientId, dto.moodboardId, dto.assignedTeam, organizationId, false);
    Object.assign(entity, dto);
    if (dto.date !== undefined) entity.date = new Date(dto.date);
    if (dto.location !== undefined) entity.location = dto.location.trim() || undefined;
    return this.sessionRepo.save(entity);
  }

  async removeSession(id: string, organizationId: string): Promise<Session> {
    const entity = await this.findOneSession(id, organizationId);
    return this.sessionRepo.remove(entity);
  }

  private async validateClient(clientId: string, organizationId: string): Promise<void> {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new BadRequestException('El cliente no pertenece a esta organizacion');
  }

  private async validateUsers(userIds: string[] = [], organizationId: string): Promise<void> {
    if (!userIds.length) return;
    const uniqueIds = [...new Set(userIds)];
    const count = await this.users.createQueryBuilder('user')
      .where('user.organization_id = :organizationId AND user.is_active = 1', { organizationId })
      .andWhere('user.id IN (:...userIds)', { userIds: uniqueIds })
      .getCount();
    if (count !== uniqueIds.length) throw new BadRequestException('El equipo asignado contiene usuarios invalidos');
  }

  /**
   * Valida cliente, equipo y —cuando corresponde— el moodboard.
   *
   * @param requireMoodboard - Verdadero al agendar, donde el moodboard aprobado es obligatorio.
   *   Falso al actualizar una sesión ya agendada: las sesiones creadas antes de que existiera
   *   esta regla no tienen moodboard, y exigirlo en cada cambio impediría confirmarlas o
   *   completarlas. En una actualización el moodboard solo se valida si se está cambiando.
   */
  private async validateSessionReferences(
    clientId: string,
    moodboardId: string | undefined,
    assignedTeam: string[] | undefined,
    organizationId: string,
    requireMoodboard: boolean,
  ): Promise<void> {
    await Promise.all([this.validateClient(clientId, organizationId), this.validateUsers(assignedTeam, organizationId)]);
    if (!requireMoodboard && !moodboardId) return;
    await this.assertApprovedMoodboard(clientId, moodboardId, organizationId);
  }

  /**
   * Exige un moodboard aprobado para poder agendar.
   *
   * Es la regla del flujo audiovisual: la community manager crea el moodboard, la dirección
   * creativa lo verifica y la dirección audiovisual asigna equipo. Agendar antes de esa
   * aprobación convoca a un equipo a grabar algo que todavía no está definido, y el rodaje se
   * pierde o se repite.
   *
   * Antes el moodboard era opcional —la validación retornaba sin comprobar nada si no venía— y
   * cuando venía solo se verificaba que perteneciera al cliente: su estado no se miraba en
   * ningún punto. Se podía agendar sin moodboard, o con uno en borrador.
   *
   * @throws BadRequestException con el motivo exacto, para que la pantalla lo pueda mostrar.
   */
  private async assertApprovedMoodboard(clientId: string, moodboardId: string | undefined, organizationId: string): Promise<void> {
    if (!moodboardId) {
      throw new BadRequestException('Una sesión necesita un moodboard aprobado antes de agendarse');
    }

    const moodboard = await this.moodboardRepo.findOne({ where: { id: moodboardId, organizationId, clientId } });
    if (!moodboard) throw new BadRequestException('El moodboard no pertenece al cliente seleccionado');

    if (moodboard.status !== MOODBOARD_APPROVED) {
      throw new BadRequestException(
        `El moodboard «${moodboard.title}» todavía no está aprobado. La dirección creativa debe aprobarlo antes de agendar la sesión.`,
      );
    }
  }
}
