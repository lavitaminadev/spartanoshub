import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadIntakeService } from '../lead-intake.service';
import { Lead } from '../lead.entity';
import { normalizePhone } from '../../../../shared/phone';
import type { ImportLeadsDto } from '../dto/import-leads.dto';
import { validateImportRow } from '../import-lead-row.validation';

/** Qué pasó con cada fila del archivo. */
export interface ImportLeadsResult {
  imported: number;
  duplicates: number;
  failed: Array<{ row: number; name: string; reason: string }>;
}

/**
 * Alta masiva de prospectos desde un archivo.
 *
 * Se apoya en `LeadIntakeService` y no escribe por su cuenta: ahí viven la normalización del
 * teléfono, la deduplicación por correo e identificador y el registro de la interacción de
 * captura. Importar por un camino propio habría duplicado esas reglas, y con el tiempo las dos
 * copias habrían dejado de coincidir.
 *
 * **Una fila mala no detiene el archivo.** Un correo mal escrito en la fila 40 no puede impedir
 * que entren las otras 499: se anota, se sigue, y al final se devuelve el detalle de lo que no
 * pasó para poder corregirlo y volver a subir solo eso.
 */
@Injectable()
export class ImportLeadsUseCase {
  private readonly logger = new Logger(ImportLeadsUseCase.name);

  constructor(
    private readonly intake: LeadIntakeService,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
  ) {}

  async execute(organizationId: string, dto: ImportLeadsDto): Promise<ImportLeadsResult> {
    const result: ImportLeadsResult = { imported: 0, duplicates: 0, failed: [] };

    for (const [index, raw] of dto.rows.entries()) {
      // Número de fila tal como se ve en la planilla: la primera es el encabezado.
      const rowNumber = index + 2;

      // El contenido se comprueba acá y no en la validación del cuerpo. Exigirlo en el DTO
      // rechaza la petición completa con 400, y entonces un archivo de trescientas filas no
      // entra por dos correos mal escritos: lo contrario de lo que promete esta importación.
      const check = validateImportRow(raw);
      if (!check.ok) {
        result.failed.push({ row: rowNumber, name: raw.name?.trim() || '', reason: check.reason });
        continue;
      }
      const row = check.row;

      try {
        // Solo para informar el resultado: la deduplicación de verdad la hace `captureLead`.
        // Acá se consulta para poder decir cuántas filas eran gente que ya estaba, en vez de
        // reportar como altas nuevas lo que en realidad fueron actualizaciones.
        const yaExistia = await this.findExisting(organizationId, row.email, row.phone, dto.clientId);

        await this.intake.captureLead({
          organizationId,
          // El embudo y la cuenta mandan sobre cualquier cosa que traiga el archivo: los elige
          // quien importa en la pantalla, y son lo que decide en qué CRM aparecen y para qué
          // equipo son visibles.
          domain: dto.domain ?? 'commercial',
          clientId: dto.clientId,
          name: row.name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          // El teléfono alternativo se anexa a las notas y no se descarta: no hay columna para
          // él, y perderlo significa perder la única forma de contactar a quien puso ahí su
          // número real. Queda a la vista para moverlo a mano si hace falta.
          notes: [row.notes, row.altPhone ? `Teléfono alternativo: ${row.altPhone}` : null]
            .filter(Boolean).join('\n') || undefined,
          // Lo de la fila manda sobre lo del archivo: una planilla mixta entra con el origen y el
          // canal que traiga cada lead, en vez de marcada toda igual.
          source: row.source || dto.source,
          sourceDetail: row.sourceDetail || dto.sourceDetail,
          campaignName: row.campaignName,
          // Se separan por coma o punto y coma porque las dos formas aparecen según qué sistema
          // exportó el archivo.
          tags: row.tags?.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
          sourceCreatedAt: row.sourceCreatedAt,
        }, 'upsert');

        if (yaExistia) result.duplicates += 1;
        else result.imported += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Error desconocido';
        result.failed.push({ row: rowNumber, name: row.name, reason });
        this.logger.warn(`Fila ${rowNumber} de la importación no se pudo guardar: ${reason}`);
      }
    }

    return result;
  }

  /**
   * Si ya hay un prospecto con ese correo o teléfono.
   *
   * El teléfono se normaliza igual que al guardarlo; comparar el texto crudo del archivo contra
   * el valor normalizado en base habría dado siempre «no existe», y cada reimportación del mismo
   * archivo se habría reportado como altas nuevas.
   *
   * La cuenta acota la búsqueda igual que en `captureLead`. Sin acotarla, la misma persona
   * presente en dos cuentas distintas se contaba como repetida al importarla para la segunda,
   * mientras la escritura la daba de alta: el resumen decía «ya existía» y el lead era nuevo.
   */
  private async findExisting(organizationId: string, email?: string, phone?: string, clientId?: string): Promise<boolean> {
    const where: Array<Record<string, unknown>> = [];
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const scope = clientId ? { organizationId, clientId } : { organizationId };

    if (normalizedEmail) where.push({ ...scope, email: normalizedEmail });
    if (normalizedPhone) where.push({ ...scope, phone: normalizedPhone });
    if (!where.length) return false;

    return (await this.leads.count({ where })) > 0;
  }
}
