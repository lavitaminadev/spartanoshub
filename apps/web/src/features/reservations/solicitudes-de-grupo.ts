/**
 * @fileoverview Cómo se lee y se responde una solicitud de grupo, igual en todas las pantallas.
 *
 * La agenda y la pestaña de grupos mostraban la misma solicitud con piezas distintas: una tenía
 * la respuesta por WhatsApp y el tiempo de espera, la otra la conversión y el cierre. Lo que
 * decide cómo se ve y cómo se contesta vive aquí para que las dos digan lo mismo.
 */

import { CATEGORIAS_DE_EVENTO } from './tipos-de-evento';

/** El servidor guarda la categoría; quien atiende lee el nombre. */
export const NOMBRE_DE_CATEGORIA = Object.fromEntries(CATEGORIAS_DE_EVENTO.map((categoria) => [categoria.valor, categoria.nombre]));

/** A partir de cuántas horas sin responder una solicitud pasa a leerse como atrasada. */
const HORAS_PARA_URGIR = 12;

/** Tono de la espera: verde recién llegada, ámbar la que lleva rato, rojo la que ya urge. */
export function tonoDeEspera(creada?: string): 'reciente' | 'demorada' | 'urgente' {
  if (!creada) return 'reciente';
  const horas = (Date.now() - new Date(creada).getTime()) / 3_600_000;
  if (horas >= 24) return 'urgente';
  if (horas >= HORAS_PARA_URGIR) return 'demorada';
  return 'reciente';
}

/** Desde cuándo espera respuesta: una solicitud de ayer no se atiende igual que una de recién. */
export function esperandoDesde(creada?: string): string {
  if (!creada) return '';
  const minutos = Math.floor((Date.now() - new Date(creada).getTime()) / 60_000);
  if (Number.isNaN(minutos) || minutos < 0) return '';
  if (minutos < 60) return `hace ${Math.max(1, minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * Mensaje ya escrito para responder por WhatsApp, editable antes de enviarlo.
 *
 * Con un precio anotado, el mensaje lo lleva: anotarlo y después volver a escribirlo a mano en el
 * chat era hacer dos veces lo mismo, y la segunda con más riesgo de equivocarse en una cifra.
 */
export function whatsappDeSolicitud(telefono: string | undefined, nombre: string, personas: number, precio?: { monto?: string | null; detalle?: string | null }): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  if (digitos.length < 8) return null;
  const numero = digitos.length === 9 ? `56${digitos}` : digitos.length === 8 ? `569${digitos}` : digitos;
  const saludo = nombre.trim().split(/\s+/)[0] || 'Hola';
  const monto = Number(precio?.monto ?? 0);
  const mensaje = monto > 0
    ? `Hola ${saludo}, para tu evento de ${personas} personas el valor es $${monto.toLocaleString('es-CL')}${precio?.detalle?.trim() ? `, e incluye: ${precio.detalle.trim()}` : ''}. ¿Te lo reservamos?`
    : `Hola ${saludo}, recibimos tu solicitud para ${personas} personas. Te contamos qué podemos ofrecerte.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
