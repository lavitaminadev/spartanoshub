import type { JSX } from 'react';
import { ReservationResults } from '../dashboard/ReservationResults';
import { MotivosDePerdida } from './MotivosDePerdida';
import { useEmpresaActiva } from '../../shared/empresa-activa';

/**
 * Resultados de reservas, la pantalla del menú.
 *
 * Antes había dos vistas de resultados —esta y una pestaña dentro de Reservas— con gráficos
 * distintos sobre los mismos datos: cada una tenía su selector de período, así que las dos podían
 * mostrar cifras distintas a la vez y nadie sabía cuál mirar. Quedó una sola, la que se alcanza
 * desde cualquier pantalla, y el panel es el mismo del inicio con su detalle de zona y campaña.
 *
 * **La empresa se elige acá.** La ruta no le pasaba ninguna, así que con varias empresas los dos
 * paneles sumaban todas y no había forma de separarlas: el número que se leía no era de nadie en
 * particular. El selector es el mismo que el resto de las pantallas, así que elegir aquí y en el
 * CRM deja lo mismo elegido.
 *
 * @param clientId - Acota a una empresa. Si se pasa, manda sobre el selector: lo usan las
 *   pantallas que ya están dentro de una empresa y no deben dejar salir de ella.
 */
export function ReservationsAnalyticsPage({ clientId }: { clientId?: string } = {}): JSX.Element {
  const empresa = useEmpresaActiva();
  const elegida = clientId ?? empresa.clientId;

  return <>
    {/* Con una sola empresa no hay nada que elegir, y el selector sólo sería ruido. */}
    {!clientId && empresa.varias ? (
      <div className="reservation-filters">
        <label className="filter-empresa">
          Empresa
          <select className="input" aria-label="Empresa de los resultados" value={empresa.clientId} onChange={(evento) => empresa.elegir(evento.target.value)}>
            <option value="">Todas las empresas</option>
            {empresa.empresas.map((una) => <option key={una.id} value={una.id}>{una.name}</option>)}
          </select>
        </label>
      </div>
    ) : null}
    <ReservationResults clientId={elegida || undefined} headingLevel={1} detalle />
    <MotivosDePerdida clientId={elegida || undefined} />
  </>;
}
