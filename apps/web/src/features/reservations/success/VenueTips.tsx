import type { JSX } from 'react';
import { parseVenueTips } from './venue-tips';

export interface VenueTipsProps {
  /** Texto guardado en `design_config.venueTips`, una recomendación por línea. */
  raw?: string;
}

/**
 * Recomendaciones del local en la pantalla de confirmación.
 *
 * Van **después** del código de reserva y no antes: el código es lo único que la persona
 * necesita conservar, y anteponerle cuatro líneas de texto lo empuja fuera de la primera
 * pantalla en un teléfono.
 *
 * No se renderiza nada si el local no escribió ninguna: una sección vacía con un título ocupa
 * el mismo espacio que una llena y no aporta nada.
 */
export function VenueTips({ raw }: VenueTipsProps): JSX.Element | null {
  const tips = parseVenueTips(raw);
  if (!tips.length) return null;

  return (
    <section className="booking-tips" aria-label="Recomendaciones del local">
      <ul>
        {tips.map((tip) => <li key={tip}>{tip}</li>)}
      </ul>
    </section>
  );
}
