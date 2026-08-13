import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceRequest } from './service-request.entity';
import { AuditService } from '../../core/audit/audit.service';
import { DataProtectionService } from '../../core/data-protection/data-protection.service';
import { User } from '../users/user.entity';
import { Lead } from '../crm/leads/lead.entity';
import { Contact } from '../crm/contacts/contact.entity';
import { Reservation } from '../reservations/domain/reservation.entity';

export const SERVICE_REQUEST_TYPES = [
  'account',
  'company',
  'rectification',
  'anonymization',
  'portability',
  'removal',
  'support',
] as const;
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export const SERVICE_REQUEST_STATUSES = ['received', 'in_review', 'resolved', 'rejected', 'more_info'] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

/** Tipos legalmente sensibles para los que el RUT es obligatorio (Ley 21.719 / ISO 27701). */
const SENSITIVE_TYPES: readonly string[] = ['rectification', 'anonymization', 'portability', 'removal'];

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(ServiceRequest) private readonly requests: Repository<ServiceRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Contact) private readonly contacts: Repository<Contact>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    private readonly audit: AuditService,
    private readonly dataProtection: DataProtectionService,
  ) {}

  /** Crea una solicitud desde la página pública. */
  async createPublic(input: {
    type: string;
    requesterName: string;
    requesterEmail: string;
    requesterRut?: string;
    requesterPhone?: string;
    message?: string;
    privacyAccepted: boolean;
    organizationId?: string;
  }): Promise<{ id: string; status: string }> {
    const type = input.type.trim().toLowerCase() as ServiceRequestType;
    if (!SERVICE_REQUEST_TYPES.includes(type)) throw new BadRequestException('Tipo de solicitud no válido');
    const email = input.requesterEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('El correo no es válido');
    if (!input.requesterName.trim()) throw new BadRequestException('El nombre es obligatorio');
    if (input.privacyAccepted !== true) {
      throw new BadRequestException('Debes aceptar el aviso de privacidad para enviar la solicitud');
    }
    const rut = input.requesterRut?.trim();
    if (SENSITIVE_TYPES.includes(type) && !rut) {
      throw new BadRequestException('Para este tipo de solicitud es obligatorio indicar tu RUT');
    }
    const saved = await this.requests.save(this.requests.create({
      organizationId: input.organizationId || null,
      type,
      status: 'received',
      requesterName: input.requesterName.trim(),
      requesterEmail: email,
      requesterRut: rut || null,
      requesterPhone: input.requesterPhone?.trim() || null,
      message: input.message?.trim() || null,
      extra: { privacyAccepted: true, privacyAcceptedAt: new Date().toISOString() },
    }));
    return { id: saved.id, status: saved.status };
  }

  /**
   * Consulta pública del historial del solicitante. Requiere correo y RUT para que nadie
   * pueda ver solicitudes ajenas; se devuelve solo el estado y la resolución, sin datos
   * personales adicionales.
   */
  async findByStatus(email: string, rut?: string): Promise<Array<Record<string, unknown>>> {
    const normalized = email.trim().toLowerCase();
    if (!rut?.trim()) throw new BadRequestException('Para consultar el estado necesitas tu correo y tu RUT');
    const rows = await this.requests.find({
      where: { requesterEmail: normalized, requesterRut: rut.trim() },
      order: { createdAt: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      message: row.message,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    }));
  }

  /** Lista de solicitudes para el panel de administración. */
  async list(organizationId: string, filter?: { status?: string; type?: string }): Promise<ServiceRequest[]> {
    const where: Record<string, unknown> = { organizationId };
    if (filter?.status && SERVICE_REQUEST_STATUSES.includes(filter.status as ServiceRequestStatus)) where.status = filter.status;
    if (filter?.type && SERVICE_REQUEST_TYPES.includes(filter.type as ServiceRequestType)) where.type = filter.type;
    return this.requests.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async getOne(organizationId: string, id: string): Promise<ServiceRequest> {
    const row = await this.requests.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('La solicitud no existe');
    return row;
  }

  /**
   * Resuelve una solicitud desde administración: cambia el estado, deja la nota de
   * resolución y audita quién la resolvió y cuándo.
   */
  async resolve(
    organizationId: string,
    id: string,
    actor: { id: string; name?: string },
    body: { status: string; resolutionNote?: string },
  ): Promise<ServiceRequest> {
    if (!SERVICE_REQUEST_STATUSES.includes(body.status as ServiceRequestStatus)) {
      throw new BadRequestException('Estado de resolución no válido');
    }
    const row = await this.getOne(organizationId, id);
    row.status = body.status;
    if (body.resolutionNote !== undefined) row.resolutionNote = body.resolutionNote.trim() || null;
    row.resolvedBy = actor.id;
    row.resolvedAt = new Date();
    const saved = await this.requests.save(row);
    await this.audit.log({
      organizationId,
      actorId: actor.id,
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'resolved',
      before: { status: saved.status === body.status ? 'received' : undefined },
      after: { status: body.status, resolutionNote: body.resolutionNote },
    });
    return saved;
  }

  /**
   * Ejecuta la anonimización de datos del solicitante (busca por correo y RUT en usuarios,
   * leads, contactos y reservas) y deja la solicitud como resuelta. Cada registro se audita.
   */
  async anonymizeByIdentity(organizationId: string, id: string, actor: { id: string; name?: string }): Promise<ServiceRequest> {
    const row = await this.getOne(organizationId, id);
    if (row.type !== 'anonymization' && row.type !== 'removal') {
      throw new BadRequestException('Esta solicitud no es de anonimización');
    }
    const email = row.requesterEmail.toLowerCase();
    const rut = row.requesterRut?.toLowerCase() || null;
    const reason = `Solicitud ${row.id}`;
    const matched: string[] = [];

    const users = await this.users.find({ where: { organizationId, email: In([email]) } });
    for (const user of users) {
      await this.dataProtection.anonymizeUser(user.id);
      matched.push(`User:${user.id}`);
    }
    const leads = await this.leads.find({ where: { organizationId, email: In([email]) } });
    for (const lead of leads) {
      await this.dataProtection.anonymizeLead(lead.id, organizationId, reason);
      matched.push(`Lead:${lead.id}`);
    }
    const contacts = await this.contacts.find({ where: { organizationId, email: In([email]) } });
    for (const contact of contacts) {
      await this.dataProtection.anonymizeContact(contact.id, organizationId, reason);
      matched.push(`Contact:${contact.id}`);
    }
    const reservations = await this.reservations.find({ where: { organizationId, guestEmail: In([email]) } });
    for (const reservation of reservations) {
      await this.dataProtection.anonymizeReservation(reservation.id, organizationId, reason);
      matched.push(`Reservation:${reservation.id}`);
    }

    row.status = 'resolved';
    row.resolutionNote = matched.length
      ? `Datos anonimizados (${matched.length} registros): ${matched.join(', ')}`
      : 'No se encontraron datos personales asociados a este correo.';
    row.resolvedBy = actor.id;
    row.resolvedAt = new Date();
    const saved = await this.requests.save(row);
    await this.audit.log({
      organizationId,
      actorId: actor.id,
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'anonymized',
      before: { status: 'received' },
      after: { status: 'resolved', records: matched },
    });
    return saved;
  }
}
