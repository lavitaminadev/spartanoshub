import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../core/api';
import { KanbanBoard, type KanbanColumn } from '../../shared/KanbanBoard';
import { KpiCard } from '../../shared/KpiCard';
import { FilterBar } from '../../shared/FilterBar';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { Modal } from '../../shared/Modal';
import { matchesSearch } from '../../shared/search';

interface Opportunity {
  id: string;
  name: string;
  amount?: number;
  stage: string;
  probability: number;
  expectedCloseDate?: string;
  nextAction?: string;
  assignedTo?: string;
  clientId?: string;
  leadId?: string;
  lossReason?: string;
  createdAt: string;
}

interface UserOption { id: string; name: string }

/**
 * Etapas del pipeline comercial.
 *
 * Coinciden exactamente con las que ya usaba la vista de tabla y con los valores guardados en
 * `crm_opportunities.stage`. Cambiar una etiqueta acá es seguro; cambiar un `id` dejaría
 * huérfanos los tratos que ya tienen ese valor.
 */
const STAGES: KanbanColumn[] = [
  { id: 'new', label: 'Nuevo', accent: '#706a73' },
  { id: 'qualified', label: 'Calificado', accent: '#0fb9b1' },
  { id: 'proposal', label: 'Propuesta', accent: '#5b4b8a' },
  { id: 'negotiation', label: 'Negociación', accent: '#f0a202' },
  { id: 'won', label: 'Ganado', accent: '#0fb9b1' },
  { id: 'lost', label: 'Perdido', accent: '#b90749' },
];

/** Motivos de pérdida ofrecidos al cerrar un trato como perdido. */
const LOSS_REASONS = [
  'precio', 'competencia', 'sin_presupuesto', 'sin_respuesta',
  'fuera_de_alcance', 'mal_momento', 'otro',
];

const CURRENCY = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

/**
 * Pipeline comercial como tablero.
 *
 * Convive con la tabla de oportunidades en vez de reemplazarla: la tabla sigue siendo mejor
 * para revisar muchos tratos a la vez y para exportar, y el tablero para ver en qué etapa
 * está cada cosa y moverla.
 */
export function PipelineBoardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  /**
   * Trato que se está moviendo a "perdido".
   *
   * El motivo es obligatorio en el servidor, así que se pide antes de mandar el cambio: sin
   * esto, arrastrar a "Perdido" fallaba con un error de validación y la tarjeta volvía a su
   * sitio sin explicar por qué.
   */
  const [closingLost, setClosingLost] = useState<Opportunity | null>(null);
  const [lossReason, setLossReason] = useState(LOSS_REASONS[0]);
  const [lossNote, setLossNote] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ data: Opportunity[]; total: number }>({
    queryKey: ['crm-opportunities-board'],
    queryFn: () => api.get('/crm/opportunities?limit=200'),
  });

  const { data: usersResp } = useQuery<{ data: UserOption[] }>({
    queryKey: ['users-min'],
    queryFn: () => api.get('/users'),
  });

  const users = useMemo(() => usersResp?.data ?? [], [usersResp]);
  const userName = (id?: string) => users.find((user) => user.id === id)?.name;

  const move = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.put(`/crm/opportunities/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crm-opportunities-board'] });
      setFeedback({ tone: 'success', text: 'Trato actualizado' });
    },
    onError: (mutationError: Error) => {
      // Se revierte volviendo a pedir los datos: la tarjeta regresa sola a su columna real y
      // la pantalla no queda mostrando un estado que el servidor rechazó.
      void queryClient.invalidateQueries({ queryKey: ['crm-opportunities-board'] });
      setFeedback({ tone: 'error', text: mutationError.message || 'No se pudo mover el trato' });
    },
  });

  const opportunities = useMemo(() => {
    // El nombre se resuelve acá adentro y no con el ayudante de arriba para que la búsqueda
    // dependa de `users` de forma explícita: con el ayudante, cambiar de responsable no
    // recalculaba el filtro y la lista quedaba mostrando el resultado anterior.
    const nameOf = (id?: string) => users.find((user) => user.id === id)?.name;
    const rows = data?.data ?? [];
    return rows.filter((row) => {
      if (ownerFilter && row.assignedTo !== ownerFilter) return false;
      if (!search.trim()) return true;
      return matchesSearch(search, [row.name, row.nextAction, nameOf(row.assignedTo)]);
    });
  }, [data, search, ownerFilter, users]);

  const open = opportunities.filter((row) => row.stage !== 'won' && row.stage !== 'lost');
  const won = opportunities.filter((row) => row.stage === 'won');
  const lost = opportunities.filter((row) => row.stage === 'lost');
  const openValue = open.reduce((total, row) => total + Number(row.amount ?? 0), 0);
  const decided = won.length + lost.length;

  const handleMove = (opportunity: Opportunity, toStage: string) => {
    if (toStage === 'lost') {
      setClosingLost(opportunity);
      setLossReason(LOSS_REASONS[0]);
      setLossNote('');
      return;
    }
    move.mutate({ id: opportunity.id, body: { stage: toStage } });
  };

  const confirmLost = () => {
    if (!closingLost) return;
    move.mutate({
      id: closingLost.id,
      body: { stage: 'lost', lossReason, lossNote: lossNote.trim() || undefined },
    });
    setClosingLost(null);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="crm-scope is-agency">CRM de Espartanos</span>
          <span className="page-eyebrow">Pipeline</span>
          <h1>Tablero comercial</h1>
          <p className="page-subtitle">Arrastra un trato para moverlo de etapa. Cada movimiento queda registrado con su duración.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/crm/opportunities')}>
          Ver como tabla
        </button>
      </div>

      {feedback ? <div className={`alert alert-${feedback.tone === 'success' ? 'success' : 'error'}`}>{feedback.text}</div> : null}

      <div className="viz-stat-row">
        <KpiCard label="Tratos abiertos" value={open.length} hint="Sin cerrar" />
        <KpiCard label="Valor en juego" value={CURRENCY.format(openValue)} hint="Suma de tratos abiertos" />
        <KpiCard label="Ganados" value={won.length} hint="En el listado actual" />
        <KpiCard
          label="Tasa de cierre"
          value={decided ? `${Math.round((won.length / decided) * 100)}%` : '—'}
          hint={decided ? `${won.length} de ${decided} decididos` : 'Sin tratos cerrados aún'}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, acción o responsable"
        filters={[{
          key: 'owner',
          label: 'Responsable',
          options: users.map((user) => ({ value: user.id, label: user.name })),
          allLabel: 'Todos',
        }]}
        values={{ owner: ownerFilter }}
        onFilterChange={(_key, value) => setOwnerFilter(value)}
        onClear={() => { setSearch(''); setOwnerFilter(''); }}
      />

      <KanbanBoard
        columns={STAGES}
        items={opportunities}
        keyExtractor={(row) => row.id}
        columnOf={(row) => row.stage}
        onMove={handleMove}
        emptyMessage="Sin tratos"
        columnSummary={(_columnId, rows) => {
          const total = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
          return total > 0 ? CURRENCY.format(total) : '—';
        }}
        renderCard={(row) => (
          <>
            <strong className="kanban-card-title">{row.name}</strong>
            {row.amount ? <span className="kanban-card-amount">{CURRENCY.format(Number(row.amount))}</span> : null}
            <small className="kanban-card-meta">
              {userName(row.assignedTo) ?? 'Sin responsable'}
              {row.probability ? ` · ${row.probability}%` : ''}
            </small>
            {row.nextAction ? <small className="kanban-card-next">→ {row.nextAction}</small> : null}
            {row.stage === 'lost' && row.lossReason ? <small className="kanban-card-loss">{row.lossReason}</small> : null}
          </>
        )}
      />

      <Modal open={Boolean(closingLost)} onClose={() => setClosingLost(null)} title="Cerrar como perdido">
        <div className="modal-form">
          <p>Indica por qué se perdió “{closingLost?.name}”. Queda registrado en el historial del trato.</p>
          <label>
            Motivo
            <select className="input" value={lossReason} onChange={(event) => setLossReason(event.target.value)}>
              {LOSS_REASONS.map((reason) => <option key={reason} value={reason}>{reason.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label>
            Detalle (opcional)
            <textarea className="input" rows={3} value={lossNote} onChange={(event) => setLossNote(event.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setClosingLost(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={confirmLost}>Confirmar pérdida</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
