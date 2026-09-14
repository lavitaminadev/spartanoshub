import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import type { DataSource } from 'typeorm';
import type { AuditService } from '../../core/audit/audit.service';

/**
 * @fileoverview Datos legales de una empresa: responsable, RUT, correo para derechos y política.
 *
 * La empresa es la responsable de los datos de sus clientes, así que los maneja ella desde su
 * portal. Los usan Reservas y Encuestas, y cada módulo los expone bajo su propia ruta para que la
 * matriz de permisos siga gobernando quién entra: una empresa con sólo uno de los dos servicios
 * llega por el suyo. Cada cambio queda en auditoría porque cambia lo que acepta quien reserve o
 * responda desde ese momento.
 */

export class CompanyLegalDto {
  @IsOptional() @IsString() @MaxLength(255) legalName?: string | null;
  @IsOptional() @IsString() @MaxLength(30) taxId?: string | null;
  @IsOptional() @IsEmail() @MaxLength(190) privacyEmail?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) privacyUrl?: string | null;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) termsUrl?: string | null;
  @IsOptional() @IsIn(['enlace', 'texto']) legalMode?: string;
  @IsOptional() @IsString() @MaxLength(30000) privacyText?: string | null;
  @IsOptional() @IsString() @MaxLength(30000) termsText?: string | null;
}

export class CompanyLegalScopeDto {
  @IsOptional() @IsUUID() clientId?: string;
}

export async function leerDatosLegales(db: DataSource, organizationId: string, clientId: string) {
  const filas = await db.query('SELECT legal_name, tax_id, privacy_email, privacy_url, terms_url, legal_mode, privacy_text, terms_text FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]) as Array<Record<string, string | null>>;
  const fila = filas?.[0];
  if (!fila) throw new NotFoundException('Empresa no encontrada');
  return { legalName: fila.legal_name, taxId: fila.tax_id, privacyEmail: fila.privacy_email, privacyUrl: fila.privacy_url, termsUrl: fila.terms_url, legalMode: fila.legal_mode === 'texto' ? 'texto' : 'enlace', privacyText: fila.privacy_text, termsText: fila.terms_text };
}

export async function guardarDatosLegales(db: DataSource, audit: AuditService, organizationId: string, clientId: string, dto: CompanyLegalDto, actorId: string) {
  const antes = await leerDatosLegales(db, organizationId, clientId);
  const limpio = (valor: string | null | undefined) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);
  await db.query(
    'UPDATE clients SET legal_name = ?, tax_id = ?, privacy_email = ?, privacy_url = ?, terms_url = ?, legal_mode = ?, privacy_text = ?, terms_text = ? WHERE id = ? AND organization_id = ?',
    [limpio(dto.legalName), limpio(dto.taxId), limpio(dto.privacyEmail), limpio(dto.privacyUrl), limpio(dto.termsUrl), dto.legalMode === 'texto' ? 'texto' : 'enlace', limpio(dto.privacyText), limpio(dto.termsText), clientId, organizationId],
  );
  await audit.log({ organizationId, actorId, entityType: 'ClientLegalData', entityId: clientId, action: 'updated', before: antes as never, after: dto as never });
  return leerDatosLegales(db, organizationId, clientId);
}

/** La cuenta del portal sin empresa no puede tocar datos legales. */
export function empresaDelPortal(clientId: string | null | undefined): string {
  if (!clientId) throw new ForbiddenException('La cuenta no pertenece a una empresa');
  return clientId;
}
