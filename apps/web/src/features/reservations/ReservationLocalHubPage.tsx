import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PanelCompartir } from '../../shared/PanelCompartir';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { triggerToast } from '../../shared/toast-events';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import type { ReservationForm } from './types';
import { AjustesDelDia } from './AjustesDelDia';
import { estadoDelCanal, loQueFaltaParaAbrir } from './preparacion-del-local';
import './reservation-local-hub.css';

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
  const [compartir, setCompartir] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  /**
   * Crea otra reserva de la misma empresa a partir de esta.
   *
   * Sirve cuando la empresa abre un segundo enlace: en vez de rehacer horario, cupos, campos y
   * diseño, se copian y solo se ajusta lo que cambia. Abre la copia para renombrarla antes de
   * publicarla.
   */
  const duplicar = useMutation({
    mutationFn: () => api.post<ReservationForm>(`/reservations/forms/${id}/duplicate`, {}),
    onSuccess: (copia) => {
      void qc.invalidateQueries({ queryKey: ['reservation-forms'] });
      void qc.invalidateQueries({ queryKey: ['reservation-locals'] });
      triggerToast('Reserva duplicada. Quedó en borrador.');
      navegar(`${base}/forms/${copia.id}`);
    },
  });
  const { data: local, isLoading, error, refetch } = useQuery<ReservationForm>({
    queryKey: ['reservation-local', id], queryFn: () => api.get(`/reservations/forms/${id}`), enabled: Boolean(id),
  });
  if (isLoading) return <LoadingSpinner text="Abriendo el local..." />;
  if (error || !local) return <QueryErrorState message={error?.message || 'No encontramos este local.'} onRetry={() => { void refetch(); }} />;
  const publicUrl = local.publicUrl || `/book/${local.publicSlug}`;
  const canal = estadoDelCanal(local);
  const requisitos = loQueFaltaParaAbrir(local);
  const pendientes = requisitos.filter((requisito) => !requisito.listo);
  const hasLogo = Boolean(local.designConfig?.logoUrl);
  const hasBackground = Boolean(local.designConfig?.backgroundImage);

  return <main className="reservation-local-hub">
    <header className="local-hub-cabecera">
      <div>
        <Link className="back-link" to={base}>← Reservas</Link>
        <h1>{local.name}<span className={`estado-sucursal ${canal.tono === 'abierto' ? '' : 'is-borrador'}`}>{canal.etiqueta}</span></h1>
        <p className="page-subtitle">{canal.detalle}</p>
      </div>
      <div className="portal-item-actions"><a className="btn btn-outline" href={publicUrl} target="_blank" rel="noreferrer">Ver como cliente ↗</a><button type="button" className="btn btn-primary" onClick={() => setCompartir(true)}>Compartir enlace</button></div>
    </header>

    <section className="local-hub-section"><div><span className="page-eyebrow">GESTIONAR ESTA RESERVA</span><h2>Elige una tarea</h2><p>Todo lo que abras queda restringido a {local.name}. Las opciones detalladas aparecen dentro de cada tarea.</p></div><div className="local-hub-grid">
      <Link className="local-hub-card is-primary" to={`${base}/forms/${id}/design?section=esencial`}><span className="local-hub-icon">1</span><div><strong>Configurar esta reserva</strong><small>Horario, cupos, campos, logo, portada y publicación en un recorrido guiado.</small></div><b>Configurar</b></Link>
      <Link className="local-hub-card" to={`${base}?tab=bookings&clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">2</span><div><strong>Reservas</strong><small>Lista, detalle, filtros, exportación y cupones de este local.</small></div><b>Ver reservas</b></Link>
      <Link className="local-hub-card" to={`${base}/agenda?clientId=${encodeURIComponent(local.clientId)}&formId=${encodeURIComponent(id)}`}><span className="local-hub-icon">3</span><div><strong>Agenda del día</strong><small>Disponibilidad, bloqueos, asistencia y solicitudes de grupos o eventos.</small></div><b>Abrir agenda</b></Link>
      <Link className="local-hub-card" to={`${base}/forms/${id}/design?section=ajustes`}><span className="local-hub-icon">4</span><div><strong>Datos del local y textos legales</strong><small>WhatsApp, correos del equipo, consentimientos y política de cancelación. Las zonas están en Disponibilidad.</small></div><b>Abrir</b></Link>
    </div></section>

    <section className="local-hub-section"><div><span className="page-eyebrow">AJUSTES RÁPIDOS</span><h2>Lo que se toca a diario</h2><p>Cupos, pausa, zonas y avisos se cambian aquí mismo, sin entrar a la configuración.</p></div>
      <div className="portal-item-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAjustesAbiertos(true)}>Ajustes del día</button>
        <Link className="btn btn-outline btn-sm" to={`${base}/forms/${id}/design?section=disponibilidad`}>Horario semanal</Link>
        <Link className="btn btn-outline btn-sm" to={`${base}?tab=coupons`}>Cupones</Link>
        <Link className="btn btn-outline btn-sm" to={`${base}/forms/${id}/design?section=publicar`}>Enlace y publicación</Link>
        {!clientMode && <button type="button" className="btn btn-outline btn-sm" disabled={duplicar.isPending} onClick={() => setConfirmarDuplicado(true)}>{duplicar.isPending ? 'Duplicando...' : 'Duplicar esta reserva'}</button>}
      </div>
      {/*
        * Por qué el enlace no recibe gente todavía, dicho donde se decide.
        *
        * Lo que falta está repartido entre cuatro pasos del constructor, así que averiguarlo
        * obligaba a recorrerlos. Publicada y completa, esta lista no aparece.
        */}
      {pendientes.length > 0 && <ul className="local-hub-requisitos">
        <li className="local-hub-requisitos-titulo">Falta para poder abrir el enlace</li>
        {requisitos.map((requisito) => <li key={requisito.clave} className={requisito.listo ? 'is-listo' : ''}>
          <strong>{requisito.listo ? 'Listo' : 'Falta'}</strong>
          <span>{requisito.nombre}<small>{requisito.detalle}</small></span>
        </li>)}
      </ul>}
      {duplicar.error && <p className="error-text">{duplicar.error.message}</p>}
    </section>

    <section className="local-hub-status">
      <div><span className="page-eyebrow">PUBLICACIÓN</span><h2>Identidad y enlace</h2><p className="page-subtitle">Logo y portada son opcionales, pero la portada es la imagen que aparece al compartir el enlace por WhatsApp o redes.</p></div>
      <div className="reservation-metric-grid reservation-metric-grid-four"><div><span>Estado</span><strong>{local.status === 'published' ? 'Publicado' : local.status === 'paused' ? 'Pausado' : 'Borrador'}</strong></div><Link to={`${base}/forms/${id}/design?section=diseno`}><span>Logo</span><strong>{hasLogo ? 'Cambiar logo' : 'Agregar logo'}</strong></Link><Link to={`${base}/forms/${id}/design?section=diseno`}><span>Portada</span><strong>{hasBackground ? 'Cambiar portada' : 'Agregar portada'}</strong></Link>{clientMode ? <div><span>Medición</span><strong>{local.metaCapiEnabled || local.ga4MeasurementId ? 'Activa para esta reserva' : 'No configurada'}</strong></div> : <Link to={`${base}/forms/${id}/design?section=medicion`}><span>Medición</span><strong>{local.metaCapiEnabled || local.ga4MeasurementId ? 'Revisar medición' : 'Configurar si la necesitas'}</strong></Link>}</div>
      <p className="page-subtitle local-hub-enlace">Enlace público: <code>{publicUrl}</code> <button type="button" className="btn btn-primary btn-sm" onClick={() => setCompartir(true)}>Compartir</button></p>
      <PanelCompartir abierto={compartir} titulo="Compartir reservas" nombre={local.name} urlBase={publicUrl} textoAbrir="Abrir página de reservas ↗" onCerrar={() => setCompartir(false)}
        pie={local.ga4MeasurementId || local.metaCapiEnabled ? 'La medición de esta reserva recibe cada alta con su canal y campaña.' : 'El canal y la campaña quedan en cada reserva y en Resultados, aunque no uses Google Analytics ni Meta.'} />
    </section>

    <AjustesDelDia abierto={ajustesAbiertos} onCerrar={() => setAjustesAbiertos(false)} local={local} base={base} />

    <ConfirmDialog
      open={confirmarDuplicado}
      title="Duplicar esta reserva"
      description="Se copian horario, cupos, campos, zonas, servicios, diseño y ajustes de medición. No se copian las reservas, los bloqueos ni los cupones. La copia nace en borrador y con su propio enlace público, para que la renombres antes de publicarla."
      confirmLabel="Duplicar"
      onClose={() => setConfirmarDuplicado(false)}
      onConfirm={() => { setConfirmarDuplicado(false); duplicar.mutate(); }}
    />
  </main>;
}
