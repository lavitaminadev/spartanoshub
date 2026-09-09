import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parse } from 'papaparse';
import { ReservationsService } from './reservations.service';
import { CreateManualReservationDto } from '../dto/reservation.dto';
import { tryLocalToUtc } from '../domain/timezone';

/**
 * Importación masiva de reservas desde CSV.
 *
 * Restricción de plataforma: en iHosting no hay worker persistente ni cola en
 * memoria, así que la importación se procesa dentro del request. Por eso hay
 * un tope de filas por archivo: un lote grande agotaría el tiempo de Passenger
 * y dejaría la importación a medias sin forma de reanudarla.
 *
 * Cada fila se valida y se crea reutilizando `ReservationsService.createManual`,
 * que ya resuelve disponibilidad, capacidad y transacción. Así una importación
 * no puede saltarse reglas que sí aplican al alta manual.
 */

/**
 * Tope por archivo, para no exceder el tiempo de request de Passenger.
 *
 * Cada fila abre su propia transaccion, toma el bloqueo del dia y consulta disponibilidad, y
 * todas corren en serie dentro de la peticion. Un archivo que agote el tiempo deja la carga a
 * medias y sin forma de reanudarla, asi que el tope se fija con margen sobre ese limite.
 */
export const MAX_IMPORT_ROWS = 200;

/**
 * Cabeceras aceptadas, tolerando acentos y mayúsculas.
 *
 * Incluye los nombres canónicos apuntando a sí mismos porque papaparse aplica
 * `transformHeader` más de una vez: sin esas entradas, la segunda pasada no
 * encontraría 'guestname' en el mapa y caería al fallback en minúsculas,
 * perdiendo el camelCase.
 */
const COLUMN_ALIASES: Record<string, string> = {
  guestname: 'guestName',
  guestemail: 'guestEmail',
  guestphone: 'guestPhone',
  startsat: 'startsAt',
  partysize: 'partySize',
  internalnotes: 'internalNotes',
  nombre: 'guestName',
  name: 'guestName',
  'nombre completo': 'guestName',
  email: 'guestEmail',
  correo: 'guestEmail',
  telefono: 'guestPhone',
  teléfono: 'guestPhone',
  phone: 'guestPhone',
  fecha: 'startsAt',
  'fecha y hora': 'startsAt',
  personas: 'partySize',
  'party size': 'partySize',
  notas: 'internalNotes',
  'notas internas': 'internalNotes',
};

export interface ParsedImportRow {
  /** Número de fila en el archivo, 1-indexado sin contar la cabecera. */
  rowNumber: number;
  data: Partial<CreateManualReservationDto>;
  errors: string[];
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  rows: ParsedImportRow[];
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

@Injectable()
export class ReservationsBulkImportService {
  private readonly logger = new Logger(ReservationsBulkImportService.name);

  constructor(private readonly reservations: ReservationsService) {}

  /**
   * Parsea y valida el CSV sin escribir nada. Es lo que alimenta la vista
   * previa antes de confirmar la importación.
   */
  parse(csvContent: string, formId: string, timeZone: string): ImportPreview {
    const parsed = parse<Record<string, string>>(csvContent.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => COLUMN_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header),
    });

    if (parsed.errors.length > 0) {
      const first = parsed.errors[0];
      throw new BadRequestException(`CSV inválido en la fila ${(first.row ?? 0) + 1}: ${first.message}`);
    }

    const records = parsed.data;
    if (records.length === 0) throw new BadRequestException('El archivo no tiene filas de datos');
    if (records.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`El archivo supera el máximo de ${MAX_IMPORT_ROWS} filas. Divídelo en partes.`);
    }

    const rows = records.map((record, index) => this.validateRow(record, index + 1, formId, timeZone));
    return {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.errors.length === 0).length,
      rows,
    };
  }

  private validateRow(record: Record<string, string>, rowNumber: number, formId: string, timeZone: string): ParsedImportRow {
    const errors: string[] = [];
    const guestName = (record.guestName ?? '').trim();
    const guestEmail = (record.guestEmail ?? '').trim();
    const guestPhone = (record.guestPhone ?? '').trim();
    const rawDate = (record.startsAt ?? '').trim();

    if (!guestName) errors.push('Falta el nombre');
    if (guestName.length > 180) errors.push('El nombre supera 180 caracteres');
    if (!guestEmail && !guestPhone) errors.push('Se requiere email o teléfono');
    if (guestEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) errors.push('Email inválido');

    // La celda describe la hora del local, no la del servidor ni UTC. `new Date` interpretaba
    // una fecha sola como medianoche UTC y una fecha con hora segun la zona del proceso.
    let startsAt: string | undefined;
    const cell = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(rawDate);
    if (!rawDate) {
      errors.push('Falta la fecha');
    } else if (!cell) {
      errors.push(`Fecha inválida: "${rawDate}". Usa el formato AAAA-MM-DD HH:MM`);
    } else if (!cell[4]) {
      errors.push(`Falta la hora en "${rawDate}". Usa el formato AAAA-MM-DD HH:MM`);
    } else if (cell[6]) {
      // La celda trae su propio desfase, asi que ya designa un instante exacto.
      startsAt = new Date(rawDate).toISOString();
    } else {
      const utc = tryLocalToUtc(`${cell[1]}-${cell[2]}-${cell[3]}`, `${cell[4]}:${cell[5]}`, timeZone);
      if (!utc) errors.push(`Esa hora no existe en la zona horaria del formulario: "${rawDate}"`);
      else startsAt = utc.toISOString();
    }

    let partySize: number | undefined;
    const rawPartySize = (record.partySize ?? '').trim();
    if (rawPartySize) {
      const value = Number(rawPartySize);
      if (!Number.isInteger(value) || value < 1 || value > 500) errors.push(`Cantidad de personas inválida: "${rawPartySize}"`);
      else partySize = value;
    }

    return {
      rowNumber,
      data: {
        formId,
        startsAt,
        guestName,
        guestEmail: guestEmail || undefined,
        guestPhone: guestPhone || undefined,
        partySize,
        internalNotes: (record.internalNotes ?? '').trim() || undefined,
      },
      errors,
    };
  }

  /**
   * Importa las filas válidas. Las inválidas se omiten y se reportan.
   *
   * `skipAvailability` permite cargar histórico que ya ocurrió, donde las
   * ventanas de disponibilidad actuales no aplican.
   */
  async import(
    organizationId: string,
    userId: string,
    csvContent: string,
    formId: string,
    options: { skipAvailability?: boolean; clientId?: string; clientIds?: string[] } = {},
  ): Promise<ImportResult> {
    const form = await this.reservations.getForm(organizationId, formId, options.clientId, options.clientIds);
    const preview = this.parse(csvContent, formId, form.timezone);
    const errors: Array<{ rowNumber: number; message: string }> = [];
    let imported = 0;

    for (const row of preview.rows) {
      if (row.errors.length > 0) {
        errors.push({ rowNumber: row.rowNumber, message: row.errors.join('; ') });
        continue;
      }
      try {
        await this.reservations.createManual(
          organizationId,
          userId,
          { ...row.data, skipAvailability: options.skipAvailability } as CreateManualReservationDto,
          options.clientId,
          options.clientIds,
          // Sin avisos: quien importa ya sabe lo que está cargando, y el resumen del propio
          // import le dice cuántas entraron.
          false,
        );
        imported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        errors.push({ rowNumber: row.rowNumber, message });
      }
    }

    this.logger.log(`Importación de reservas: ${imported} creadas, ${errors.length} con error (form ${formId})`);
    return { imported, failed: errors.length, errors };
  }
}
