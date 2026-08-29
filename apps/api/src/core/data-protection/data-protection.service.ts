import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { User } from '../../modules/users/user.entity';
import { AuditLog } from '../audit/audit.entity';
import { DataConsent } from './consent.entity';
import { Lead } from '../../modules/crm/leads/lead.entity';
import { Contact } from '../../modules/crm/contacts/contact.entity';
import { Reservation } from '../../modules/reservations/domain/reservation.entity';
import { ServiceRequest } from '../../modules/service-requests/service-request.entity';
import { ConsentVersion } from './consent-version.entity';

/** Aviso de privacidad que se muestra donde se pide un consentimiento. */
export interface AvisoPrivacidad {
  /** Identificador de la versión publicada, o `null` si el texto es provisional. */
  versionId: string | null;
  /** Correlativo de la versión. `0` significa que nadie ha publicado todavía. */
  version: number;
  title: string;
  text: string;
  provisional: boolean;
}

/**
 * Texto de reemplazo mientras la agencia no publique el suyo.
 *
 * **No es un aviso de privacidad válido y no pretende serlo.** Describe en términos generales
 * qué se hace con los datos para que el formulario no pida aceptar en blanco, y dice
 * explícitamente que es provisional para que nadie lo confunda con el definitivo.
 *
 * Se publica el real desde Configuración; al hacerlo, este deja de usarse solo.
 */
const AVISO_PROVISIONAL = {
  title: 'Aviso de privacidad (texto provisional)',
  text: [
    'Este es un texto provisional mientras la agencia publica su aviso de privacidad definitivo.',
    '',
    'Los datos que entregas —nombre, correo, y el RUT o teléfono cuando corresponda— se usan',
    'únicamente para gestionar, responder y dar seguimiento a tu solicitud, y para dejar',
    'registro de qué se pidió, quién lo resolvió y cuándo.',
    '',
    'No se utilizan para otros fines ni se comparten con terceros, salvo obligación legal.',
    '',
    'Puedes ejercer tus derechos de acceso, rectificación, anonimización, portabilidad y baja',
    'por este mismo canal, conforme a la Ley 19.628 y a la Ley 21.719 que la actualiza.',
  ].join('\n'),
};

@Injectable()
export class DataProtectionService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(DataConsent) private consentRepo: Repository<DataConsent>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Reservation) private reservationRepo: Repository<Reservation>,
    @InjectRepository(ServiceRequest) private serviceRequestRepo: Repository<ServiceRequest>,
    @InjectRepository(ConsentVersion) private consentVersionRepo: Repository<ConsentVersion>,
  ) {}

  /**
   * Aviso de privacidad vigente, para mostrarlo donde se pide un consentimiento.
   *
   * Devuelve siempre algo: si la organización todavía no publicó ninguna versión entrega un
   * texto **provisional** marcado como tal. Se prefiere eso a no mostrar nada porque un
   * formulario que pide aceptar sin decir qué es peor que uno con un texto genérico, y peor
   * aún es un literal escondido en el código, que cambia sin dejar rastro.
   *
   * El texto provisional no se guarda como versión publicada: nadie lo redactó ni lo aprobó, y
   * fabricar ese registro sería inventar una traza. Queda identificado con versión `0` para
   * que la pantalla lo advierta y para que las aceptaciones registradas bajo él se distingan
   * de las que aceptaron un texto real.
   */
  async avisoPrivacidadVigente(organizationId: string): Promise<AvisoPrivacidad> {
    const publicada = await this.consentVersionRepo.findOne({
      where: { organizationId, active: true },
      order: { version: 'DESC' },
    });
    if (publicada) {
      return {
        versionId: publicada.id,
        version: publicada.version,
        title: publicada.title,
        text: publicada.text,
        provisional: false,
      };
    }
    return { versionId: null, version: 0, ...AVISO_PROVISIONAL, provisional: true };
  }

  /**
   * Deja constancia de una anonimizacion en la bitacora.
   *
   * Anonimizar destruye el dato original de forma irreversible, asi que el rastro de que
   * ocurrio y por que es lo unico que queda para responder ante una auditoria.
   */
  private async recordAnonymization(organizationId: string, entityType: string, entityId: string, reason: string): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create({
      organizationId,
      action: 'anonymize',
      entityType,
      entityId,
      reason,
      occurredAt: new Date(),
    }));
  }

  async anonymizeUser(userId: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.update(userId, {
      name: 'Usuario Anónimo',
      email: `anon-${userId}@espartanos.local`,
      phone: null,
      avatarUrl: null,
      refreshToken: null,
      isActive: false,
    });

    await this.auditRepo.update({ actorId: userId }, { actorId: null });
    await this.recordAnonymization(user.organizationId, 'User', userId, 'Solicitud de anonimización');
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const consents = await this.consentRepo.findBy({ userId });
    const auditLogs = await this.auditRepo.findBy({ actorId: userId, organizationId: user.organizationId });

    return {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      consents: consents.map(c => ({ action: c.action, granted: c.granted, createdAt: c.createdAt })),
      auditLogs: auditLogs.map(a => ({ action: a.action, entityType: a.entityType, entityId: a.entityId, occurredAt: a.occurredAt })),
    };
  }

  async deleteUserData(userId: string): Promise<void> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    await this.anonymizeUser(userId);

    await this.consentRepo.delete({ userId });
  }

  async exportLeadData(leadId: string, organizationId: string): Promise<Record<string, unknown>> {
    const lead = await this.leadRepo.findOneBy({ id: leadId, organizationId });
    if (!lead) throw new NotFoundException('Lead not found');

    const auditLogs = await this.auditRepo.findBy({ organizationId, entityType: 'Lead', entityId: leadId });

    return {
      lead,
      auditLogs: auditLogs.map((log) => ({
        action: log.action,
        occurredAt: log.occurredAt,
        reason: log.reason,
      })),
    };
  }

  async anonymizeLead(leadId: string, organizationId: string, reason = 'Retención expirada'): Promise<Lead> {
    const lead = await this.leadRepo.findOneBy({ id: leadId, organizationId });
    if (!lead) throw new NotFoundException('Lead not found');

    const anonymizedName = `Lead anonimizado ${lead.id.slice(0, 8)}`;
    lead.name = anonymizedName;
    lead.email = null;
    lead.phone = null;
    lead.company = null;
    lead.sourceDetail = null;
    lead.campaignName = null;
    lead.notes = reason;
    lead.discardReason = reason;
    // Se conserva el resto de `metadata`: sobrescribirlo entero borraba trazas de origen
    // que no son datos personales y que la operacion sigue necesitando.
    lead.metadata = {
      ...(lead.metadata ?? {}),
      retentionAnonymizedAt: new Date().toISOString(),
      retentionReason: reason,
      previousFitStatus: lead.fitStatus,
    };

    const saved = await this.leadRepo.save(lead);
    await this.recordAnonymization(organizationId, 'Lead', leadId, reason);
    return saved;
  }

  /**
   * Anonimiza un contacto de campana: la persona que llego por la campana de un cliente.
   *
   * Se conservan estado, origen y cliente asociado, que son las metricas que sostienen el
   * reporte; se borra todo lo que permite identificar a la persona.
   */
  async anonymizeContact(contactId: string, organizationId: string, reason = 'Retención expirada'): Promise<Contact> {
    const contact = await this.contactRepo.findOneBy({ id: contactId, organizationId });
    if (!contact) throw new NotFoundException('Contact not found');

    contact.name = `Contacto anonimizado ${contact.id.slice(0, 8)}`;
    contact.email = null;
    contact.phone = null;

    const saved = await this.contactRepo.save(contact);
    await this.recordAnonymization(organizationId, 'Contact', contactId, reason);
    return saved;
  }

  /**
   * Anonimiza una reserva: los datos del comensal que capturo la pagina publica.
   *
   * Ademas del nombre y el contacto, se borran los identificadores de match de Meta
   * (`fbc`, `fbp`, IP y user agent) y las respuestas del formulario, que pueden contener
   * cualquier dato que el cliente haya decidido pedir. Fecha, estado y formulario quedan
   * intactos para que la analitica de asistencia siga siendo correcta.
   */
  async anonymizeReservation(reservationId: string, organizationId: string, reason = 'Retención expirada'): Promise<Reservation> {
    const reservation = await this.reservationRepo.findOneBy({ id: reservationId, organizationId });
    if (!reservation) throw new NotFoundException('Reservation not found');

    reservation.guestName = `Visitante anonimizado ${reservation.id.slice(0, 8)}`;
    reservation.guestEmail = null;
    reservation.guestPhone = null;
    reservation.answers = {};
    reservation.internalNotes = null;
    reservation.fbc = null;
    reservation.fbp = null;
    reservation.clientIpAddress = null;
    reservation.clientUserAgent = null;

    const saved = await this.reservationRepo.save(reservation);
    await this.recordAnonymization(organizationId, 'Reservation', reservationId, reason);
    return saved;
  }

  /**
   * Anonimiza las reservas cuya fecha ya paso hace mas de `retentionDays`.
   *
   * El corte se hace sobre `startsAt` y no sobre la creacion: lo que agota la finalidad del
   * dato es que la visita ya ocurrio. Se omiten las ya anonimizadas para que el trabajo sea
   * idempotente, y un fallo puntual no detiene al resto del lote.
   *
   * @returns Cuantas reservas se revisaron y cuantas se anonimizaron.
   */
  async anonymizeExpiredReservations(retentionDays: number, reason = 'Retención expirada'): Promise<{ reviewed: number; anonymized: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const expired = await this.reservationRepo.find({ where: { startsAt: LessThan(cutoff) } });

    let anonymized = 0;
    for (const reservation of expired) {
      if (reservation.guestEmail === null && reservation.guestPhone === null && reservation.guestName.startsWith('Visitante anonimizado')) continue;
      try {
        await this.anonymizeReservation(reservation.id, reservation.organizationId, reason);
        anonymized += 1;
      } catch {
        // Un fallo puntual (por ejemplo una restriccion) no debe frenar el resto del lote.
      }
    }
    return { reviewed: expired.length, anonymized };
  }

  async recordConsent(userId: string, action: string, granted: boolean, ipAddress?: string): Promise<DataConsent> {
    const consent = this.consentRepo.create({ userId, action, granted, ipAddress });
    return this.consentRepo.save(consent);
  }

  /**
   * Anonimiza una solicitud de servicio o de derechos.
   *
   * Es la que más datos personales guarda de todas: nombre, correo, **RUT**, teléfono y un
   * mensaje libre donde la persona puede haber escrito cualquier cosa. Y era la única que la
   * anonimización no cubría, de modo que alguien que ejercía su derecho de supresión quedaba
   * borrado del CRM y entero acá —justo en la tabla que existe para atender ese derecho—.
   *
   * El tipo, el estado y las fechas quedan intactos: son lo que prueba que la solicitud se
   * atendió y dentro de qué plazo, y borrarlos destruiría la constancia del cumplimiento en vez
   * de protegerlo.
   */
  async anonymizeServiceRequest(
    requestId: string,
    organizationId: string,
    reason = 'Retención expirada',
  ): Promise<ServiceRequest> {
    const solicitud = await this.serviceRequestRepo.findOneBy({ id: requestId, organizationId });
    if (!solicitud) throw new NotFoundException('Service request not found');

    solicitud.requesterName = `Solicitante anonimizado ${solicitud.id.slice(0, 8)}`;
    solicitud.requesterEmail = '';
    solicitud.requesterRut = null;
    solicitud.requesterPhone = null;
    solicitud.message = null;
    /*
     * `extra` y la nota de resolución también.
     *
     * Son campos libres: el primero guarda lo que trajera el formulario y el segundo lo que
     * escribió quien atendió, que suele repetir los datos de la persona para dejar constancia.
     * Dejarlos sería anonimizar las columnas con nombre y olvidar las que de verdad acumulan.
     */
    solicitud.extra = null;
    solicitud.resolutionNote = null;

    const guardada = await this.serviceRequestRepo.save(solicitud);
    await this.recordAnonymization(organizationId, 'ServiceRequest', requestId, reason);
    return guardada;
  }
}
