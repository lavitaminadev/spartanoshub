/**
 * @fileoverview Qué pasó con un cupón: cuándo se usó, por qué camino y cuánto costó.
 *
 * Reemplaza a una lista que sólo mostraba reservas. Un cupón canjeado en el mostrador no aparecía
 * por ningún lado, y el panel llegaba a decir «aún no ha sido utilizado» sobre uno que se había
 * usado esa misma tarde.
 *
 * **Se muestran dos totales y no uno.** El contador del cupón incluye los usos anteriores a que
 * existiera el registro de canjes; esos no tienen fecha ni canal y no se les va a inventar una.
 * Cuando los dos números no coinciden se dice por qué, en vez de enseñar el más conveniente.
 */

import { useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { triggerToast } from '../../shared/toast-events';

interface Canje {
  fecha: string;
  canal: 'reserva' | 'local';
  persona: string | null;
  monto: string | null;
  descuento: string | null;
  nota: string | null;
}

interface Metricas {
  codigo: string;
  usosTotales: number;
  canjesRegistrados: number;
  porReserva: number;
  enElLocal: number;
  montoTotal: number | null;
  descuentoTotal: number | null;
  porDia: Array<{ dia: string; total: number }>;
  ultimos: Canje[];
}

const pesos = (valor: number) => `$${Math.round(valor).toLocaleString('es-CL')}`;

export function MetricasDelCupon({ couponId, codigo, alCerrar }: {
  couponId: string;
  codigo: string;
  alCerrar: () => void;
}): JSX.Element {
  const { data, isLoading } = useQuery<Metricas>({
    queryKey: ['coupon-metricas', couponId],
    queryFn: () => api.get(`/reservations/coupons/${couponId}/metricas`),
  });

  /*
   * La tabla se pide aparte y acotada; los totales de arriba son del cupón entero.
   *
   * Las métricas devuelven los veinte últimos canjes, que responde «cómo va» pero no «qué pasó
   * el sábado» ni «cuáles se anotaron en la caja». El recorte lo hace el motor, que es el único
   * que los tiene todos: filtrar acá sobre esos veinte dejaría fuera lo que no vino.
   */
  const [acotado, setAcotado] = useState<{ desde: string; hasta: string; canal: '' | 'reserva' | 'local' }>({ desde: '', hasta: '', canal: '' });
  const acotando = Boolean(acotado.desde || acotado.hasta || acotado.canal);
  const [descargando, setDescargando] = useState(false);
  const recorteEnLaUrl = () => new URLSearchParams({
    ...(acotado.desde ? { desde: acotado.desde } : {}),
    ...(acotado.hasta ? { hasta: acotado.hasta } : {}),
    ...(acotado.canal ? { canal: acotado.canal } : {}),
  }).toString();
  const descargar = async () => {
    setDescargando(true);
    try {
      const blob = await api.get<Blob>(`/reservations/coupons/${couponId}/canjes.csv?${recorteEnLaUrl()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `canjes-${codigo}-${new Date().toISOString().slice(0, 10)}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'No se pudo descargar el archivo', 'error');
    } finally {
      setDescargando(false);
    }
  };
  const { data: listado } = useQuery<{ canjes: Canje[]; total: number }>({
    queryKey: ['coupon-canjes', couponId, acotado.desde, acotado.hasta, acotado.canal],
    queryFn: () => api.get(`/reservations/coupons/${couponId}/canjes?${new URLSearchParams({
      ...(acotado.desde ? { desde: acotado.desde } : {}),
      ...(acotado.hasta ? { hasta: acotado.hasta } : {}),
      ...(acotado.canal ? { canal: acotado.canal } : {}),
    })}`),
  });

  /*
   * Se leen con valores por omisión en vez de confiar en la forma que llegue.
   *
   * Una respuesta a la que le falte una lista —un servidor más viejo, una versión de prueba, un
   * error que devuelva el objeto a medias— tumbaba la pestaña entera con el panel de recuperación
   * encima. Un cupón sin métricas se puede dibujar; una pantalla caída no.
   */
  const porDia = data?.porDia ?? [];
  // Lo acotado manda cuando llegó; si todavía no, los últimos de las métricas evitan la tabla vacía.
  const ultimos = listado?.canjes ?? data?.ultimos ?? [];
  const sinRegistro = Math.max((data?.usosTotales ?? 0) - (data?.canjesRegistrados ?? 0), 0);
  // El día con más canjes manda la altura del resto: sin un tope común, dos barras de 1 y 7 se
  // dibujarían iguales y el gráfico diría lo contrario de lo que pasó.
  const maximo = Math.max(...porDia.map((dia) => dia.total), 1);

  return (
    <div className="coupon-usages">
      <div className="reservation-section-head">
        <div><span className="page-eyebrow">USOS DE {codigo}</span><h2>Qué pasó con este cupón</h2></div>
        <button className="btn btn-outline btn-sm" type="button" onClick={alCerrar}>Cerrar</button>
      </div>

      {isLoading || !data ? <LoadingSpinner text="Buscando los canjes…" /> : (
        <>
          <div className="reservation-metric-grid reservation-metric-grid-four">
            <div><span>Usos totales</span><strong>{data.usosTotales ?? 0}</strong></div>
            <div><span>Por una reserva</span><strong>{data.porReserva ?? 0}</strong></div>
            <div><span>En el local</span><strong>{data.enElLocal ?? 0}</strong></div>
            <div>
              <span>Descuento entregado</span>
              {/* Nulo y cero dicen cosas distintas: nadie lo anotó, o se entregó cero. */}
              <strong>{data.descuentoTotal == null ? 'Sin anotar' : pesos(data.descuentoTotal)}</strong>
            </div>
          </div>

          {data.montoTotal != null ? (
            <p className="form-hint">Consumo anotado en esos canjes: <strong>{pesos(data.montoTotal)}</strong>.</p>
          ) : null}

          {/*
            * La diferencia entre el contador y lo registrado se nombra.
            *
            * Callarla haría parecer que faltan canjes o que el contador está mal, y no es ni una
            * cosa ni la otra: son usos de antes de que esto se registrara.
            */}
          {sinRegistro > 0 ? (
            <p className="form-hint">
              {sinRegistro} {sinRegistro === 1 ? 'uso anterior' : 'usos anteriores'} al registro de canjes, sin fecha ni canal.
            </p>
          ) : null}

          {porDia.length > 0 ? (
            <div className="cupon-por-dia" role="img" aria-label={`Canjes por día de ${codigo}`}>
              {porDia.map((dia) => (
                <div key={dia.dia} className="cupon-dia" title={`${dia.dia}: ${dia.total}`}>
                  <span style={{ height: `${Math.round((dia.total / maximo) * 100)}%` }} />
                  <small>{dia.dia.slice(5)}</small>
                </div>
              ))}
            </div>
          ) : null}

          <div className="reservation-filters cupon-canjes-filtros">
            <label className="filter-date">Desde<input className="input" type="date" aria-label="Canjes desde" value={acotado.desde} max={acotado.hasta || undefined} onChange={(evento) => setAcotado((actual) => ({ ...actual, desde: evento.target.value }))} /></label>
            <label className="filter-date">Hasta<input className="input" type="date" aria-label="Canjes hasta" value={acotado.hasta} min={acotado.desde || undefined} onChange={(evento) => setAcotado((actual) => ({ ...actual, hasta: evento.target.value }))} /></label>
            <select className="input" aria-label="Filtrar canjes por canal" value={acotado.canal} onChange={(evento) => setAcotado((actual) => ({ ...actual, canal: evento.target.value as '' | 'reserva' | 'local' }))}>
              <option value="">Por reserva y en el local</option>
              <option value="reserva">Sólo los de una reserva</option>
              <option value="local">Sólo los del local</option>
            </select>
            {acotando ? <button type="button" className="btn btn-link" onClick={() => setAcotado({ desde: '', hasta: '', canal: '' })}>Quitar el recorte</button> : null}
            {/*
              Se descarga lo que está a la vista, con el mismo recorte.
              Un CSV que trajera todo mientras la pantalla muestra un tramo haría dudar de cuál
              de los dos números es el bueno.
            */}
            <button type="button" className="btn btn-outline btn-sm" disabled={descargando} onClick={() => void descargar()}>
              {descargando ? 'Preparando…' : 'Canjes (CSV)'}
            </button>
          </div>

          {ultimos.length === 0 ? (
            <p className="crm-dash-vacio">{acotando ? 'Ningún canje cae en ese recorte. Prueba a correr las fechas o a quitarlo.' : 'Todavía no hay canjes registrados de este cupón.'}</p>
          ) : (
            <div className="crm-table-container">
              <table className="data-table">
                <thead><tr><th>Cuándo</th><th>Cómo</th><th>Quién</th><th>Consumo</th><th>Descuento</th><th>Nota</th></tr></thead>
                <tbody>
                  {ultimos.map((canje) => (
                    <tr key={`${canje.fecha}-${canje.persona ?? ''}`}>
                      <td>{new Date(canje.fecha).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{canje.canal === 'local' ? 'En el local' : 'Con reserva'}</td>
                      <td>{canje.persona || <small className="tabla-nota">Sin anotar</small>}</td>
                      <td>{canje.monto === null ? <small className="tabla-nota">—</small> : pesos(Number(canje.monto))}</td>
                      <td>{canje.descuento === null ? <small className="tabla-nota">—</small> : pesos(Number(canje.descuento))}</td>
                      <td>{canje.nota || <small className="tabla-nota">—</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
