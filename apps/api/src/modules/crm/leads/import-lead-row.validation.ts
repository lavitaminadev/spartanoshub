import type { ImportLeadRowDto } from './dto/import-leads.dto';

/** Largo máximo de cada campo, igual al de la columna en base. */
const MAX_LENGTH = {
  name: 255, email: 255, phone: 50, company: 255, notes: 65535,
  source: 50, sourceDetail: 255, campaignName: 180, altPhone: 50, tags: 500,
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[\d+\-\s()]+$/;

/** Nombre legible de cada campo, para que el motivo del rechazo se entienda sin abrir el código. */
const FIELD_LABEL: Record<keyof typeof MAX_LENGTH, string> = {
  name: 'El nombre', email: 'El correo', phone: 'El teléfono', company: 'La empresa',
  notes: 'Las notas', source: 'El origen', sourceDetail: 'El canal de contacto',
  campaignName: 'La campaña', altPhone: 'El teléfono alternativo', tags: 'Las etiquetas',
};

/** Fila lista para guardar: los textos ya vienen recortados y los vacíos convertidos en ausencia. */
export type NormalizedImportRow = Omit<ImportLeadRowDto, 'sourceCreatedAt'> & { sourceCreatedAt?: Date };

export type ImportRowCheck =
  | { ok: true; row: NormalizedImportRow }
  | { ok: false; reason: string };

/**
 * Comprueba y normaliza una fila del archivo antes de guardarla.
 *
 * Devuelve el motivo en vez de lanzar: quien importa necesita ver en una lista qué filas no
 * entraron y por qué, para corregir esas y volver a subir solo esas. Una excepción por fila
 * obligaría a envolver cada llamada y no aportaría nada que el motivo no diga ya.
 *
 * Se exige correo o teléfono porque son las dos claves con las que se reconoce a una persona;
 * sin ninguna de las dos, cada reimportación del mismo archivo crearía prospectos nuevos.
 *
 * @param raw - Fila tal como llegó del navegador, ya mapeada a campos del prospecto.
 * @returns La fila normalizada, o el motivo por el que no se puede guardar.
 */
export function validateImportRow(raw: ImportLeadRowDto): ImportRowCheck {
  const text = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  const row: NormalizedImportRow = {
    name: text(raw.name) ?? '',
    email: text(raw.email)?.toLowerCase(),
    phone: text(raw.phone),
    company: text(raw.company),
    notes: text(raw.notes),
    source: text(raw.source),
    sourceDetail: text(raw.sourceDetail),
    campaignName: text(raw.campaignName),
    altPhone: text(raw.altPhone),
    tags: text(raw.tags),
  };

  if (row.name.length < 2) return { ok: false, reason: 'El nombre debe tener al menos 2 caracteres' };

  for (const [field, limit] of Object.entries(MAX_LENGTH) as Array<[keyof typeof MAX_LENGTH, number]>) {
    const value = row[field];
    if (typeof value === 'string' && value.length > limit) {
      return { ok: false, reason: `${FIELD_LABEL[field]} supera los ${limit} caracteres` };
    }
  }

  if (row.email && !EMAIL.test(row.email)) return { ok: false, reason: `Correo con formato inválido: ${row.email}` };
  if (row.phone && !PHONE.test(row.phone)) {
    return { ok: false, reason: 'El teléfono solo admite números, espacios, paréntesis, + y -' };
  }
  if (row.altPhone && !PHONE.test(row.altPhone)) {
    return { ok: false, reason: 'El teléfono alternativo solo admite números, espacios, paréntesis, + y -' };
  }

  if (!row.email && !row.phone) {
    return { ok: false, reason: 'Sin correo ni teléfono: no hay forma de reconocer a la persona' };
  }

  const rawDate = text(raw.sourceCreatedAt);
  if (rawDate) {
    const parsed = new Date(rawDate);
    // Una fecha ilegible no puede convertirse en «hoy» en silencio: eso es exactamente el pico
    // falso en el gráfico por día que la columna existe para evitar.
    if (Number.isNaN(parsed.getTime())) return { ok: false, reason: `Fecha de origen ilegible: ${rawDate}` };
    row.sourceCreatedAt = parsed;
  }

  return { ok: true, row };
}
