import type { JSX } from 'react';
import { buildWhatsAppShareUrl, type BookingShareData } from './whatsapp-link';

export interface ShareBookingProps extends BookingShareData {
  /** Etiqueta del botón, editable desde el constructor. */
  label?: string;
}

/**
 * Botón para llevarse la confirmación a WhatsApp.
 *
 * Abre WhatsApp con el mensaje escrito; la persona elige a quién enviarlo y si lo envía. **No
 * manda nada por su cuenta**, así que no necesita integración, número de empresa ni costo por
 * mensaje.
 *
 * Se ofrece junto a guardar en el calendario porque resuelven cosas distintas: el calendario
 * avisa a la hora, WhatsApp conserva el código donde la persona lo va a buscar.
 */
export function ShareBooking({ label, ...data }: ShareBookingProps): JSX.Element | null {
  const url = buildWhatsAppShareUrl(data);
  if (!url) return null;

  return (
    <a
      className="btn btn-outline"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label || 'Guardar en WhatsApp'}
    </a>
  );
}
