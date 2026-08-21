/**
 * @fileoverview Fuente única de color para los estados del ciclo de reserva.
 *
 * El ciclo reservó → asistió / no asistió se muestra en tres superficies: la bandeja de
 * reservas, el CRM de contactos de campañas y las insignias genéricas. Las tres leen de
 * aquí para que un mismo estado tenga siempre el mismo color, sea cual sea la pantalla.
 */

/** Opción de estado seleccionable, con su identidad visual. */
export interface StatusOption {
  /** Valor interno persistido (p. ej. `no_show`). */
  value: string;
  /** Color de la familia del estado. */
  color: string;
  /** Glifo corto que acompaña al color, para no depender solo del tono. */
  icon: string;
  /** Etiqueta en español mostrada al usuario. */
  label: string;
}

/**
 * Colores del ciclo de reserva por estado.
 *
 * Verde = resultado bueno confirmado, teal = en curso, ámbar = requiere acción,
 * rojo = resultado negativo, gris = fuera del ciclo, violeta = en espera.
 */
export const CYCLE_COLORS = {
  new: '#1f6fb2',
  pending: '#9a5a00',
  confirmed: '#087e79',
  reserved: '#087e79',
  rescheduled: '#1f6fb2',
  waitlist: '#7040a0',
  attended: '#087e79',
  no_show: '#b5332d',
  cancelled: '#706a73',
  cancelled_client: '#706a73',
  cancelled_business: '#706a73',
} as const;

/** Estados que puede tomar una reserva en la bandeja del equipo. */
export const RESERVATION_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending', color: CYCLE_COLORS.pending, icon: '●', label: 'Pendiente' },
  { value: 'confirmed', color: CYCLE_COLORS.confirmed, icon: '●', label: 'Confirmada' },
  { value: 'rescheduled', color: CYCLE_COLORS.rescheduled, icon: '↻', label: 'Reagendada' },
  { value: 'waitlist', color: CYCLE_COLORS.waitlist, icon: '⏳', label: 'Lista de espera' },
  { value: 'attended', color: CYCLE_COLORS.attended, icon: '✓', label: 'Asistió' },
  { value: 'no_show', color: CYCLE_COLORS.no_show, icon: '✕', label: 'No asistió' },
  { value: 'cancelled_client', color: CYCLE_COLORS.cancelled_client, icon: '⊗', label: 'Cancelada (cliente)' },
  { value: 'cancelled_business', color: CYCLE_COLORS.cancelled_business, icon: '⊗', label: 'Cancelada (empresa)' },
];

/**
 * Estados que puede tomar un contacto de campaña en el CRM de clientes.
 *
 * Son los mismos que acepta el servidor para el dominio `audience`, y tienen que serlo: un
 * estado válido en la API pero ausente de esta lista deja al lead sin columna donde aparecer.
 * Pasó con «Descartado» —el servidor lo aceptaba y el tablero no lo dibujaba—, así que los
 * contactos descartados desaparecían de la pantalla sin haberse borrado.
 */
export const CONTACT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'new', color: CYCLE_COLORS.new, icon: '●', label: 'Nuevo' },
  { value: 'reserved', color: CYCLE_COLORS.reserved, icon: '●', label: 'Reservó' },
  { value: 'attended', color: CYCLE_COLORS.attended, icon: '✓', label: 'Asistió' },
  { value: 'no_show', color: CYCLE_COLORS.no_show, icon: '✕', label: 'No asistió' },
  { value: 'lost', color: CYCLE_COLORS.cancelled, icon: '⊗', label: 'Descartado' },
];

/**
 * Devuelve la opción que describe un estado, o `undefined` si no pertenece al conjunto.
 *
 * @param options - Conjunto de estados válidos para la superficie que llama.
 * @param value - Valor de estado a resolver.
 */
export function findStatusOption(options: StatusOption[], value: string): StatusOption | undefined {
  return options.find((option) => option.value === value);
}
