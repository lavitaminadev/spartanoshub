import { useState } from 'react';
import { industryLabel } from '@espartanos/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { hasRoleAccess } from '../../core/role-access';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { statusLabel } from '../../shared/status-labels';
import { getAllowedRolesForPath, isPathEnabled } from '../../core/navigation.registry';
import { isModuleInPhaseScope } from '../../core/phase-scope';
import { safeUrl } from '../../core/safe-url';
import { PageHero } from '../../shared/PageHero';

interface ClientOverview {
  client: {
    id: string;
    name: string;
    legalName?: string;
    industry?: string;
    status: string;
    retainerAmount?: number;
    currency?: string;
    defaultUdBudget?: number;
    communityManagerId?: string;
    driveFolderId?: string;
    whatsappGroup?: string;
    startedAt?: string;
    renewalAt?: string;
    /**
     * Lo que esta empresa tiene contratado. El servidor ya lo manda; faltaba leerlo.
     *
     * Los doce módulos cuyo sujeto es una empresa atendida nacen **apagados**, así que una clave
     * ausente es «no contratado» y no «no sé»: se comprueba con `=== true` y no con `!== false`.
     */
    capabilities?: Partial<Record<string, boolean>>;
  };
  stats: {
    pendingPieces: number;
    contentGrids: number;
    meetings: number;
    upcomingMeetings: number;
    documents: number;
    reservationForms: number;
    publishedForms: number;
    contracts: number;
    activeContracts: number;
    briefs: number;
    approvedBriefs: number;
  };
  ud: { contracted: number; reserved: number; consumed: number };
  pieceStatuses: Array<{ status: string; total: number }>;
  recentPieces: Array<{ id: string; title: string; status: string; deadlineAt?: string; udAmount?: number }>;
  recentMeetings: Array<{ id: string; title: string; type: string; status: string; scheduledAt?: string }>;
}

interface ManagerOption { id: string; name: string; role: string }
interface DriveResult { rootId: string; rootUrl: string; folders: Record<string, string> }

const quickLinks = [
  { to: '/contracts', label: 'Contratos', note: 'Vigencias y capacidad acordada' },
  { to: '/briefs', label: 'Briefs', note: 'Requerimientos y aprobaciones' },
  { to: '/onboarding', label: 'Onboarding', note: 'Alta y entregables iniciales' },
  { to: '/production', label: 'Producción', note: 'Piezas, responsables y fechas' },
  { to: '/content', label: 'Contenido', note: 'Grillas mensuales' },
  { to: '/meetings', label: 'Reuniones', note: 'Agenda y acuerdos' },
  { to: '/documents', label: 'Documentos', note: 'Drive y versiones' },
  { to: '/reservations', label: 'Reservas', note: 'Formularios y disponibilidad' },
];

function formatDate(value?: string) {
  if (!value) return 'Sin definir';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin definir' : date.toLocaleDateString('es-CL');
}

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const overviewQuery = useQuery<ClientOverview>({
    queryKey: ['client-overview', id],
    queryFn: () => api.get(`/clients/${id}/overview`),
    enabled: Boolean(id),
  });
  const managersQuery = useQuery<ManagerOption[]>({
    queryKey: ['client-manager-options'],
    queryFn: () => api.get('/clients/options/managers'),
    enabled: hasRoleAccess(user?.role, ['admin', 'commercial_director', 'operations_director', 'community_manager']),
  });
  const driveMutation = useMutation<DriveResult>({
    mutationFn: () => api.post(`/documents/drive/clients/${id}/bootstrap`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client-overview', id] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
  /*
   * El ajuste de lo contratado, declarado junto al resto de los hooks.
   *
   * Va aquí y no junto al panel que lo usa porque debajo hay dos salidas tempranas —cargando y
   * error—: declararlo después hace que React cuente cuatro hooks mientras carga y ocho cuando
   * llegan los datos, y la ficha revienta con «rendered more hooks than during the previous
   * render» justo al terminar de cargar. Sólo necesita `id`, que existe desde el primer dibujo.
   */
  const [ajustando, setAjustando] = useState(false);
  const [nuevasUd, setNuevasUd] = useState('');
  const [motivoDelAjuste, setMotivoDelAjuste] = useState('');
  const ajusteMutation = useMutation({
    mutationFn: (cuerpo: { contratadas: number; motivo: string }) => {
      const ahora = new Date();
      return api.patch('/design-budget/budget', {
        clientId: id, year: ahora.getFullYear(), month: ahora.getMonth() + 1, ...cuerpo,
      });
    },
    onSuccess: async () => {
      setAjustando(false);
      await queryClient.invalidateQueries({ queryKey: ['client-overview', id] });
    },
  });

  if (overviewQuery.isLoading) return <LoadingSpinner text="Preparando la ficha operativa..." />;
  if (overviewQuery.error || !overviewQuery.data) {
    return <div className="page"><div className="client-detail-error"><span>!</span><h1>No pudimos abrir esta ficha</h1><p>{overviewQuery.error?.message ?? 'El cliente no está disponible.'}</p><div><button className="btn btn-primary" onClick={() => overviewQuery.refetch()}>Reintentar</button><Link className="btn btn-outline" to="/clients">Volver a clientes</Link></div></div></div>;
  }

  const { client, stats, ud, pieceStatuses, recentPieces, recentMeetings } = overviewQuery.data;
  const manager = managersQuery.data?.find((item) => item.id === client.communityManagerId)?.name;
  const availableUd = Math.max(0, ud.contracted - ud.reserved - ud.consumed);
  const usedUd = ud.reserved + ud.consumed;
  const udPercent = ud.contracted > 0 ? Math.min(100, Math.round((usedUd / ud.contracted) * 100)) : 0;
  const canPrepareDrive = hasRoleAccess(user?.role, ['admin', 'operations_director']);
  const canManageClient = hasRoleAccess(user?.role, ['admin', 'commercial_director', 'operations_director']);
  // Un acceso hacia un módulo que el usuario no puede abrir termina en 404. Se filtra por lo
  // mismo que decide el menú —alcance de fase, módulo habilitado y permiso— para que la tarjeta
  // no exista si el destino no existe.
  const visibleQuickLinks = quickLinks.filter((item) => {
    const roles = getAllowedRolesForPath(item.to);
    const allowedByRole = !roles?.length || hasRoleAccess(user?.role, roles);
    return allowedByRole && isPathEnabled(item.to, user?.features, user?.permissions, user?.moduleLifecycle, user?.role, user?.capabilities);
  });
  /*
   * Módulos que alimentan los paneles de esta ficha: las **dos** rejas, no una.
   *
   * `isModuleInPhaseScope` dice si el producto entrega el módulo; `capabilities`, si **esta
   * empresa** lo tiene contratado. Faltaba la segunda, así que la ficha de un local sin Producción
   * mostraba igual su panel de piezas: un panel vacío que invita a preguntar por qué no hay nada,
   * cuando la respuesta es que ese servicio no se contrató.
   *
   * `=== true` y no `!== false`: los doce módulos de empresa nacen apagados, de modo que una clave
   * ausente significa «no contratado». Con `!== false` una empresa recién creada los vería todos.
   */
  const contratado = (modulo: string) => client.capabilities?.[modulo] === true;
  const showProduction = isModuleInPhaseScope('production', user?.moduleLifecycle) && contratado('production');
  const showMeetings = isModuleInPhaseScope('meetings', user?.moduleLifecycle) && contratado('meetings');
  const showDocuments = isModuleInPhaseScope('documents', user?.moduleLifecycle) && contratado('documents');
  /*
   * El presupuesto de UD no lleva capacidad, y es correcto que no la lleve.
   *
   * No está en `CAPACIDADES_DE_MODULO`: lo que se contrata son las UD mismas, y este panel es la
   * vista que la agencia tiene de ellas en la ficha del local. La capacidad que existe es
   * `budgetVisibility`, y decide otra cosa —si la empresa ve su saldo en **su** portal—, así que
   * usarla acá le escondería a la agencia el presupuesto que ella administra.
   */
  const showUdBudget = isModuleInPhaseScope('udBudget', user?.moduleLifecycle);
  /*
   * Ajustar lo contratado pide dirección de operaciones, no cualquiera que vea el panel.
   *
   * Cambia cuánto se le debe a la agencia ese mes, que es una decisión comercial y no un
   * movimiento de producción: quien asigna piezas reserva UD, pero no fija cuántas hay.
   */
  const puedeAjustarUd = user?.role === 'admin' || user?.role === 'operations_director';
  const driveUrl = safeUrl(driveMutation.data?.rootUrl || (client.driveFolderId ? `https://drive.google.com/drive/folders/${client.driveFolderId}` : ''));
  const readiness = [
    { label: 'Responsable operativo', ready: Boolean(client.communityManagerId), value: manager || (client.communityManagerId ? 'Asignado' : 'Pendiente') },
    { label: 'Estructura Google Drive', ready: Boolean(client.driveFolderId || driveMutation.data), value: driveUrl ? 'Carpeta preparada' : 'Pendiente' },
    { label: 'Contrato activo', ready: stats.activeContracts > 0, value: stats.activeContracts ? `${stats.activeContracts} activo` : 'Pendiente' },
    { label: 'Brief aprobado', ready: stats.approvedBriefs > 0, value: stats.approvedBriefs ? `${stats.approvedBriefs} aprobado` : 'Pendiente' },
  ];

  return (
    <div className="page client-360">
      <Link className="client-back" to="/clients">← Volver a clientes</Link>
      <PageHero
        variant="feature"
        tone="entity"
        eyebrow="FICHA OPERATIVA 360"
        title={client.name}
        badge={<StatusBadge status={client.status} />}
        subtitle={`${client.legalName || 'Razón social pendiente'}${client.industry ? ` · ${industryLabel(client.industry)}` : ''}`}
        actions={<>
          {driveUrl && <a className="btn btn-outline" href={driveUrl} target="_blank" rel="noreferrer">Abrir Drive</a>}
          <Link className="btn btn-accent" to="/clients">{canManageClient ? 'Administrar ficha' : 'Volver al listado'}</Link>
        </>}
        footer={<div className="client-contract-strip">
          <span><small>Retainer</small><strong>{client.retainerAmount ? `${client.currency || 'CLP'} ${Number(client.retainerAmount).toLocaleString('es-CL')}` : 'Sin registrar'}</strong></span>
          <span><small>Inicio</small><strong>{formatDate(client.startedAt)}</strong></span>
          <span><small>Renovación</small><strong>{formatDate(client.renewalAt)}</strong></span>
          <span><small>Responsable</small><strong>{manager || (client.communityManagerId ? 'Asignado' : 'Sin asignar')}</strong></span>
        </div>}
      />

      <section className="client-kpi-grid" aria-label="Resumen operativo">
        {showProduction && <article><span>Piezas activas</span><strong>{stats.pendingPieces}</strong><Link to="/production">Ver producción</Link></article>}
        {showMeetings && <article><span>Próximas reuniones</span><strong>{stats.upcomingMeetings}</strong><Link to="/meetings">Ver agenda</Link></article>}
        {showDocuments && <article><span>Documentos</span><strong>{stats.documents}</strong><Link to="/documents">Abrir repositorio</Link></article>}
        <article><span>Formularios publicados</span><strong>{stats.publishedForms}/{stats.reservationForms}</strong><Link to="/reservations">Gestionar reservas</Link></article>
      </section>

      <div className="client-main-grid">
        <section className="client-panel client-readiness">
          <header><div><span className="page-eyebrow">CONTROL DE CUENTA</span><h2>Preparación operativa</h2></div><strong>{readiness.filter((item) => item.ready).length}/4</strong></header>
          <div className="client-checklist">
            {readiness.map((item) => <div className={item.ready ? 'ready' : 'pending'} key={item.label}><i>{item.ready ? '✓' : '!'}</i><span><strong>{item.label}</strong><small>{item.value}</small></span></div>)}
          </div>
          {canPrepareDrive && !driveUrl && <button className="btn btn-primary" onClick={() => driveMutation.mutate()} disabled={driveMutation.isPending}>{driveMutation.isPending ? 'Preparando carpetas...' : 'Preparar estructura en Drive'}</button>}
          {driveMutation.error && <div className="alert alert-error">{driveMutation.error.message}</div>}
          {driveMutation.data && <div className="alert alert-success">Drive creado con {Object.keys(driveMutation.data.folders).length} carpetas operativas.</div>}
        </section>

        {showUdBudget && <section className="client-panel client-ud-panel">
          <header><div><span className="page-eyebrow">CAPACIDAD DEL MES</span><h2>Presupuesto UD</h2></div><strong>{udPercent}%</strong></header>
          <div className="client-ud-ring" style={{ '--ud-progress': `${udPercent * 3.6}deg` } as React.CSSProperties}><div><strong>{availableUd}</strong><small>UD disponibles</small></div></div>
          <div className="client-ud-legend"><span><i className="contracted" />Contratadas <b>{ud.contracted || client.defaultUdBudget || 0}</b></span><span><i className="reserved" />Reservadas <b>{ud.reserved}</b></span><span><i className="consumed" />Consumidas <b>{ud.consumed}</b></span></div>
          {!ud.contracted && <p className="client-panel-note">Aún no existe un presupuesto mensual abierto. El contrato base indica {client.defaultUdBudget || 0} UD.</p>}
          {/*
            El ajuste del mes, que no existía por ninguna parte.
            El trabajo mensual abre el presupuesto con el contrato base y nadie podía moverlo
            después: un mes con UD vendidas de más había que tocarlo en la base a mano.
          */}
          {puedeAjustarUd && ud.contracted > 0 ? (
            ajustando ? (
              <form
                className="client-ud-ajuste"
                onSubmit={(evento) => {
                  evento.preventDefault();
                  ajusteMutation.mutate({ contratadas: Number(nuevasUd), motivo: motivoDelAjuste.trim() });
                }}
              >
                <label>UD contratadas este mes
                  <input className="input" type="number" min={0} max={9999} step="0.5" value={nuevasUd} onChange={(evento) => setNuevasUd(evento.target.value)} />
                </label>
                <label>Por qué cambia
                  <input className="input" required minLength={5} maxLength={255} value={motivoDelAjuste} placeholder="Ej. Se vendieron 10 UD extra para el lanzamiento" onChange={(evento) => setMotivoDelAjuste(evento.target.value)} />
                </label>
                {/* No se puede bajar de lo comprometido: el trabajo ya está hecho o encargado. */}
                <small className="client-panel-note">Entre reservadas y consumidas hay {ud.reserved + ud.consumed} UD. No se puede dejar el contrato por debajo de eso.</small>
                {ajusteMutation.error && <div className="alert alert-error">{ajusteMutation.error.message}</div>}
                <div className="tabla-acciones">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={ajusteMutation.isPending || motivoDelAjuste.trim().length < 5}>{ajusteMutation.isPending ? 'Guardando…' : 'Guardar'}</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setAjustando(false)}>Cancelar</button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setNuevasUd(String(ud.contracted)); setMotivoDelAjuste(''); setAjustando(true); }}>Ajustar las UD del mes</button>
            )
          ) : null}
        </section>}
      </div>

      <section className="client-quick-section">
        <div className="section-heading"><div><span className="page-eyebrow">ACCESOS DE CUENTA</span><h2>Continuar trabajando</h2></div><p>Cada módulo conserva sus permisos y trazabilidad.</p></div>
        <div className="client-quick-grid">{visibleQuickLinks.map((item, index) => <Link to={`${item.to}?clientId=${client.id}`} key={item.to}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{item.label}</strong><small>{item.note}</small></span><i>→</i></Link>)}</div>
      </section>

      {(showProduction || showMeetings) && <div className="client-activity-grid">
        {showProduction && <section className="client-panel">
          <header><div><span className="page-eyebrow">PRODUCCIÓN</span><h2>Últimas piezas</h2></div><Link to="/production">Ver todas</Link></header>
          {recentPieces.length ? <div className="client-activity-list">{recentPieces.map((piece) => <article key={piece.id}><span><strong>{piece.title}</strong><small>{piece.deadlineAt ? `Entrega ${formatDate(piece.deadlineAt)}` : 'Sin fecha de entrega'} · {piece.udAmount ?? 0} UD</small></span><StatusBadge status={piece.status} /></article>)}</div> : <div className="client-empty"><strong>Sin producción registrada</strong><span>Las nuevas piezas aparecerán aquí.</span></div>}
          {pieceStatuses.length > 0 && <div className="client-status-flow">{pieceStatuses.map((item) => <span key={item.status}><b>{item.total}</b>{statusLabel(item.status)}</span>)}</div>}
        </section>}
        {showMeetings && <section className="client-panel">
          <header><div><span className="page-eyebrow">RELACIÓN</span><h2>Reuniones recientes</h2></div><Link to="/meetings">Ver agenda</Link></header>
          {recentMeetings.length ? <div className="client-activity-list">{recentMeetings.map((meeting) => <article key={meeting.id}><span><strong>{meeting.title}</strong><small>{formatDate(meeting.scheduledAt)} · {statusLabel(meeting.type)}</small></span><StatusBadge status={meeting.status} /></article>)}</div> : <div className="client-empty"><strong>Sin reuniones registradas</strong><span>Agenda una reunión para iniciar la trazabilidad.</span></div>}
        </section>}
      </div>}
    </div>
  );
}
