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
import { normalizePhone } from '../../shared/phone';

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

  /**
   * Aviso de privacidad vigente para el formulario público.
   *
   * Se sirve desde acá y no se escribe en la página porque el texto es un documento con
   * versión: cambiarlo debe dejar rastro de quién y cuándo, y las aceptaciones anteriores
   * deben seguir apuntando al texto que su titular leyó.
   */
  async avisoPrivacidad(organizationId: string) {
    return this.dataProtection.avisoPrivacidadVigente(organizationId);
  }

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

    // Qué aviso estaba vigente al aceptar. Registrar solo que aceptó deja una constancia que no
    // se puede exhibir: ante una consulta del titular hay que poder mostrar el texto exacto que
    // leyó, y ese texto cambia con el tiempo.
    const aviso = await this.dataProtection.avisoPrivacidadVigente(input.organizationId || '');

    const saved = await this.requests.save(this.requests.create({
      organizationId: input.organizationId || null,
      type,
      status: 'received',
      requesterName: input.requesterName.trim(),
      requesterEmail: email,
      requesterRut: rut || null,
      requesterPhone: input.requesterPhone?.trim() || null,
      message: input.message?.trim() || null,
      extra: {
        privacyAccepted: true,
        privacyAcceptedAt: new Date().toISOString(),
        privacyVersion: aviso.version,
        privacyVersionId: aviso.versionId,
        privacyProvisional: aviso.provisional,
      },
    }));
    return { id: saved.id, status: saved.status };
  }

  /**
   * Consulta pública del estado, por el código de seguimiento de la solicitud.
   *
   * El código es el identificador de la solicitud, que se entrega al enviarla. Sirve de secreto
   * porque no se puede adivinar y solo lo tiene quien la creó; y no es un dato personal, así
   * que puede viajar en la dirección sin dejar rastro identificable en los registros.
   *
   * Devuelve el estado y la resolución, nunca los datos del solicitante: quien consulta ya sabe
   * quién es, y repetírselos solo agrega superficie para que los lea otro.
   */
  async findByReference(reference: string): Promise<Array<Record<string, unknown>>> {
    const ref = (reference ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
      throw new BadRequestException('Ingresa el código de seguimiento que recibiste al enviar tu solicitud');
    }
    const row = await this.requests.findOne({ where: { id: ref } });
    if (!row) throw new NotFoundException('No encontramos una solicitud con ese código');
    return [{
      id: row.id,
      type: row.type,
      status: row.status,
      message: row.message,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    }];
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
   * Edición completa de una solicitud desde administración: permite corregir los datos del
   * solicitante, el tipo y el mensaje, además de cambiar el estado y la nota de resolución
   * (incluida la reapertura). Todo cambio queda auditado con el estado anterior y el nuevo.
   */
  async update(
    organizationId: string,
    id: string,
    actor: { id: string; name?: string },
    body: {
      type?: string;
      requesterName?: string;
      requesterEmail?: string;
      requesterRut?: string;
      requesterPhone?: string;
      message?: string;
      status?: string;
      resolutionNote?: string;
    },
  ): Promise<ServiceRequest> {
    const row = await this.getOne(organizationId, id);
    const before: Record<string, unknown> = {
      type: row.type,
      status: row.status,
      requesterName: row.requesterName,
      requesterEmail: row.requesterEmail,
      requesterRut: row.requesterRut,
      requesterPhone: row.requesterPhone,
      message: row.message,
      resolutionNote: row.resolutionNote,
    };
    if (body.type !== undefined) {
      if (!SERVICE_REQUEST_TYPES.includes(body.type as ServiceRequestType)) throw new BadRequestException('Tipo de solicitud no válido');
      row.type = body.type;
    }
    if (body.requesterName !== undefined) {
      if (!body.requesterName.trim()) throw new BadRequestException('El nombre es obligatorio');
      row.requesterName = body.requesterName.trim();
    }
    if (body.requesterEmail !== undefined) {
      const email = body.requesterEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('El correo no es válido');
      row.requesterEmail = email;
    }
    if (body.requesterRut !== undefined) row.requesterRut = body.requesterRut.trim() || null;
    if (body.requesterPhone !== undefined) row.requesterPhone = body.requesterPhone.trim() || null;
    if (body.message !== undefined) row.message = body.message.trim() || null;
    if (body.status !== undefined) {
      if (!SERVICE_REQUEST_STATUSES.includes(body.status as ServiceRequestStatus)) throw new BadRequestException('Estado de resolución no válido');
      row.status = body.status;
      // Reabrir deja la resolución anterior como histórico; el nuevo cierre se registrará al resolver.
      if (body.status === 'received' || body.status === 'in_review') {
        row.resolvedAt = null;
        row.resolvedBy = null;
      } else {
        row.resolvedBy = actor.id;
        row.resolvedAt = new Date();
      }
    }
    if (body.resolutionNote !== undefined) row.resolutionNote = body.resolutionNote.trim() || null;
    const saved = await this.requests.save(row);
    const after: Record<string, unknown> = {
      type: saved.type,
      status: saved.status,
      requesterName: saved.requesterName,
      requesterEmail: saved.requesterEmail,
      requesterRut: saved.requesterRut,
      requesterPhone: saved.requesterPhone,
      message: saved.message,
      resolutionNote: saved.resolutionNote,
    };
    await this.audit.log({
      organizationId,
      actorId: actor.id,
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'updated',
      before,
      after,
    });
    return saved;
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
    // El estado anterior se toma antes de mutar la fila: leerlo después devuelve el nuevo y
    // la traza deja de servir como prueba de qué se cambió.
    const before = { status: row.status, resolutionNote: row.resolutionNote };
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
      before,
      after: { status: saved.status, resolutionNote: saved.resolutionNote },
    });
    return saved;
  }

  /**
   * Ejecuta la anonimización de datos del solicitante y deja la solicitud como resuelta.
   *
   * **Coincide por correo y por teléfono.** Ninguna de las cuatro entidades guarda RUT, así que
   * el que declara el titular sirve para identificarlo ante Seguridad pero no para buscar sus
   * registros. El teléfono sí está en las cuatro y se normaliza antes de comparar.
   *
   * Aun así la búsqueda es incompleta por definición: si la persona dejó datos con otro contacto
   * —una reserva a nombre de un familiar, un lead capturado con su correo de trabajo— esos
   * registros no aparecen. Por eso **sin coincidencias la solicitud no se cierra**: queda en
   * revisión para que alguien la busque a mano, y la nota de resolución dice sobre qué se buscó.
   *
   * Declarar cumplido un derecho de supresión sobre una búsqueda parcial es peor que no
   * ofrecer la función: compromete a la agencia con algo que no verificó. Cada registro tocado
   * se audita.
   */
  async anonymizeByIdentity(organizationId: string, id: string, actor: { id: string; name?: string }): Promise<ServiceRequest> {
    const row = await this.getOne(organizationId, id);
    if (row.type !== 'anonymization' && row.type !== 'removal') {
      throw new BadRequestException('Esta solicitud no es de anonimización');
    }
    const email = row.requesterEmail.toLowerCase();
    const phone = normalizePhone(row.requesterPhone || '') || null;
    const previous = { status: row.status, resolutionNote: row.resolutionNote };
    const reason = `Solicitud ${row.id}`;
    const matched: string[] = [];

    /** Criterios de búsqueda: correo siempre, teléfono cuando el titular lo declaró. */
    const by = (emailField: 'email' | 'guestEmail', phoneField: 'phone' | 'guestPhone') => {
      const criteria: Record<string, unknown>[] = [{ organizationId, [emailField]: In([email]) }];
      if (phone) criteria.push({ organizationId, [phoneField]: In([phone]) });
      return criteria;
    };

    const users = await this.users.find({ where: by('email', 'phone') as never });
    for (const user of users) {
      await this.dataProtection.anonymizeUser(user.id);
      matched.push(`User:${user.id}`);
    }
    const leads = await this.leads.find({ where: by('email', 'phone') as never });
    for (const lead of leads) {
      await this.dataProtection.anonymizeLead(lead.id, organizationId, reason);
      matched.push(`Lead:${lead.id}`);
    }
    const contacts = await this.contacts.find({ where: by('email', 'phone') as never });
    for (const contact of contacts) {
      await this.dataProtection.anonymizeContact(contact.id, organizationId, reason);
      matched.push(`Contact:${contact.id}`);
    }
    const reservations = await this.reservations.find({ where: by('guestEmail', 'guestPhone') as never });
    for (const reservation of reservations) {
      await this.dataProtection.anonymizeReservation(reservation.id, organizationId, reason);
      matched.push(`Reservation:${reservation.id}`);
    }

    // Qué se buscó, dicho al titular. Una resolución que afirma más de lo que hizo es peor que
    // no tenerla: compromete el cumplimiento de un derecho sobre una búsqueda parcial.
    const criterios = phone ? 'el correo y el teléfono declarados' : 'el correo declarado';

    if (matched.length === 0) {
      // Sin coincidencias no se cierra. Puede que la persona haya entregado sus datos con otro
      // correo o teléfono, y marcarla resuelta afirmaría que no queda nada suyo sin haberlo
      // comprobado. Queda en revisión para que alguien la busque a mano.
      row.status = 'in_review';
      row.resolutionNote = `No se encontraron registros que coincidan con ${criterios}. `
        + 'Requiere revisión manual antes de responder: la persona puede haber entregado sus datos con otro contacto.';
      row.resolvedBy = null;
      row.resolvedAt = null;
    } else {
      row.status = 'resolved';
      row.resolutionNote = `Se anonimizaron ${matched.length} registros que coinciden con ${criterios}. `
        + 'Los registros asociados a otro correo o teléfono no quedan alcanzados por esta búsqueda.';
      row.resolvedBy = actor.id;
      row.resolvedAt = new Date();
    }
    const saved = await this.requests.save(row);
    await this.audit.log({
      organizationId,
      actorId: actor.id,
      entityType: 'ServiceRequest',
      entityId: id,
      action: 'anonymized',
      before: previous,
      after: { status: saved.status, resolutionNote: saved.resolutionNote, records: matched },
    });
    return saved;
  }
}
