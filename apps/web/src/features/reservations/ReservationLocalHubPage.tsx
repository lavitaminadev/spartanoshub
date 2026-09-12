import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { triggerToast } from '../../shared/toast-events';
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
  const navegar = useNavigate();
  const qc = useQueryClient();
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);
  /**
   * Crea otra sucursal a partir de esta.
   *
   * Sirve cuando la empresa abre un segundo local: en vez de rehacer horario, cupos, campos y
   * diseño, se copian y solo se ajusta lo que cambia. Abre la copia para renombrarla antes de
   * publicarla.
   */
  const duplicar = useMutation({
    mutationFn: () => api.post<ReservationForm>(`/reservations/forms/${id}/duplicate`, {}),
    onSuccess: (copia) => {
      void qc.invalidateQueries({ queryKey: ['reservation-forms'] });
      void qc.invalidateQueries({ queryKey: ['reservation-locals'] });
      triggerToast('Sucursal duplicada. Quedó en borrador.');
      navegar(`${base}/forms/${copia.id}`);
    },
  });
  const { data: local, isLoading, error, refetch } = useQuery<ReservationForm>({
    queryKey: ['reservation-local', id], queryFn: () => api.get(`/reservations/forms/${id}`), enabled: Boolean(id),
  });
  if (isLoading) return <LoadingSpinner text="Abriendo el local..." />;
  if (error || !local) return <QueryErrorState message={error?.message || 'No encontramos este local.'} onRetry={() => { void refetch(); }} />;
  const publicUrl = local.publicUrl || `/book/${local.publicSlug}`;
  const hasLogo = Boolean(local.designConfig?.logoUrl);
  const hasBackground = Boolean(local.designConfig?.backgroundImage);

  return <main className="reservation-local-hub">
    <header className="local-hub-hero">
      <div>
        <Link className="back-link" to={base}>← Sucursales</Link>
        <span className="page-eyebrow">SUCURSAL · {local.status === 'published' ? 'PUBLICADO' : local.status === 'paused' ? 'PAUSADO' : 'BORRADOR'}</span>
        <h1>{local.name}</h1>
        <p className="page-subtitle">{local.status === 'published' ? 'Canal publicado y listo para recibir reservas.' : 'Canal en borrador o pausado. Configúralo antes de compartirlo.'}</p>
      </div>
      <div className="portal-item-actions"><Link className="btn btn-primary" to={`${base}/forms/${id}/design?section=esencial`}>Configurar lo esencial</Link><a className="btn btn-outline" href={publicUrl} target="_blank" rel="noreferrer">Ver como cliente</a></div>
    </header>

    <section className="local-hub-section"><div><span className="page-eyebrow">GESTIONAR ESTA SUCURSAL</span><h2>Elige una tarea</h2><p>Todo lo que abras queda restringido a {local.name}. Las opciones detalladas aparecen dentro de cada tarea.</p></div><div className="local-hub-grid">
      <Link className="local-hub-card is-primary" to={`${base}/forms/${id}/design?section=esencial`}><span className="local-hub-icon">1</span><div><strong>Configurar la sucursal</strong><small>Horario, cupos, campos, logo, portada y publicación en un recorrido guiado.</small></div><b>Configurar</b></Link>
      <Link className="local-hub-card" to={`${base}?tab=bookings&clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">2</span><div><strong>Reservas</strong><small>Lista, detalle, filtros, exportación y cupones de este local.</small></div><b>Ver reservas</b></Link>
      <Link className="local-hub-card" to={`${base}/agenda?clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">3</span><div><strong>Agenda del día</strong><small>Disponibilidad, bloqueos, asistencia y solicitudes de grupos o eventos.</small></div><b>Abrir agenda</b></Link>
      <Link className="local-hub-card" to={`${base}/forms/${id}/design?section=ajustes`}><span className="local-hub-icon">4</span><div><strong>Zonas, avisos y textos legales</strong><small>Terrazas y salones, alergias y niños, correos del equipo, consentimientos y política de cancelación.</small></div><b>Abrir</b></Link>
    </div></section>

    <section className="local-hub-section"><div><span className="page-eyebrow">AJUSTES RÁPIDOS</span><h2>Lo que se toca a diario</h2><p>Cada enlace abre directamente el ajuste, sin recorrer el resto de la configuración.</p></div>
      <div className="portal-item-actions">
        <Link className="btn btn-outline btn-sm" to={`${base}/forms/${id}/design?section=disponibilidad`}>Horario, cupos y cierres</Link>
        <Link className="btn btn-outline btn-sm" to={`${base}/forms/${id}/design?section=ajustes`}>Pausar reservas</Link>
        <Link className="btn btn-outline btn-sm" to={`${base}/forms/${id}/design?section=ajustes`}>Zonas y preferencias</Link>
        <Link className="btn btn-outline btn-sm" to={`${base}?tab=coupons`}>Cupones</Link>
        <Link className="btn btn-outline btn-sm" to={`${base}/forms/${id}/design?section=publicar`}>Enlace y publicación</Link>
        {!clientMode && <button type="button" className="btn btn-outline btn-sm" disabled={duplicar.isPending} onClick={() => setConfirmarDuplicado(true)}>{duplicar.isPending ? 'Duplicando...' : 'Duplicar esta sucursal'}</button>}
      </div>
      {duplicar.error && <p className="error-text">{duplicar.error.message}</p>}
    </section>

    <section className="local-hub-status">
      <div><span className="page-eyebrow">PUBLICACIÓN</span><h2>Identidad y enlace</h2><p className="page-subtitle">La identidad es opcional: se puede publicar con la plantilla y personalizarla después.</p></div>
      <div className="reservation-metric-grid reservation-metric-grid-four"><div><span>Estado</span><strong>{local.status === 'published' ? 'Publicado' : local.status === 'paused' ? 'Pausado' : 'Borrador'}</strong></div><Link to={`${base}/forms/${id}/design?section=diseno`}><span>Logo</span><strong>{hasLogo ? 'Cambiar logo' : 'Agregar logo'}</strong></Link><Link to={`${base}/forms/${id}/design?section=diseno`}><span>Portada</span><strong>{hasBackground ? 'Cambiar portada' : 'Agregar portada'}</strong></Link>{clientMode ? <div><span>Medición</span><strong>{local.metaCapiEnabled || local.ga4MeasurementId ? 'Activa para esta sucursal' : 'No configurada'}</strong></div> : <Link to={`${base}/forms/${id}/design?section=medicion`}><span>Medición</span><strong>{local.metaCapiEnabled || local.ga4MeasurementId ? 'Revisar medición' : 'Configurar si la necesitas'}</strong></Link>}</div>
      <p className="page-subtitle">Enlace público: <code>{publicUrl}</code></p>
    </section>

    <ConfirmDialog
      open={confirmarDuplicado}
      title="Duplicar esta sucursal"
      description="Se copian horario, cupos, campos, zonas, servicios, diseño y ajustes de medición. No se copian las reservas, los bloqueos ni los cupones. La copia nace en borrador y con su propio enlace público, para que la renombres antes de publicarla."
      confirmLabel="Duplicar"
      onClose={() => setConfirmarDuplicado(false)}
      onConfirm={() => { setConfirmarDuplicado(false); duplicar.mutate(); }}
    />
  </main>;
}
