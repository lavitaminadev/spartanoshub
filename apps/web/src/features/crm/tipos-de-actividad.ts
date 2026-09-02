/**
 * Qué tipos de actividad hay y cómo se llaman, en un solo sitio.
 *
 * Estaban escritos por separado en el calendario y en la ficha, y `meeting` acabó llamándose
 * «Visita» en uno y «Reunión» en el otro. Peor: el calendario ofrecía «Visita» en su desplegable
 * y luego dibujaba «Reunión» en la agenda, con lo que parecía que se había guardado otra cosa.
 */

/** Clave interna → cómo se lee. Las claves son las que guarda el servidor y no se renombran. */
export const TIPO_DE_ACTIVIDAD: Record<string, string> = {
  meeting: 'Reunión',
  visit: 'Visita',
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Correo',
  note: 'Nota',
  task: 'Tarea',
  lead_ingested: 'Lead recibido',
};

/**
 * Los que se pueden agendar, en el orden en que se ofrecen.
 *
 * «Tarea» no está: se crea desde la ficha con su vencimiento, y ofrecerla también acá daría dos
 * caminos para lo mismo que guardan en tablas distintas.
 */
export const TIPOS_AGENDABLES: Array<{ value: string; label: string }> = [
  { value: 'meeting', label: TIPO_DE_ACTIVIDAD.meeting },
  { value: 'visit', label: TIPO_DE_ACTIVIDAD.visit },
  { value: 'call', label: TIPO_DE_ACTIVIDAD.call },
  { value: 'whatsapp', label: TIPO_DE_ACTIVIDAD.whatsapp },
  { value: 'email', label: TIPO_DE_ACTIVIDAD.email },
  { value: 'note', label: TIPO_DE_ACTIVIDAD.note },
];

/**
 * Por dónde ocurre una reunión.
 *
 * Lista corta y cerrada porque su valor decide qué se pide después y qué se pone en el
 * recordatorio: para las tres primeras hace falta un enlace, para la presencial una dirección y
 * para la telefónica nada.
 */
export const MEDIOS: Array<{ value: string; label: string; pide: 'enlace' | 'direccion' | null }> = [
  { value: 'meet', label: 'Google Meet', pide: 'enlace' },
  { value: 'zoom', label: 'Zoom', pide: 'enlace' },
  { value: 'teams', label: 'Microsoft Teams', pide: 'enlace' },
  { value: 'presencial', label: 'Presencial', pide: 'direccion' },
  { value: 'telefono', label: 'Telefónica', pide: null },
];

/** Cómo se lee un medio guardado, o el valor mismo si llegara uno que no está en la lista. */
export function rotuloDeMedio(valor?: string | null): string {
  if (!valor) return '';
  return MEDIOS.find((medio) => medio.value === valor)?.label ?? valor;
}

/**
 * Qué campo adicional corresponde a un medio.
 *
 * @returns `null` cuando ese medio no necesita nada más, o cuando no hay medio elegido.
 */
export function campoDelMedio(valor?: string | null): { etiqueta: string; ejemplo: string } | null {
  const medio = MEDIOS.find((opcion) => opcion.value === valor);
  if (!medio?.pide) return null;
  return medio.pide === 'enlace'
    ? { etiqueta: 'Enlace de la reunión', ejemplo: 'https://meet.google.com/abc-defg-hij' }
    : { etiqueta: 'Dirección', ejemplo: 'Av. Providencia 1234, oficina 502' };
}

/**
 * Los tipos que admiten medio.
 *
 * Una llamada ya dice por dónde ocurre y una nota no ocurre en ninguna parte: ofrecerles el campo
 * sería pedir un dato que no significa nada.
 */
export function admiteMedio(tipo?: string | null): boolean {
  return tipo === 'meeting' || tipo === 'visit';
}
