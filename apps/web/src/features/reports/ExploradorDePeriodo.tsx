import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { reportMoney, textoDeVariacion, variacion } from './monthly-report.types';

type Modo = 'anterior' | 'ano_anterior' | 'ninguna';

interface Metricas {
  impressions: number; clicks: number; leads: number; conversions: number;
  bookings: number; attendedBookings: number; noShows: number;
  deliveredPieces: number; consumedUd: number; meetings: number; completedMeetings: number; wonOpportunities: number;
}

interface Periodo { desde: string; hasta: string; metricas: Metricas; inversion: number; ventas: number }

interface Respuesta {
  clientId: string;
  clientName: string;
  comparar: Modo;
  periodo: Periodo;
  comparacion: Periodo | null;
}

/** Las filas que se muestran, en el orden en que se leen: de la campaña hacia la mesa. */
const FILAS: { clave: keyof Metricas; etiqueta: string; soloUd?: boolean }[] = [
  { clave: 'impressions', etiqueta: 'Impresiones' },
  { clave: 'clicks', etiqueta: 'Clics' },
  { clave: 'leads', etiqueta: 'Leads' },
  { clave: 'conversions', etiqueta: 'Conversiones' },
  { clave: 'bookings', etiqueta: 'Reservas' },
  { clave: 'attendedBookings', etiqueta: 'Reservas atendidas' },
  { clave: 'noShows', etiqueta: 'Ausencias' },
  { clave: 'wonOpportunities', etiqueta: 'Oportunidades ganadas' },
  { clave: 'deliveredPieces', etiqueta: 'Piezas entregadas' },
  { clave: 'consumedUd', etiqueta: 'UD consumidas', soloUd: true },
  { clave: 'meetings', etiqueta: 'Reuniones' },
  { clave: 'completedMeetings', etiqueta: 'Reuniones completadas' },
];

const hoy = new Date();
const comoFecha = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const dia = (valor: string) => new Date(`${valor}T12:00:00`).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * El rango por omisión: los últimos treinta días, con `hasta` exclusivo.
 *
 * Treinta y no «este mes» porque el mes en curso compara una parte contra un entero y toda cifra
 * sale baja sin que nada lo diga.
 */
const RANGO_INICIAL = {
  desde: comoFecha(new Date(hoy.getTime() - 30 * 86_400_000)),
  hasta: comoFecha(new Date(hoy.getTime() + 86_400_000)),
};

/**
 * Pregunta cómo le fue a una empresa entre dos fechas, y contra qué se compara.
 *
 * Es lo que el informe mensual no puede ser: el informe está atado al mes porque es un documento
 * que se cierra, se redacta y se firma. Esto no guarda nada y responde el rango que se pida. Las
 * dos cosas leen los mismos agregados en el servidor, así que preguntar acá por un mes completo
 * da las cifras del informe de ese mes.
 *
 * @param clientId - Empresa del análisis. Una cuenta de portal no lo manda: el servidor resuelve
 * la suya y no puede ser otra.
 * @param showUdMetrics - Si la empresa tiene el presupuesto en UD contratado. Sin él esa fila no
 * se muestra, en lugar de mostrar un cero que parece un dato.
 */
export function ExploradorDePeriodo({ clientId, showUdMetrics = true }: { clientId?: string; showUdMetrics?: boolean }) {
  const [desde, setDesde] = useState(RANGO_INICIAL.desde);
  const [hasta, setHasta] = useState(RANGO_INICIAL.hasta);
  const [modo, setModo] = useState<Modo>('anterior');
  const rangoValido = Boolean(desde && hasta && hasta > desde);

  const consulta = useQuery<Respuesta>({
    queryKey: ['explorar-periodo', clientId ?? 'propia', desde, hasta, modo],
    enabled: rangoValido,
    queryFn: () => {
      const parametros = new URLSearchParams({ desde, hasta, comparar: modo });
      if (clientId) parametros.set('clientId', clientId);
      return api.get(`/reporting/explorar?${parametros.toString()}`);
    },
  });

  /*
   * `periodo` tiene que venir; si no viene, no se muestra una tabla de ceros.
   *
   * El endpoint siempre lo entrega, pero una respuesta recortada —un proxy, la maqueta sin este
   * patrón— dejaría la tabla pintada con ceros, que se lee como «no pasó nada en ese rango». Un
   * cero medido y un cero por falta de respuesta son cosas distintas y la pantalla tiene que
   * poder decir cuál es.
   */
  const datos = consulta.data?.periodo?.metricas ? consulta.data : undefined;
  const sinForma = Boolean(consulta.data && !datos);
  const filas = FILAS.filter((fila) => showUdMetrics || !fila.soloUd);

  return <section className="explorador-periodo">
    <header>
      <div><span className="page-eyebrow">ANÁLISIS POR RANGO</span><h2>Explorar un período</h2><p>Elige las fechas y contra qué comparar. No se guarda nada: es una consulta.</p></div>
    </header>

    <form className="explorador-controles" onSubmit={(evento) => evento.preventDefault()}>
      <label>Desde<input className="input" type="date" value={desde} max={hasta} onChange={(evento) => setDesde(evento.target.value)} /></label>
      <label>Hasta<input className="input" type="date" value={hasta} min={desde} onChange={(evento) => setHasta(evento.target.value)} /></label>
      <label>Comparar con<select className="input" value={modo} onChange={(evento) => setModo(evento.target.value as Modo)}>
        <option value="anterior">El período anterior, de igual duración</option>
        <option value="ano_anterior">Las mismas fechas del año anterior</option>
        <option value="ninguna">No comparar</option>
      </select></label>
    </form>

    {!rangoValido && <p className="form-context" role="status">El fin del rango debe ser posterior al inicio.</p>}
    {consulta.isLoading && rangoValido && <p className="muted">Midiendo el período...</p>}
    {consulta.error && <div className="alert alert-error">No pudimos medir ese rango: {consulta.error.message}</div>}
    {sinForma && <div className="panel-empty"><strong>La respuesta llegó sin las métricas</strong><span>No se muestran ceros: un cero medido y una respuesta incompleta no son lo mismo. Vuelve a intentarlo.</span></div>}

    {datos && <>
      <p className="explorador-rango" role="status">
        <strong>{dia(datos.periodo.desde)} a {dia(datos.periodo.hasta)}</strong>
        {datos.comparacion
          ? <span> comparado con {dia(datos.comparacion.desde)} a {dia(datos.comparacion.hasta)}</span>
          : <span> sin comparación</span>}
      </p>

      <div className="explorador-destacados">
        <article><span>Inversión</span><strong>{reportMoney(datos.periodo.inversion)}</strong>{datos.comparacion && <small>{textoDeVariacion(datos.periodo.inversion, datos.comparacion.inversion)}</small>}</article>
        <article><span>Ventas atribuidas</span><strong>{reportMoney(datos.periodo.ventas)}</strong>{datos.comparacion && <small>{textoDeVariacion(datos.periodo.ventas, datos.comparacion.ventas)}</small>}</article>
      </div>

      <table className="explorador-tabla">
        <caption className="sr-only">Métricas del período{datos.comparacion ? ', con el período de comparación y su variación' : ''}</caption>
        <thead><tr><th scope="col">Métrica</th><th scope="col">Período</th>{datos.comparacion && <><th scope="col">Comparación</th><th scope="col">Variación</th></>}</tr></thead>
        <tbody>
          {filas.map((fila) => {
            const actual = datos.periodo.metricas[fila.clave] ?? 0;
            const previo = datos.comparacion?.metricas[fila.clave] ?? 0;
            const pct = datos.comparacion ? variacion(actual, previo) : null;
            return <tr key={fila.clave}>
              <th scope="row">{fila.etiqueta}</th>
              <td>{actual.toLocaleString('es-CL')}</td>
              {datos.comparacion && <>
                <td>{previo.toLocaleString('es-CL')}</td>
                <td className={pct === null ? '' : pct >= 0 ? 'sube' : 'baja'}>{textoDeVariacion(actual, previo)}</td>
              </>}
            </tr>;
          })}
        </tbody>
      </table>
      <p className="data-note">Las fechas se leen sobre el día de la actividad: la reserva por su día de visita, la pieza por su entrega, la oportunidad por su cierre. «Hasta» no se incluye.</p>
    </>}
  </section>;
}
