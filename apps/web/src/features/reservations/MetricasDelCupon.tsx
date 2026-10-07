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

import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

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

  const sinRegistro = data ? data.usosTotales - data.canjesRegistrados : 0;
  // El día con más canjes manda la altura del resto: sin un tope común, dos barras de 1 y 7 se
  // dibujarían iguales y el gráfico diría lo contrario de lo que pasó.
  const maximo = Math.max(...(data?.porDia ?? []).map((dia) => dia.total), 1);

  return (
    <div className="coupon-usages">
      <div className="reservation-section-head">
        <div><span className="page-eyebrow">USOS DE {codigo}</span><h2>Qué pasó con este cupón</h2></div>
        <button className="btn btn-outline btn-sm" type="button" onClick={alCerrar}>Cerrar</button>
      </div>

      {isLoading || !data ? <LoadingSpinner text="Buscando los canjes…" /> : (
        <>
          <div className="reservation-metric-grid reservation-metric-grid-four">
            <div><span>Usos totales</span><strong>{data.usosTotales}</strong></div>
            <div><span>Por una reserva</span><strong>{data.porReserva}</strong></div>
            <div><span>En el local</span><strong>{data.enElLocal}</strong></div>
            <div>
              <span>Descuento entregado</span>
              {/* Nulo y cero dicen cosas distintas: nadie lo anotó, o se entregó cero. */}
              <strong>{data.descuentoTotal === null ? 'Sin anotar' : pesos(data.descuentoTotal)}</strong>
            </div>
          </div>

          {data.montoTotal !== null ? (
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

          {data.porDia.length > 0 ? (
            <div className="cupon-por-dia" role="img" aria-label={`Canjes por día de ${codigo}`}>
              {data.porDia.map((dia) => (
                <div key={dia.dia} className="cupon-dia" title={`${dia.dia}: ${dia.total}`}>
                  <span style={{ height: `${Math.round((dia.total / maximo) * 100)}%` }} />
                  <small>{dia.dia.slice(5)}</small>
                </div>
              ))}
            </div>
          ) : null}

          {data.ultimos.length === 0 ? (
            <p className="crm-dash-vacio">Todavía no hay canjes registrados de este cupón.</p>
          ) : (
            <div className="crm-table-container">
              <table className="data-table">
                <thead><tr><th>Cuándo</th><th>Cómo</th><th>Quién</th><th>Consumo</th><th>Descuento</th><th>Nota</th></tr></thead>
                <tbody>
                  {data.ultimos.map((canje) => (
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
