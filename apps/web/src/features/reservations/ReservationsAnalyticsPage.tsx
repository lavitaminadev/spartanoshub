import type { JSX } from 'react';
import { ReservationResults } from '../dashboard/ReservationResults';

/**
 * Resultados de reservas, la pantalla del menú.
 *
 * Antes había dos vistas de resultados —esta y una pestaña dentro de Reservas— con gráficos
 * distintos sobre los mismos datos: cada una tenía su selector de período, así que las dos podían
 * mostrar cifras distintas a la vez y nadie sabía cuál mirar. Quedó una sola, la que se alcanza
 * desde cualquier pantalla, y el panel es el mismo del inicio con su detalle de zona y campaña.
 *
 * @param clientId - Acota a una empresa. Sin él, el servidor responde según el alcance de quien mira.
 */
export function ReservationsAnalyticsPage({ clientId }: { clientId?: string } = {}): JSX.Element {
  return <ReservationResults clientId={clientId} headingLevel={1} detalle />;
}
