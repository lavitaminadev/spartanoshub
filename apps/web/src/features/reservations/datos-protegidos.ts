import { estaProtegido } from '@espartanos/shared';
import type { Reservation } from './types';

/*
 * Lo común vive en `shared/datos-protegidos`, que es donde lo usan las demás pantallas.
 *
 * Aquí quedan sólo las dos funciones que saben qué es una reserva. Tenerlo dos veces, aunque el
 * texto coincida hoy, garantiza que mañana una de las dos copias diga otra cosa.
 */
export { TEXTO_PROTEGIDO, valorLlegado } from '../../shared/datos-protegidos';
import { TEXTO_PROTEGIDO, valorLlegado } from '../../shared/datos-protegidos';

/** El teléfono para llamar o escribir; nunca la marca. */
export function telefonoDe(reserva: Pick<Reservation, 'guestPhone'>): string | undefined {
  return valorLlegado(reserva.guestPhone) || undefined;
}

/**
 * La línea de contacto de una fila.
 *
 * «Protegido» y «Sin contacto» son cosas distintas: lo primero es que el dato existe y no se
 * muestra; lo segundo, que la persona no lo dejó.
 */
export function contactoDe(reserva: Pick<Reservation, 'guestPhone' | 'guestEmail'>): string {
  if (estaProtegido(reserva.guestPhone) || estaProtegido(reserva.guestEmail)) return TEXTO_PROTEGIDO;
  return reserva.guestPhone || reserva.guestEmail || 'Sin contacto';
}
