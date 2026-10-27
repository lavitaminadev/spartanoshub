import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

/** Lo que devuelve `/reservations/:id/historial-del-comensal`; nunca trae el teléfono ni el correo. */
interface HistorialDelComensal {
  conDesenlace: number;
  asistio: number;
  noAsistio: number;
  canceladas: number;
  proporcionNoShow: number | null;
  frase: string;
  ultimas: Array<{ id: string; startsAt: string; status: string }>;
}

const ESTADO: Record<string, string> = { attended: 'Asistió', no_show: 'No se presentó', cancelled: 'Canceló', cancelled_client: 'Canceló', cancelled_business: 'La canceló el local' };

/**
 * Cómo ha respondido este comensal a sus reservas anteriores en esta empresa.
 *
 * Si la persona no tiene el área del historial, la ruta responde 403 y la sección no se dibuja.
 */
export function AsistenciaDelComensal({ reservaId, zonaHoraria }: { reservaId: string; zonaHoraria?: string }) {
  const { data } = useQuery<HistorialDelComensal>({
    queryKey: ['historial-del-comensal', reservaId],
    queryFn: () => api.get(`/reservations/${reservaId}/historial-del-comensal`),
    retry: false,
  });
  if (!data) return null;

  return <div className="booking-detail-extra">
    <span className="page-eyebrow">SU ASISTENCIA EN ESTA EMPRESA</span>
    <p className={data.noAsistio > 0 ? 'es-aviso' : undefined}><strong>{data.frase}</strong></p>
    {data.canceladas > 0 && <small className="tabla-nota">{data.canceladas} {data.canceladas === 1 ? 'reserva cancelada' : 'reservas canceladas'} aparte.</small>}
    {data.ultimas.length > 0 && <ul className="booking-historial">
      {data.ultimas.map((una) => <li key={una.id}>
        <span>{new Date(una.startsAt).toLocaleDateString('es-CL', { dateStyle: 'medium', timeZone: zonaHoraria })}</span>
        <strong>{ESTADO[una.status] ?? una.status}</strong>
      </li>)}
    </ul>}
  </div>;
}
