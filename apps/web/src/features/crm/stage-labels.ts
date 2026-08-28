import { LEAD_STATUSES_BY_DOMAIN } from '@espartanos/shared';

/**
 * @fileoverview Nombre de cada etapa del embudo comercial.
 *
 * Vive aparte porque lo usan el tablero, la ficha y el panel. Con una copia en cada pantalla, la
 * primera vez que alguien renombra una etapa la renombra en una sola y las tres empiezan a decir
 * cosas distintas del mismo lead.
 *
 * Los rótulos y las claves son cosas separadas a propósito: `quote_sent` se lee «Calificado» y
 * `won` se lee «Venta». Renombrar la clave dejaría huérfanos todos los leads que ya la tienen;
 * cambiar el rótulo no toca la base.
 */

/**
 * Etapas del embudo comercial, en el orden en que se recorre.
 *
 * Derivadas del catálogo compartido y no escritas otra vez: estuvieron declaradas por separado y
 * a esta lista le faltaba «Visitó», así que los leads en esa etapa no tenían columna donde
 * dibujarse. No fallaba nada; desaparecían de la pantalla.
 */
export const STAGES = LEAD_STATUSES_BY_DOMAIN.commercial;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  quote_sent: 'Calificado',
  meeting_scheduled: 'Visita agendada',
  // Agendar la visita y que ocurra son dos hechos distintos: uno espera una fecha, el otro
  // espera una respuesta. Con una sola etapa no se distingue al que no llegó del que sí vino.
  negotiation: 'Negociación',
  won: 'Venta',
  lost: 'Descartado',
};

/**
 * Color de cada etapa.
 *
 * No decora: separa lo que sigue en curso de lo que ya se cerró, que es la distinción que se hace
 * de un vistazo al mirar el tablero.
 */
export const STAGE_ACCENT: Record<string, string> = {
  new: '#8fd8ff',
  contacted: '#7cc6f5',
  quote_sent: '#17c78a',
  meeting_scheduled: '#e2a33c',
  negotiation: '#f0a05a',
  won: '#17c78a',
  lost: '#c9736b',
};
