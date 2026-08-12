/**
 * WorkDetailPage — Detalle de una pieza de producción.
 *
 * Reproduce la pantalla "WorkScreen" del prototipo (línea 424 de page.tsx) con:
 * - SourceChain (trazabilidad: Cliente → Brief → Solicitud → Pieza)
 * - WorkflowTimeline (etapas del flujo con estados)
 * - Tabs: Resumen, Archivos, Comentarios, Historial
 * - Sidebar con acciones y datos heredados
 *
 * Backend pendiente: GET /production/pieces/:id/detail
 * Mientras tanto usa la lista existente de piezas y el WorkflowTimeline como referencia visual.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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

interface PieceDetail {
  piece: Piece & { description?: string; campaign?: string; clientId?: string; assignedName?: string };
  sourceChain: Array<{ type: string; label: string; id?: string; name: string }>;
  requirements: Array<{ label: string; detail: string; completed: boolean }>;
  versions: Array<{ id: string; kind: string; name: string; metadata: string; status: string; fileUrl?: string; createdAt: string }>;
  comments: Array<{ id: string; author: string; text: string; createdAt: string }>;
  workflowStages: Array<{ name: string; owner: string }>;
  currentStageIndex: number;
  audit: Array<{ id: number; title: string; detail: string; actor: string; time: string; tone?: string }>;
}

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
  { key: 'comments', label: 'Comentarios' },
  { key: 'history', label: 'Historial' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export function WorkDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('summary');
  const [commentText, setCommentText] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const piecesQuery = useQuery<Piece[]>({ queryKey: ['pieces'], queryFn: () => api.get('/production/pieces') });
  const pieces = piecesQuery.data ?? [];
  const found = pieces.find((p) => p.id === id);

  const detailQuery = useQuery<PieceDetail>({
    queryKey: ['piece-detail', id],
    queryFn: () => api.get(`/production/pieces/${id}/detail`),
    enabled: !!id,
  });
  const detail = detailQuery.data;

  const piece = detail?.piece ?? found ?? null;
  const sourceChain = detail?.sourceChain ?? (
    piece ? [
      { type: 'client', label: 'Cliente', name: piece.clientName },
      { type: 'piece', label: 'Trabajo', name: piece.title },
    ] : []
  );
  const requirements = detail?.requirements ?? [];
  const versions = detail?.versions ?? [];
  const comments = detail?.comments ?? [];
  const audit = detail?.audit ?? [];
  const { stages, index: currentStageIndex } = buildWorkflowStages(piece);

  const readiness = requirements.length
    ? Math.round(requirements.filter((r) => r.completed).length / requirements.length * 100)
    : null;

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.post(`/production/pieces/${id}/comments`, { text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['piece-detail', id] }); setCommentText(''); setFeedback({ tone: 'success', text: 'Comentario publicado.' }); },
    onError: (e: Error) => setFeedback({ tone: 'error', text: e.message }),
  });

  const isLoading = (!found && piecesQuery.isLoading) || detailQuery.isLoading;
  const loadError = piecesQuery.error || detailQuery.error;

  if (isLoading) return <LoadingSpinner text="Abriendo detalle del trabajo..." />;
  if (loadError && !found && !detail) return <div className="page"><div className="alert alert-error">No se pudo cargar el detalle: {loadError.message}</div><Link to="/production" className="back-link">Volver a producción</Link></div>;
  if (!piece) return <EmptyState icon="🔍" title="Trabajo no encontrado" description="La pieza que buscas no existe o fue eliminada." action={<Link to="/production" className="btn btn-outline">Volver a producción</Link>} />;

  const canAdvance = user?.role !== 'client' && currentStageIndex < DEFAULT_WORKFLOW.length - 1;

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
        <button className="btn btn-outline btn-sm" onClick={() => setTab('comments')}>Comentar</button>
        {canAdvance && <button className="btn btn-primary btn-sm" onClick={() => setFeedback({ tone: 'error', text: 'El avance de etapa se conecta al backend pendiente.' })}>Avanzar estado</button>}
      </>}
      footer={<SourceChain links={sourceChain.map((s) => ({ label: s.label, value: s.name }))} />}
    />

    <WorkflowTimeline stages={stages} currentStage={currentStageIndex} onAdvance={canAdvance ? () => setFeedback({ tone: 'error', text: 'Avance pendiente de conexión al backend.' }) : undefined} />

    <nav className="work-tabs">
      {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>)}
    </nav>

    {feedback && <div className={`alert alert-${feedback.tone}`} style={{ marginTop: 12 }}>{feedback.text}</div>}

    <div className="work-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginTop: 16 }}>
      <section className="work-detail-main">
        {tab === 'summary' && <SummaryTab piece={piece} requirements={requirements} readiness={readiness} />}
        {tab === 'files' && <FilesTab versions={versions} />}
        {tab === 'comments' && <CommentsTab comments={comments} commentText={commentText} setCommentText={setCommentText} onPost={() => { if (commentText.trim()) commentMutation.mutate(commentText.trim()); }} pending={commentMutation.isPending} />}
        {tab === 'history' && <AuditLog entries={audit.map((e) => ({ id: String(e.id), title: e.title, detail: e.detail, actor: e.actor, time: e.time, tone: (e.tone as 'pink' | 'cyan' | 'amber' | undefined) }))} emptyMessage="Aún no hay movimientos registrados para este trabajo." />}
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
          <button key={i} className={`check-row ${r.completed ? 'checked' : 'pending'}`} onClick={() => {}}>
            <span className="check-box">{r.completed ? '✓' : '!'}</span>
            <span><b>{r.label}</b><small>{r.detail}</small></span>
            <em>{r.completed ? 'Completo' : 'Pendiente'}</em>
          </button>
        ))}
      </div>
    </section>}

    {requirements.length === 0 && <EmptyState icon="📋" title="Sin requerimientos" description="No hay checklist de control previo para este trabajo." />}
  </>;
}

function FilesTab({ versions }: { versions: Array<{ id: string; kind: string; name: string; metadata: string; status: string; fileUrl?: string; createdAt: string }> }) {
  if (!versions.length) return <EmptyState icon="📁" title="Sin archivos" description="No hay versiones de archivo para este trabajo todavía." />;
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

function CommentsTab({ comments, commentText, setCommentText, onPost, pending }: { comments: Array<{ id: string; author: string; text: string; createdAt: string }>; commentText: string; setCommentText: (v: string) => void; onPost: () => void; pending: boolean }) {
  return <>
    <div className="comment-list">
      {comments.length === 0 && <p className="page-subtitle" style={{ padding: '12px 0', color: 'var(--muted)' }}>Sin comentarios todavía.</p>}
      {comments.map((c) => (
        <article key={c.id}>
          <span className="comment-avatar">{c.author.trim().charAt(0).toUpperCase()}</span>
          <div>
            <header><b>{c.author}</b><small>{new Date(c.createdAt).toLocaleString('es-CL')}</small></header>
            <p>{c.text}</p>
          </div>
        </article>
      ))}
    </div>
    <div className="comment-box">
      <textarea className="input" rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escribí un comentario o nota interna..." />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" disabled={!commentText.trim() || pending} onClick={onPost}>{pending ? 'Publicando...' : 'Publicar'}</button>
      </div>
    </div>
  </>;
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
