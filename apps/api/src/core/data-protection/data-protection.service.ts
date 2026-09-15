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
import { documentoATexto, politicaDePrivacidadDeEspartanos } from '@espartanos/shared';

/** Fecha de hace `meses` meses calendario. */
function haceMeses(meses: number, ahora = new Date()): Date {
  const fecha = new Date(ahora);
  fecha.setMonth(fecha.getMonth() - meses);
  return fecha;
}

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
 * Aviso que rige mientras la organización no publique uno propio desde Configuración: la Política
 * de privacidad de Espartanos, completa y versionada en `@espartanos/shared`.
 */
function avisoDeEspartanos() {
  const politica = politicaDePrivacidadDeEspartanos();
  return { title: politica.titulo, text: documentoATexto(politica), documentVersion: politica.version };
}

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
   * Devuelve siempre un texto válido: la versión publicada por la organización o, si no hay,
   * la Política de privacidad de Espartanos. Esta última no se guarda como versión publicada de
   * la organización; queda con versión `0` y su propia versión de documento en el título del texto.
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
    const { title, text } = avisoDeEspartanos();
    return { versionId: null, version: 0, title, text, provisional: false };
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

  /**
   * Borra los identificadores de medición (cookies de Meta, IP y navegador) de las reservas creadas
   * hace más de `meses`, sin tocar el resto de la reserva.
   *
   * @returns Cuántas reservas se limpiaron.
   */
  async borrarIdentificadoresDeMedicionVencidos(meses: number): Promise<number> {
    const resultado = await this.reservationRepo.manager.query(
      'UPDATE reservations SET fbc = NULL, fbp = NULL, client_ip_address = NULL, client_user_agent = NULL WHERE created_at < ? AND (fbc IS NOT NULL OR fbp IS NOT NULL OR client_ip_address IS NOT NULL OR client_user_agent IS NOT NULL) LIMIT 2000',
      [haceMeses(meses)],
    ) as { affectedRows?: number };
    return resultado?.affectedRows ?? 0;
  }

  /**
   * Anonimiza las solicitudes de evento o grupo enviadas hace más de `meses`.
   *
   * Quedan el tamaño del grupo, la ocasión, las fechas, el estado y el origen: lo que sirve para
   * reportes sin identificar a nadie. Los textos de aceptación también quedan, como constancia.
   */
  async anonimizarSolicitudesDeGrupoVencidas(meses: number): Promise<number> {
    const resultado = await this.reservationRepo.manager.query(
      "UPDATE reservation_group_requests SET guest_name = CONCAT('Solicitante anonimizado ', LEFT(id, 8)), guest_email = NULL, guest_phone = NULL, notes = NULL, details = NULL, quote_message = NULL WHERE created_at < ? AND (guest_email IS NOT NULL OR guest_phone IS NOT NULL OR guest_name NOT LIKE 'Solicitante anonimizado%') LIMIT 2000",
      [haceMeses(meses)],
    ) as { affectedRows?: number };
    return resultado?.affectedRows ?? 0;
  }

  /**
   * Anonimiza las respuestas de encuestas enviadas hace más de `meses` que traen datos de contacto.
   *
   * Se borran nombre, correo, mensaje al equipo y las respuestas a preguntas de datos personales
   * (nombre, RUT, correo, teléfono, nacimiento) y a preguntas sensibles. Las notas y opiniones quedan para los resultados.
   */
  async anonimizarRespuestasDeEncuestaVencidas(meses: number): Promise<number> {
    const manager = this.reservationRepo.manager;
    const filas = await manager.query(
      'SELECT r.id, r.answers, s.questions FROM survey_responses r JOIN surveys s ON s.id = r.survey_id WHERE r.submitted_at < ? AND (r.respondent_name IS NOT NULL OR r.respondent_email IS NOT NULL OR r.team_message IS NOT NULL OR r.privacy_consent_at IS NOT NULL) LIMIT 500',
      [haceMeses(meses)],
    ) as Array<{ id: string; answers: unknown; questions: unknown }>;
    let anonimizadas = 0;
    for (const fila of filas) {
      try {
        const preguntas = (typeof fila.questions === 'string' ? JSON.parse(fila.questions) : fila.questions) as Array<{ id: string; dato?: string; sensible?: boolean }> | null;
        const respuestas = { ...((typeof fila.answers === 'string' ? JSON.parse(fila.answers) : fila.answers) as Record<string, unknown> ?? {}) };
        for (const pregunta of preguntas ?? []) if (pregunta.dato || pregunta.sensible) delete respuestas[pregunta.id];
        await manager.query(
          'UPDATE survey_responses SET respondent_name = NULL, respondent_email = NULL, team_message = NULL, answers = ?, privacy_consent_at = NULL WHERE id = ?',
          [JSON.stringify(respuestas), fila.id],
        );
        anonimizadas += 1;
      } catch {
        // Una respuesta dañada no detiene al resto del lote.
      }
    }
    return anonimizadas;
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
