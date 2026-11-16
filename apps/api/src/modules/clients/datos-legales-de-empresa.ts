import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { VERSION_DOCUMENTOS_LEGALES } from '@espartanos/shared';
import type { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import type { AuditService } from '../../core/audit/audit.service';
import type { AuthUser } from '../../shared/types/request';
import { createHash, randomUUID } from 'node:crypto';

/**
 * @fileoverview Datos legales de una empresa: responsable, RUT, correo para derechos y política.
 *
 * La empresa es la responsable de los datos de sus clientes, así que los maneja ella desde su
 * portal. Los usan Reservas y Encuestas, y cada módulo los expone bajo su propia ruta para que la
 * matriz de permisos siga gobernando quién entra: una empresa con sólo uno de los dos servicios
 * llega por el suyo. Cada cambio queda en auditoría porque cambia lo que acepta quien reserve o
 * responda desde ese momento.
 */

interface PreguntaPermisos {
  can(organizationId: string, userId: string, role: never, module: string, required: 'manage', clientId?: string): Promise<boolean>;
}

/**
 * Sólo quien administra la empresa guarda sus datos legales.
 *
 * Cualquier cuenta de la empresa podía cambiar la razón social, el RUT o el correo de privacidad,
 * y además **aceptar el encargo de tratamiento** en nombre de la empresa, que es una aceptación
 * legal. Bastaba con tener acceso de lectura a Encuestas. Leerlos lo sigue pudiendo cualquiera de
 * la empresa; guardarlos, quien la administra —el mismo permiso con que reparte su equipo—.
 *
 * El equipo de Espartanos no pasa por aquí: su acceso se comprueba por empresa en cada ruta.
 */
export async function asegurarQueAdministraLaEmpresa(
  permisos: PreguntaPermisos,
  organizationId: string,
  user: { id: string; role: string },
  clientId: string,
): Promise<void> {
  if (user.role !== 'client') return;
  const administra = await permisos.can(organizationId, user.id, user.role as never, 'users', 'manage', clientId);
  if (!administra) throw new ForbiddenException('Los datos legales de la empresa los mantiene quien la administra. Pídeselo a esa persona.');
}

export class CompanyLegalDto {
  @IsOptional() @IsString() @MaxLength(255) legalName?: string | null;
  @IsOptional() @IsString() @MaxLength(30) taxId?: string | null;
  @IsOptional() @IsEmail() @MaxLength(190) privacyEmail?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) privacyUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) termsUrl?: string | null;
  @IsOptional() @IsIn(['enlace', 'texto']) legalMode?: string;
  @IsOptional() @IsString() @MaxLength(30000) privacyText?: string | null;
  @IsOptional() @IsString() @MaxLength(30000) termsText?: string | null;
  /** Acepta la versión vigente del contrato de encargo. Se registra quién y cuándo; no se puede desmarcar. */
  @IsOptional() @IsBoolean() aceptaEncargo?: boolean;
  /** Explica la modificación en el historial; no forma parte del documento público. */
  @IsOptional() @IsString() @MaxLength(500) changeSummary?: string;
  /** `false` conserva un borrador versionado sin cambiar lo que ven Reservas y Encuestas. */
  @IsOptional() @IsBoolean() publish?: boolean;
}

export class CompanyLegalScopeDto {
  @IsOptional() @IsUUID() clientId?: string;
}

type Consultable = Pick<DataSource, 'query'> | Pick<EntityManager, 'query'>;

export async function leerDatosLegales(db: Consultable, organizationId: string, clientId: string) {
  const filas = await db.query('SELECT legal_name, tax_id, privacy_email, privacy_url, terms_url, legal_mode, privacy_text, terms_text, encargo_version, encargo_accepted_at, encargo_accepted_name FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]) as Array<Record<string, string | Date | null>>;
  const fila = filas?.[0] as Record<string, string | null> | undefined;
  if (!fila) throw new NotFoundException('Empresa no encontrada');
  const aceptadoEn = fila.encargo_accepted_at ? new Date(fila.encargo_accepted_at).toISOString() : null;
  return {
    legalName: fila.legal_name, taxId: fila.tax_id, privacyEmail: fila.privacy_email, privacyUrl: fila.privacy_url, termsUrl: fila.terms_url, legalMode: fila.legal_mode === 'texto' ? 'texto' : 'enlace', privacyText: fila.privacy_text, termsText: fila.terms_text,
    encargo: { version: fila.encargo_version ?? null, aceptadoEn, aceptadoPor: fila.encargo_accepted_name ?? null, vigente: fila.encargo_version === VERSION_DOCUMENTOS_LEGALES, versionVigente: VERSION_DOCUMENTOS_LEGALES },
  };
}

/** Historial legal legible, compuesto sólo desde registros inmutables. */
export async function leerHistorialLegal(db: Consultable, organizationId: string, clientId: string) {
  const [versions, acceptances, activations] = await Promise.all([
    db.query('SELECT id, document_type AS documentType, version_number AS versionNumber, status, content, content_hash AS contentHash, change_summary AS changeSummary, created_by AS actorId, created_at AS createdAt, effective_from AS effectiveFrom FROM legal_document_versions WHERE organization_id = ? AND client_id = ? ORDER BY created_at DESC LIMIT 100', [organizationId, clientId]),
    db.query('SELECT id, document_type AS documentType, document_version AS documentVersion, actor_id AS actorId, actor_name AS actorName, accepted_at AS acceptedAt FROM legal_acceptance_events WHERE organization_id = ? AND client_id = ? ORDER BY accepted_at DESC LIMIT 50', [organizationId, clientId]),
    db.query('SELECT id, action, actor_id AS actorId, reason, created_at AS createdAt FROM legal_activation_events WHERE organization_id = ? AND client_id = ? ORDER BY created_at DESC LIMIT 50', [organizationId, clientId]),
  ]);
  return { versions, acceptances, activations };
}

export interface ContextoDeCambioLegal {
  actorName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const hashDe = (content: unknown) => createHash('sha256').update(JSON.stringify(content)).digest('hex');

export async function guardarDatosLegales(
  db: DataSource,
  audit: AuditService,
  organizationId: string,
  clientId: string,
  dto: CompanyLegalDto,
  actorId: string,
  actorNameOrContext?: string | null | ContextoDeCambioLegal,
) {
  const context: ContextoDeCambioLegal = typeof actorNameOrContext === 'object'
    ? actorNameOrContext ?? {}
    : { actorName: actorNameOrContext };
  const limpio = (valor: string | null | undefined) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);

  const ejecutar = async (manager: Consultable, transaccional: boolean) => {
    const antes = await leerDatosLegales(manager, organizationId, clientId);
    // Los campos omitidos se conservan. Un vacío explícito sí limpia el campo.
    const valor = (campo: keyof CompanyLegalDto, actual: string | null, normalizar = true) => dto[campo] === undefined
      ? actual
      : normalizar ? limpio(dto[campo] as string | null) : dto[campo];
    const despues = {
      legalName: valor('legalName', antes.legalName), taxId: valor('taxId', antes.taxId), privacyEmail: valor('privacyEmail', antes.privacyEmail),
      privacyUrl: valor('privacyUrl', antes.privacyUrl), termsUrl: valor('termsUrl', antes.termsUrl),
      legalMode: dto.legalMode === undefined ? antes.legalMode : dto.legalMode === 'texto' ? 'texto' : 'enlace',
      privacyText: valor('privacyText', antes.privacyText), termsText: valor('termsText', antes.termsText),
    };
    const publicar = dto.publish !== false;
    if (publicar) await manager.query(
      'UPDATE clients SET legal_name = ?, tax_id = ?, privacy_email = ?, privacy_url = ?, terms_url = ?, legal_mode = ?, privacy_text = ?, terms_text = ? WHERE id = ? AND organization_id = ?',
      [despues.legalName, despues.taxId, despues.privacyEmail, despues.privacyUrl, despues.termsUrl, despues.legalMode, despues.privacyText, despues.termsText, clientId, organizationId],
    );

    if (transaccional) {
      const documentos = [
        { type: 'identity', before: { legalName: antes.legalName, taxId: antes.taxId, privacyEmail: antes.privacyEmail }, after: { legalName: despues.legalName, taxId: despues.taxId, privacyEmail: despues.privacyEmail } },
        { type: 'privacy', before: { mode: antes.legalMode, url: antes.privacyUrl, text: antes.privacyText }, after: { mode: despues.legalMode, url: despues.privacyUrl, text: despues.privacyText } },
        { type: 'terms', before: { mode: antes.legalMode, url: antes.termsUrl, text: antes.termsText }, after: { mode: despues.legalMode, url: despues.termsUrl, text: despues.termsText } },
      ];
      for (const documento of documentos) {
        if (hashDe(documento.before) === hashDe(documento.after)) continue;
        const versiones = await manager.query('SELECT COALESCE(MAX(version_number), 0) AS version FROM legal_document_versions WHERE organization_id = ? AND client_id = ? AND document_type = ?', [organizationId, clientId, documento.type]) as Array<{ version: number | string }>;
        const version = Number(versiones[0]?.version ?? 0) + 1;
        if (publicar) await manager.query("UPDATE legal_document_versions SET status = 'replaced' WHERE organization_id = ? AND client_id = ? AND document_type = ? AND status = 'published'", [organizationId, clientId, documento.type]);
        await manager.query(
          'INSERT INTO legal_document_versions (id, organization_id, client_id, document_type, version_number, status, content, content_hash, change_summary, created_by, created_at, effective_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [randomUUID(), organizationId, clientId, documento.type, version, publicar ? 'published' : 'draft', JSON.stringify(documento.after), hashDe(documento.after), limpio(dto.changeSummary), actorId, new Date(), new Date()],
        );
      }
    }

    const auditParams = { organizationId, actorId, entityType: 'ClientLegalData', entityId: clientId, action: publicar ? 'published' : 'draft_saved', before: antes as never, after: despues as never, reason: limpio(dto.changeSummary) ?? undefined, ipAddress: context.ipAddress ?? undefined };
    if (transaccional) await audit.log(auditParams, manager as EntityManager);
    else await audit.log(auditParams);
    if (publicar && dto.aceptaEncargo === true && !antes.encargo.vigente) {
      const ahora = new Date();
      await manager.query(
        'UPDATE clients SET encargo_version = ?, encargo_accepted_at = ?, encargo_accepted_by = ?, encargo_accepted_name = ? WHERE id = ? AND organization_id = ?',
        [VERSION_DOCUMENTOS_LEGALES, ahora, actorId, context.actorName?.slice(0, 180) ?? null, clientId, organizationId],
      );
      if (transaccional) await manager.query(
        'INSERT INTO legal_acceptance_events (id, organization_id, client_id, document_type, document_version, document_hash, actor_id, actor_name, ip_address, user_agent, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), organizationId, clientId, 'data_processing_agreement', VERSION_DOCUMENTOS_LEGALES, hashDe({ version: VERSION_DOCUMENTOS_LEGALES }), actorId, context.actorName?.slice(0, 180) ?? null, context.ipAddress ?? null, context.userAgent?.slice(0, 500) ?? null, ahora],
      );
      const acceptanceAudit = { organizationId, actorId, entityType: 'ClientDataProcessingAgreement', entityId: clientId, action: 'accepted', after: { version: VERSION_DOCUMENTOS_LEGALES } as never, ipAddress: context.ipAddress ?? undefined };
      if (transaccional) await audit.log(acceptanceAudit, manager as EntityManager);
      else await audit.log(acceptanceAudit);
    }
    return leerDatosLegales(manager, organizationId, clientId);
  };

  // Los dobles de prueba antiguos sólo implementan query; producción siempre usa la transacción.
  if (typeof (db as DataSource).transaction !== 'function') return ejecutar(db, false);
  return db.transaction((manager) => ejecutar(manager, true));
}

/** La cuenta del portal sin empresa no puede tocar datos legales. */
export function empresaDelPortal(clientId: string | null | undefined): string {
  if (!clientId) throw new ForbiddenException('La cuenta no pertenece a una empresa');
  return clientId;
}

/** Lo que hace falta del alcance de la cuenta, sin arrastrar el servicio entero. */
export interface AlcanceParaDatosLegales {
  allowedClientIds: (organizationId: string, user: AuthUser) => Promise<string[] | undefined>;
  assertClient: (organizationId: string, user: AuthUser, clientId: string) => Promise<void>;
}

/**
 * De qué empresa son los datos legales que se están leyendo o guardando.
 *
 * Reservas y Encuestas exponen estos datos bajo rutas propias y resolvían la empresa cada una por
 * su cuenta, con el mismo criterio: una cuenta de portal usaba **siempre** la empresa de su
 * sesión. Con un solo local acertaba; con dos, una cuenta que atiende Centro y Providencia
 * declaraba Providencia y escribía en Centro —incluida la **aceptación del contrato de encargo**,
 * que es la constancia legal de quién aceptó qué y por qué empresa—. Resolverlo aquí, una vez, es
 * lo que impide que los dos módulos vuelvan a separarse.
 *
 * Una empresa declarada se honra para los dos papeles, portal incluido, siempre que la cuenta la
 * alcance; declarar una que no se alcanza da 404, el mismo que si no existiera. Sin declarar nada,
 * la cuenta de portal usa la suya y el equipo interno recibe un 400: elegir por él sería escribir
 * datos legales en una empresa que nadie nombró.
 *
 * Nombrar la empresa no concede nada: quien llama sigue comprobando a continuación que tenga el
 * servicio contratado y que quien actúa la administre.
 */
export async function empresaDeLosDatosLegales(
  alcance: AlcanceParaDatosLegales,
  organizationId: string,
  user: AuthUser,
  pedida?: string,
): Promise<string> {
  const declarada = pedida?.trim();
  if (declarada) {
    await alcance.assertClient(organizationId, user, declarada);
    return declarada;
  }
  if (user.role === 'client') return empresaDelPortal(user.clientId);
  throw new BadRequestException('Indica la empresa');
}
