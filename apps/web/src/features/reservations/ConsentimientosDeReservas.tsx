import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

interface Consentimientos { suscritos: number; pendientes: number; bajas: number; ultimos30: number; desde: string | null }

export function ConsentimientosDeReservas({ clientId }: { clientId?: string }): JSX.Element | null {
  const consulta = useQuery<Consentimientos>({
    queryKey: ['consentimientos-de-reservas', clientId], enabled: Boolean(clientId),
    queryFn: () => api.get(`/reservations/consentimientos?clientId=${encodeURIComponent(clientId!)}`),
    retry: false,
  });
  if (!clientId || consulta.isLoading || consulta.error || !consulta.data) return null;
  const datos = consulta.data;
  if (datos.suscritos + datos.pendientes + datos.bajas === 0) return null;
  return <section className="card" aria-labelledby="permisos-reservas-titulo">
    <span className="page-eyebrow">PERMISOS DESDE RESERVAS</span>
    <h2 id="permisos-reservas-titulo">Comunicaciones autorizadas</h2>
    <p className="page-subtitle">Resumen agregado. Los destinatarios y campañas se administran exclusivamente en Marketing.</p>
    <div className="stats-grid">
      <article><strong>{datos.suscritos.toLocaleString('es-CL')}</strong><span> vigentes</span>{datos.ultimos30 > 0 && <small> · {datos.ultimos30} últimos 30 días</small>}</article>
      <article><strong>{datos.pendientes.toLocaleString('es-CL')}</strong><span> pendientes</span></article>
      <article><strong>{datos.bajas.toLocaleString('es-CL')}</strong><span> bajas respetadas</span></article>
    </div>
  </section>;
}
