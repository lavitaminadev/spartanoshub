import { useQuery } from '@tanstack/react-query';
import { MOTIVOS_DE_CIERRE, nombreDelMotivo } from '@espartanos/shared';
import { api } from '../../core/api';
import type { GroupRequest } from './types';

/**
 * @fileoverview Por qué se pierden los eventos, contado.
 *
 * Cada solicitud cerrada sin reserva guarda su motivo, pero ninguna pantalla los juntaba: para
 * saber si se pierden más por precio, por falta de cupo o por responder tarde había que abrirlas
 * una por una. Cada causa se corrige distinto —revisar precios, abrir cupo, contestar antes—, así
 * que el número que importa es cuál pesa más.
 */

interface Props {
  clientId?: string;
}

export function MotivosDePerdida({ clientId }: Props) {
  const { data = [] } = useQuery<GroupRequest[]>({
    queryKey: ['group-requests', 'motivos', clientId ?? ''],
    queryFn: () => api.get(`/reservations/group-requests${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
  });
  const solicitudes = Array.isArray(data) ? data : [];
  const convertidas = solicitudes.filter((item) => item.status === 'converted').length;
  const cerradas = solicitudes.filter((item) => item.status === 'closed');
  if (convertidas + cerradas.length === 0) return null;

  const conMotivo = cerradas.filter((item) => item.closeReason);
  const porMotivo = MOTIVOS_DE_CIERRE
    .map((motivo) => ({ ...motivo, cantidad: conMotivo.filter((item) => item.closeReason === motivo.clave).length }))
    .filter((motivo) => motivo.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);
  // Las cerradas antes de pedir motivo se cuentan aparte: no se les inventa uno.
  const sinMotivo = cerradas.length - conMotivo.length;
  const mayor = porMotivo[0]?.cantidad ?? 0;

  return <section className="motivos-de-perdida">
    <header>
      <span className="page-eyebrow">GRUPOS Y EVENTOS</span>
      <h2>Por qué se pierden los eventos</h2>
      <p className="page-subtitle">{convertidas} {convertidas === 1 ? 'se convirtió' : 'se convirtieron'} en reserva y {cerradas.length} {cerradas.length === 1 ? 'se cerró' : 'se cerraron'} sin ella.</p>
    </header>
    {porMotivo.length > 0 ? <ul>
      {porMotivo.map((motivo) => <li key={motivo.clave}>
        <span>{nombreDelMotivo(motivo.clave)}</span>
        <span className="motivos-barra" aria-hidden="true"><i style={{ width: `${Math.round((motivo.cantidad / mayor) * 100)}%` }} /></span>
        <strong>{motivo.cantidad}</strong>
      </li>)}
    </ul> : <p className="page-subtitle">Todavía no hay solicitudes cerradas con motivo.</p>}
    {sinMotivo > 0 && <small>{sinMotivo} {sinMotivo === 1 ? 'se cerró' : 'se cerraron'} antes de que se pidiera el motivo.</small>}
  </section>;
}
