import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadIntakeService } from '../lead-intake.service';
import { Lead } from '../lead.entity';
import { normalizePhone } from '../../../../shared/phone';
import type { ImportLeadsDto } from '../dto/import-leads.dto';

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

    for (const [index, row] of dto.rows.entries()) {
      // Número de fila tal como se ve en la planilla: la primera es el encabezado.
      const rowNumber = index + 2;

      if (!row.email && !row.phone) {
        result.failed.push({ row: rowNumber, name: row.name, reason: 'Sin correo ni teléfono: no hay forma de reconocer a la persona' });
        continue;
      }

      try {
        // Solo para informar el resultado: la deduplicación de verdad la hace `captureLead`.
        // Acá se consulta para poder decir cuántas filas eran gente que ya estaba, en vez de
        // reportar como altas nuevas lo que en realidad fueron actualizaciones.
        const yaExistia = await this.findExisting(organizationId, row.email, row.phone);

        await this.intake.captureLead({
          organizationId,
          domain: 'commercial',
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
          sourceCreatedAt: row.sourceCreatedAt ? new Date(row.sourceCreatedAt) : undefined,
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
   */
  private async findExisting(organizationId: string, email?: string, phone?: string): Promise<boolean> {
    const where: Array<Record<string, unknown>> = [];
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);

    if (normalizedEmail) where.push({ organizationId, email: normalizedEmail });
    if (normalizedPhone) where.push({ organizationId, phone: normalizedPhone });
    if (!where.length) return false;

    return (await this.leads.count({ where })) > 0;
  }
}
