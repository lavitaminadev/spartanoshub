/**
 * WorkDetailPage — Detalle de una pieza de producción.
 *
 * Reproduce la pantalla "WorkScreen" del prototipo (línea 424 de page.tsx) con:
 * - SourceChain (trazabilidad: Cliente → Brief → Solicitud → Pieza)
 * - WorkflowTimeline (etapas del flujo con estados)
 * - Tabs: Resumen, Archivos, Historial
 * - Sidebar con acciones y datos heredados
 *
 * Se arma con tres lecturas que sí existen: la lista de piezas, las versiones cargadas y la
 * auditoría transversal filtrada por esta pieza. No hay un endpoint de «detalle» que las
 * devuelva juntas, y no hacía falta inventarlo para poder mostrarlas.
 *
 * La pestaña de comentarios se retiró: no hay dominio de comentarios en el backend y su
 * cuadro de texto ofrecía publicar algo que siempre fallaba.
 */

import { useState } from 'react';
import { hasRoleAccess } from '../../core/role-access';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { PageHero } from '../../shared/PageHero';
import { StatusBadge } from '../../shared/StatusBadge';
import { EmptyState } from '../../shared/EmptyState';
import { AuditLog } from '../../shared/components/AuditLog';
import { WorkflowTimeline } from '../../shared/components/WorkflowTimeline';
import type { WorkflowStage } from '../../shared/components/WorkflowTimeline';
import { SourceChain } from '../../shared/components/SourceChain';
import { ReadinessBar } from '../../shared/components/ReadinessBar';

interface Piece {
  id: string; title: string; type: string; status: string; udAmount: number;
  correctionCount: number; difficultyLevel?: number; clientName: string;
  assignedTo?: string; assignedName?: string; dueDate?: string;
  dependencyIds?: string[]; createdAt: string; assignedAt?: string;
}

interface PieceVersionRow {
  id: string; versionNumber: number; fileName: string; driveFileId?: string;
  stateLabel?: string; isFinal: boolean; namingValid?: boolean; createdAt: string;
}

interface AuditRow {
  id: string | number; action: string; reason?: string | null;
  actorName?: string | null; occurredAt: string;
}

/** Nombre legible de cada movimiento auditado de una pieza. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Pieza creada',
  updated: 'Pieza actualizada',
  assigned: 'Responsable asignado',
  deleted: 'Pieza eliminada',
};

type Feedback = { tone: 'success' | 'error'; text: string } | null;

const DEFAULT_WORKFLOW = [
  { name: 'Borrador', owner: 'CM' }, { name: 'Enviada', owner: 'CM' },
  { name: 'Validación', owner: 'Dirección' }, { name: 'Aceptada', owner: 'Dirección' },
  { name: 'Preproducción', owner: 'Productor' }, { name: 'Ejecución', owner: 'Equipo' },
  { name: 'Revisión interna', owner: 'Dirección' }, { name: 'Revisión cliente', owner: 'Cliente' },
  { name: 'Correcciones', owner: 'Editor' }, { name: 'Aprobada', owner: 'Dirección' },
  { name: 'Entregada', owner: 'CM' },
];

const STATUS_STAGE: Record<string, number> = {
  draft: 0, pending: 1, assigned: 2, in_progress: 3, internal_review: 4,
  client_review: 5, correction: 6, approved: 7, delivered: 8,
};

/**
 * Transición que corresponde al estado actual de la pieza.
 *
 * Reproduce el mismo mapa que ofrece el tablero (`ProductionPage`): un estado admite una sola
 * salida hacia adelante, y las que necesitan datos —asignar responsable, subir una versión—
 * no se resuelven desde acá porque piden un formulario propio. Devolver `null` es lo que
 * mantiene el botón fuera de la pantalla cuando no hay nada que avanzar.
 */
function nextTransition(status: string, role: string): { action: 'start' | 'send-to-client' | 'approve' | 'deliver'; label: string } | null {
  const canStart = hasRoleAccess(role, ['admin', 'art_director', 'operations_director', 'designer', 'audiovisual']);
  const canReview = hasRoleAccess(role, ['admin', 'art_director', 'operations_director']);
  if (canStart && status === 'assigned') return { action: 'start', label: 'Iniciar' };
  if (canStart && status === 'correction') return { action: 'start', label: 'Retomar' };
  if (canReview && status === 'internal_review') return { action: 'send-to-client', label: 'Enviar a cliente' };
  if (canReview && status === 'client_validation') return { action: 'approve', label: 'Aprobar' };
  if (canReview && status === 'approved') return { action: 'deliver', label: 'Entregar' };
  return null;
}

function buildWorkflowStages(piece?: Piece | null): { stages: WorkflowStage[]; index: number } {
  const current = piece?.status ?? 'draft';
  const idx = STATUS_STAGE[current] ?? 0;
  const stages: WorkflowStage[] = DEFAULT_WORKFLOW.map((s, i) => ({
    name: s.name, owner: s.owner,
    status: i < idx ? 'done' : i === idx ? 'current' : 'pending',
  }));
  return { stages, index: idx };
}

const TABS = [
  { key: 'summary', label: 'Resumen' },
  { key: 'files', label: 'Archivos' },
  { key: 'history', label: 'Historial' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export function WorkDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('summary');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const piecesQuery = useQuery<Piece[]>({ queryKey: ['pieces'], queryFn: () => api.get('/production/pieces') });
  const pieces = piecesQuery.data ?? [];
  const found = pieces.find((p) => p.id === id);

  const piece = found ?? null;
  const sourceChain = piece
    ? [
      { type: 'client', label: 'Cliente', name: piece.clientName },
      { type: 'piece', label: 'Trabajo', name: piece.title },
    ]
    : [];
  const versionsQuery = useQuery<PieceVersionRow[]>({
    queryKey: ['piece-versions', id],
    queryFn: () => api.get(`/production/pieces/${id}/versions`),
    enabled: Boolean(id),
  });
  // La auditoría es transversal y ya guarda los movimientos de cada pieza bajo `piece`; no
  // hace falta un historial propio del módulo para poder mostrarlos.
  const auditQuery = useQuery<AuditRow[]>({
    queryKey: ['piece-audit', id],
    queryFn: () => api.get(`/audit?entityType=piece&entityId=${encodeURIComponent(id)}&limit=100`),
    enabled: Boolean(id),
  });

  const versions = (versionsQuery.data ?? []).map((row) => ({
    id: row.id,
    kind: row.isFinal ? 'FINAL' : `V${row.versionNumber}`,
    name: row.fileName,
    metadata: [row.stateLabel, new Date(row.createdAt).toLocaleDateString('es-CL')].filter(Boolean).join(' · '),
    status: row.namingValid === false ? 'Nombre fuera de norma' : 'Cargada',
    fileUrl: row.driveFileId ? `https://drive.google.com/file/d/${row.driveFileId}/view` : undefined,
    createdAt: row.createdAt,
  }));
  const audit = (auditQuery.data ?? []).map((row) => ({
    id: String(row.id),
    title: AUDIT_ACTION_LABELS[row.action] ?? row.action,
    detail: row.reason ?? '',
    actor: row.actorName ?? 'Sistema',
    time: new Date(row.occurredAt).toLocaleString('es-CL'),
  }));
  // Los requerimientos no tienen origen en la API: se dejan vacíos en vez de inventarlos.
  const requirements: Array<{ label: string; detail: string; completed: boolean }> = [];
  const readiness: number | null = null;
  const { stages, index: currentStageIndex } = buildWorkflowStages(piece);

  const transition = piece ? nextTransition(piece.status, user?.role ?? '') : null;
  const transitionMutation = useMutation({
    mutationFn: (action: string) => api.post(`/production/pieces/${id}/${action}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pieces'] }); setFeedback({ tone: 'success', text: 'El trabajo avanzó de etapa.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const isLoading = !found && piecesQuery.isLoading;
  const loadError = piecesQuery.error;

  if (isLoading) return <LoadingSpinner text="Abriendo detalle del trabajo..." />;
  if (loadError && !found) return <div className="page"><div className="alert alert-error">No se pudo cargar el detalle: {loadError.message}</div><Link to="/production" className="back-link">Volver a producción</Link></div>;
  if (!piece) return <EmptyState icon="search" title="Trabajo no encontrado" description="La pieza que buscas no existe o fue eliminada." action={<Link to="/production" className="btn btn-outline">Volver a producción</Link>} />;

  const advance = () => { if (transition) transitionMutation.mutate(transition.action); };

  return <div className="page">
    <Link to="/production" className="back-link">← Volver a producción</Link>

    <PageHero
      eyebrow={`${piece.id} · ${DEFAULT_WORKFLOW[currentStageIndex]?.name.toUpperCase() ?? piece.status.toUpperCase()}`}
      title={piece.title}
      subtitle={`${piece.clientName}${piece.assignedName ? ` · ${piece.assignedName}` : ''}${piece.correctionCount > 0 ? ` · ${piece.correctionCount} corrección${piece.correctionCount !== 1 ? 'es' : ''}` : ''}`}
      variant="feature"
      tone="entity"
      badge={<StatusBadge status={piece.status} />}
      actions={<>
        {transition && <button className="btn btn-primary btn-sm" disabled={transitionMutation.isPending} onClick={advance}>{transitionMutation.isPending ? 'Avanzando...' : transition.label}</button>}
      </>}
      footer={<SourceChain links={sourceChain.map((s) => ({ label: s.label, value: s.name }))} />}
    />

    <WorkflowTimeline stages={stages} currentStage={currentStageIndex} onAdvance={transition ? advance : undefined} />

    <nav className="work-tabs">
      {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>)}
    </nav>

    {feedback && <div className={`alert alert-${feedback.tone}`} style={{ marginTop: 12 }}>{feedback.text}</div>}

    <div className="work-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginTop: 16 }}>
      <section className="work-detail-main">
        {tab === 'summary' && <SummaryTab piece={piece} requirements={requirements} readiness={readiness} />}
        {tab === 'files' && <FilesTab versions={versions} />}
        {tab === 'history' && <AuditLog entries={audit} emptyMessage="Aún no hay movimientos registrados para este trabajo." />}
      </section>

      <aside className="work-context">
        <ContextSidebar piece={piece} readiness={readiness} nextStage={DEFAULT_WORKFLOW[currentStageIndex + 1]} />
      </aside>
    </div>
  </div>;
}

function SummaryTab({ piece, requirements, readiness }: { piece: Piece; requirements: Array<{ label: string; detail: string; completed: boolean }>; readiness: number | null }) {
  return <>
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="section-heading"><h2>Ficha del trabajo</h2></div>
      <div className="info-grid">
        <div><span>ID</span><b>{piece.id}</b></div>
        <div><span>Tipo</span><b>{piece.type}</b></div>
        <div><span>UD</span><b>{piece.udAmount}</b></div>
        <div><span>Dificultad</span><b>{piece.difficultyLevel ?? '—'}</b></div>
        <div><span>Creado</span><b>{new Date(piece.createdAt).toLocaleDateString('es-CL')}</b></div>
        <div><span>Entrega</span><b>{piece.dueDate ? new Date(piece.dueDate).toLocaleDateString('es-CL') : 'Sin fecha'}</b></div>
      </div>
    </section>

    {requirements.length > 0 && <section className="card">
      <div className="section-heading">
        <div><span className="page-eyebrow">CONTROL PREVIO</span><h2>Requerimientos</h2></div>
        {readiness != null && <ReadinessBar percent={readiness} variant="pill" />}
      </div>
      <div className="checklist">
        {requirements.map((r, i) => (
          <article key={i} className={`check-row ${r.completed ? 'checked' : 'pending'}`}>
            <span className="check-box">{r.completed ? '✓' : '!'}</span>
            <span><b>{r.label}</b><small>{r.detail}</small></span>
            <em>{r.completed ? 'Completo' : 'Pendiente'}</em>
          </article>
        ))}
      </div>
    </section>}

    {requirements.length === 0 && <EmptyState icon="checklist" title="Sin requerimientos" description="No hay checklist de control previo para este trabajo." />}
  </>;
}

function FilesTab({ versions }: { versions: Array<{ id: string; kind: string; name: string; metadata: string; status: string; fileUrl?: string; createdAt: string }> }) {
  if (!versions.length) return <EmptyState icon="folder" title="Sin archivos" description="No hay versiones de archivo para este trabajo todavía." />;
  return <div className="file-list">
    {versions.map((v) => (
      <article key={v.id}>
        <span className="file-kind">{v.kind}</span>
        <span><b>{v.name}</b><small>{v.metadata}</small></span>
        <span className="file-status">{v.status}</span>
        {v.fileUrl ? <a href={v.fileUrl} target="_blank" rel="noreferrer"><button type="button">Ver</button></a> : <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sin enlace</span>}
      </article>
    ))}
  </div>;
}

function ContextSidebar({ piece, readiness, nextStage }: { piece: Piece; readiness: number | null; nextStage?: { name: string; owner: string } }) {
  return <>
    <div className="context-card emphasis">
      <span className="context-label">SIGUIENTE ACCIÓN</span>
      {readiness != null && readiness < 100
        ? <><b style={{ fontSize: 14, color: 'var(--ink)' }}>Completar requerimientos</b><p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>{readiness}% completado. Falta información antes de avanzar.</p></>
        : nextStage
          ? <><b style={{ fontSize: 14, color: 'var(--ink)' }}>Avanzar a {nextStage.name}</b><p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>Responsable: {nextStage.owner}</p></>
          : <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>Flujo completado.</p>}
    </div>
    <div className="context-card">
      <span className="context-label">RESPONSABLE</span>
      <div className="context-line"><b>{piece.assignedName ?? 'Sin asignar'}</b><small>{piece.assignedName ? 'Asignado' : 'Pendiente de asignación'}</small></div>
    </div>
    <div className="context-card">
      <span className="context-label">ENTREGA</span>
      <div className="context-line">
        <b>{piece.dueDate ? new Date(piece.dueDate).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sin fecha'}</b>
        {piece.dueDate && new Date(piece.dueDate) <= new Date() && <small className="amber-text">Vence hoy o está vencido</small>}
      </div>
    </div>
    <div className="context-card compact">
      <span className="context-label">DATOS DEL TRABAJO</span>
      <div className="context-line"><span>UD</span><b>{piece.udAmount}</b></div>
      <div className="context-line"><span>Correcciones</span><b>{piece.correctionCount}</b></div>
      <div className="context-line"><span>Creado</span><small>{new Date(piece.createdAt).toLocaleDateString('es-CL')}</small></div>
      {piece.assignedAt && <div className="context-line"><span>Asignado</span><small>{new Date(piece.assignedAt).toLocaleDateString('es-CL')}</small></div>}
    </div>
  </>;
}
