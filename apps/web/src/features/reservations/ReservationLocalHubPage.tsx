import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import type { ReservationForm } from './types';
import './ReservationOperationsPage.css';

/**
 * Puerta de entrada de un local. "Formulario" es un detalle técnico: para una empresa esto es
 * un local con su propia agenda, enlace y reglas. Tener esta pantalla evita que el usuario tenga
 * que decidir entre tres editores distintos para empezar a trabajar.
 */
export function ReservationLocalHubPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const clientMode = location.pathname.startsWith('/portal/');
  const base = clientMode ? '/portal/reservations' : '/reservations';
  const { data: local, isLoading, error, refetch } = useQuery<ReservationForm>({
    queryKey: ['reservation-local', id], queryFn: () => api.get(`/reservations/forms/${id}`), enabled: Boolean(id),
  });
  if (isLoading) return <LoadingSpinner text="Abriendo el local..." />;
  if (error || !local) return <QueryErrorState error={error} onRetry={() => refetch()} />;
  const publicUrl = local.publicUrl || `/book/${local.publicSlug}`;
  const hasLogo = Boolean(local.designConfig?.logoUrl);
  const hasBackground = Boolean(local.designConfig?.backgroundImage);

  return <main className="reservation-local-hub">
    <header className="local-hub-hero">
      <div>
        <Link className="back-link" to={base}>← Mis locales</Link>
        <span className="page-eyebrow">LOCAL DE RESERVAS · {local.status === 'published' ? 'PUBLICADO' : local.status === 'paused' ? 'PAUSADO' : 'BORRADOR'}</span>
        <h1>{local.name}</h1>
        <p className="page-subtitle">{local.status === 'published' ? 'Canal publicado y listo para recibir reservas.' : 'Canal en borrador o pausado. Configúralo antes de compartirlo.'}</p>
      </div>
      <div className="portal-item-actions"><Link className="btn btn-primary" to={`${base}/forms/${id}/design`}>Configurar lo esencial</Link><a className="btn btn-outline" href={publicUrl} target="_blank" rel="noreferrer">Ver como cliente</a></div>
    </header>

    <section className="local-hub-section"><div><span className="page-eyebrow">GESTIONAR ESTE LOCAL</span><h2>Elige una tarea</h2><p>Todo lo que abras queda restringido a {local.name}.</p></div><div className="local-hub-grid">
      <Link className="local-hub-card is-primary" to={`${base}/forms/${id}/design`}><span className="local-hub-icon">✦</span><div><strong>Configuración esencial</strong><small>Horarios, cupos, campos, diseño y publicación en un único recorrido.</small></div><b>Configurar y publicar →</b></Link>
      <Link className="local-hub-card" to={`${base}/manage?tab=bookings&clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">▤</span><div><strong>Reservas</strong><small>Lista masiva, filtros, exportación y detalle.</small></div><b>Ver reservas →</b></Link>
      <Link className="local-hub-card" to={`${base}/agenda?clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">◷</span><div><strong>Agenda y grupos</strong><small>Turno, bloqueos y solicitudes de evento.</small></div><b>Abrir agenda →</b></Link>
      <Link className="local-hub-card" to={`${base}/calendar?clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">▦</span><div><strong>Disponibilidad</strong><small>Ocupación mensual de este local, sin mezclar sedes.</small></div><b>Ver calendario →</b></Link>
      <Link className="local-hub-card" to={`${base}/manage?tab=coupons&clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">⌑</span><div><strong>Cupones</strong><small>Vigencia, usos y reservas que lo aplicaron.</small></div><b>Gestionar cupones →</b></Link>
      <Link className="local-hub-card" to={`${base}/forms/${id}/advanced`}><span className="local-hub-icon">⚙</span><div><strong>Ajustes especiales</strong><small>Zonas, alergias, niños, consentimientos y cierres.</small></div><b>Abrir ajustes →</b></Link>
    </div></section>

    <section className="local-hub-status">
      <div><span className="page-eyebrow">PUBLICACIÓN</span><h2>Identidad y enlace</h2><p className="page-subtitle">La identidad es opcional: se puede publicar con la plantilla y personalizarla después.</p></div>
      <div className="reservation-metric-grid reservation-metric-grid-four"><div><span>Estado</span><strong>{local.status === 'published' ? 'Publicado' : local.status === 'paused' ? 'Pausado' : 'Borrador'}</strong></div><Link to={`${base}/forms/${id}/design`}><span>Logo</span><strong>{hasLogo ? 'Cambiar logo' : 'Agregar logo'}</strong></Link><Link to={`${base}/forms/${id}/design`}><span>Portada</span><strong>{hasBackground ? 'Cambiar portada' : 'Agregar portada'}</strong></Link><Link to={`${base}/forms/${id}/design`}><span>Medición</span><strong>{local.metaCapiEnabled || local.ga4MeasurementId ? 'Revisar medición' : 'Configurar si la necesitas'}</strong></Link></div>
      <p className="page-subtitle">Enlace público: <code>{publicUrl}</code></p>
    </section>

  </main>;
}
