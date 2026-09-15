/**
 * @fileoverview Si las conversiones de una sucursal realmente llegan a Meta.
 *
 * «Meta está listo» sólo dice que hay credenciales. Esto muestra lo que salió en los últimos 30
 * días, lo que espera reintento y lo que falló, con el último error: suele bastar para saber si
 * venció el acceso o cambió el Pixel.
 */

import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

interface Salud {
  enviados: number;
  pendientes: number;
  fallidos: number;
  ultimoEnvio: string | null;
  ultimoError: { mensaje: string; cuando: string } | null;
  pausadoPorCredencial?: boolean;
}

export function SaludDeMedicion({ formId }: { formId: string }): JSX.Element {
  const { data, isLoading, error } = useQuery({ queryKey: ['meta-health', formId], queryFn: () => api.get<Salud>(`/reservations/forms/${encodeURIComponent(formId)}/meta-health`), staleTime: 60_000 });
  if (isLoading) return <div className="salud-medicion"><small>Revisando envíos a Meta…</small></div>;
  if (error || !data) return <div className="salud-medicion"><small>No se pudo revisar el estado de los envíos.</small></div>;
  const total = data.enviados + data.pendientes + data.fallidos;
  if (data.pausadoPorCredencial) {
    return (
      <div className="salud-medicion is-mal">
        <strong>Envío a Meta en pausa: el acceso fue rechazado</strong>
        <small>Para no acumular fallos, las conversiones nuevas no se envían mientras tanto. Reconecta Meta en Conexiones y reintenta los fallidos; se reanuda sola con el primer envío exitoso o en 24 horas.</small>
        {data.ultimoError && <small className="salud-medicion-error">Detalle: {data.ultimoError.mensaje}</small>}
      </div>
    );
  }
  const estado = data.fallidos > 0 && data.fallidos >= data.enviados ? 'mal' : data.fallidos > 0 || data.pendientes > 5 ? 'revisar' : total === 0 ? 'vacio' : 'bien';
  return (
    <div className={`salud-medicion is-${estado}`}>
      <strong>{estado === 'bien' ? 'Las conversiones llegan a Meta' : estado === 'vacio' ? 'Todavía no hay conversiones en los últimos 30 días' : estado === 'revisar' ? 'Algunas conversiones no llegaron' : 'Las conversiones no están llegando a Meta'}</strong>
      <div className="salud-medicion-cifras">
        <span><b>{data.enviados}</b> enviadas</span>
        <span><b>{data.pendientes}</b> en espera</span>
        <span><b>{data.fallidos}</b> fallidas</span>
      </div>
      {data.ultimoEnvio && <small>Último envío: {new Date(data.ultimoEnvio).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}</small>}
      {data.ultimoError && <small className="salud-medicion-error">Último error ({new Date(data.ultimoError.cuando).toLocaleDateString('es-CL')}): {data.ultimoError.mensaje}</small>}
    </div>
  );
}
