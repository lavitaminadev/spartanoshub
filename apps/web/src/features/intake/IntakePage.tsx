import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { Modal } from '../../shared/Modal';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import {
  AREAS, CREATIVE_FIELDS, PRIORITIES, STATUS_LABELS,
  compactValues, missingCreativeFields, type AreaValue, type IntakeField,
} from './intake-fields';

/**
 * Piezas gráficas que se pueden crear al convertir. **Solo para el área de diseño.**
 *
 * Coincide con `PieceType` del backend. Ninguna de estas es audiovisual: «portada de reel» es
 * la imagen fija que lleva el reel, no el rodaje.
 */
const PIECE_TYPES: Array<[string, string]> = [
  ['post_simple', 'Post simple'],
  ['post_author', 'Post de autor'],
  ['carousel', 'Carrusel'],
  ['story_original', 'Historia original'],
  ['story_adapted', 'Historia adaptada'],
  ['story_template', 'Historia con plantilla'],
  ['reel_cover', 'Portada de reel'],
  ['flyer_digital', 'Flyer digital'],
  ['flyer_print', 'Flyer para impresión'],
];

/** Tipos de sesión de rodaje. **Solo para el área audiovisual.** */
const SESSION_TYPES: Array<[string, string]> = [
  ['reel', 'Reel'],
  ['video', 'Video'],
  ['sesion_foto', 'Sesión de fotos'],
  ['cobertura', 'Cobertura de evento'],
];

/** Columnas del tablero. Las dos terminales van juntas: cerradas no se trabajan. */
const COLUMNS: Array<{ statuses: string[]; label: string }> = [
  { statuses: ['new'], label: 'Nuevas' },
  { statuses: ['in_review'], label: 'En revisión' },
  { statuses: ['accepted'], label: 'Aceptadas' },
  { statuses: ['converted', 'rejected'], label: 'Cerradas' },
];

interface WorkRequest {
  id: string;
  code: string;
  clientId: string;
  area: AreaValue;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  neededBy?: string | null;
  assignedTo?: string | null;
  rejectionReason?: string | null;
  creativeFields?: Record<string, string> | null;
  /** Diseño: piezas gráficas creadas al convertir. */
  pieceIds?: string[] | null;
  /** Audiovisual: sesión de rodaje agendada al convertir. Nunca conviven con `pieceIds`. */
  sessionId?: string | null;
  createdAt: string;
  client?: { id: string; name: string };
  requester?: { id: string; name: string };
  assignee?: { id: string; name: string } | null;
}

interface Option { id: string; name: string; role?: string }

const EMPTY_FORM = {
  clientId: '',
  area: 'design' as AreaValue,
  title: '',
  description: '',
  priority: 'normal',
  neededBy: '',
};

/** Roles que coordinan la producción: asignan, aceptan y convierten. */
const COORDINATOR_ROLES = ['admin', 'operations_director', 'art_director', 'av_director'];

function errorMessage(error: Error): string {
  return error.message || 'No se pudo completar la operación.';
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '';
}

/** Días desde que se abrió la solicitud. Es el número que discute la reunión de lunes. */
function ageInDays(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export function IntakePage() {
  const currentUser = useAuth((state) => state.user);
  const role = currentUser?.role ?? '';
  const canCoordinate = COORDINATOR_ROLES.includes(role);
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creative, setCreative] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [areaFilter, setAreaFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  const [detail, setDetail] = useState<WorkRequest | null>(null);
  const [rejectFor, setRejectFor] = useState<WorkRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [convertFor, setConvertFor] = useState<WorkRequest | null>(null);
  /** Destino de una solicitud de diseño: una o más piezas gráficas. */
  const [pieces, setPieces] = useState<Array<{ title: string; type: string }>>([]);
  /** Destino de una solicitud audiovisual: una sesión de rodaje. */
  const [session, setSession] = useState({ type: 'reel', date: '', location: '', team: [] as string[] });

  const params = new URLSearchParams();
  if (areaFilter) params.set('area', areaFilter);
  if (clientFilter) params.set('clientId', clientFilter);
  if (onlyMine) params.set('mine', 'true');
  const suffix = params.size ? `?${params}` : '';

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ data: WorkRequest[]; total: number }>({
    queryKey: ['work-requests', areaFilter, clientFilter, onlyMine],
    queryFn: () => api.get(`/intake/requests${suffix}`),
  });

  const { data: clientsResp } = useQuery<{ data: Option[] }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });
  const clients = clientsResp?.data ?? [];

  /*
   * Una lista de responsables por área, no una sola para las tres.
   *
   * Diseño y audiovisual son flujos distintos con gente distinta: un diseñador no cubre un
   * rodaje. Con una lista única, asignar una sesión de fotos a un diseñador era un clic tan
   * fácil como el correcto.
   */
  const assigneeQueries = useQueries({
    queries: AREAS.map((area) => ({
      queryKey: ['intake-assignees', area.value],
      queryFn: () => api.get<Option[]>(`/intake/requests/options/assignees?area=${area.value}`),
      enabled: canCoordinate,
    })),
  });

  const assigneesByArea = useMemo(
    () => Object.fromEntries(AREAS.map((area, index) => [area.value, assigneeQueries[index]?.data ?? []])) as Record<AreaValue, Option[]>,
    [assigneeQueries],
  );

  const requests = useMemo(() => data?.data ?? [], [data]);

  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['work-requests'] });
    setFeedback(message);
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/intake/requests', body),
    onSuccess: (created: unknown) => {
      const code = (created as WorkRequest)?.code ?? '';
      void refresh(`Solicitud ${code} abierta. Operaciones la revisa y te avisa.`);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setCreative({});
    },
    onError: (err: Error) => setFormError(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/intake/requests/${id}`, body),
    onSuccess: () => {
      void refresh('Solicitud actualizada.');
      setRejectFor(null);
      setRejectReason('');
      setDetail(null);
    },
    onError: (err: Error) => setFeedback(`Error: ${errorMessage(err)}`),
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.post(`/intake/requests/${id}/convert`, body),
    onSuccess: () => {
      void refresh(convertFor?.area === 'audiovisual' ? 'Sesión agendada en el calendario audiovisual.' : 'Solicitud convertida. Las piezas ya están en el tablero de producción.');
      setConvertFor(null);
      setPieces([]);
    },
    onError: (err: Error) => setFeedback(`Error: ${errorMessage(err)}`),
  });

  const submitCreate = () => {
    setFormError(null);
    if (!form.clientId) return setFormError('Elige la cuenta para la que es el trabajo.');
    if (form.title.trim().length < 4) return setFormError('Pon un título que se entienda sin abrir la solicitud.');
    const missing = missingCreativeFields(form.area, creative);
    if (missing.length) return setFormError(`Falta completar: ${missing.join(', ')}.`);

    createMutation.mutate({
      clientId: form.clientId,
      area: form.area,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      neededBy: form.neededBy || undefined,
      creativeFields: compactValues(creative),
    });
  };

  /**
   * Cada área desemboca en un flujo distinto, así que se envía un cuerpo distinto.
   *
   * Diseño crea piezas gráficas; audiovisual agenda **una** sesión de rodaje, que es un día de
   * trabajo con un equipo en una locación y no tiene tipo gráfico ni consume unidades de
   * dedicación. El backend rechaza el campo que no corresponde al área.
   */
  const submitConvert = () => {
    if (!convertFor) return;

    if (convertFor.area === 'audiovisual') {
      if (!session.date) return setFeedback('Error: la sesión necesita una fecha de rodaje.');
      return convertMutation.mutate({
        id: convertFor.id,
        body: {
          session: {
            type: session.type,
            date: session.date,
            location: session.location.trim() || undefined,
            assignedTeam: session.team.length ? session.team : undefined,
          },
        },
      });
    }

    const valid = pieces.filter((piece) => piece.title.trim().length >= 3);
    if (!valid.length) return setFeedback('Error: indica al menos una pieza con título.');
    convertMutation.mutate({ id: convertFor.id, body: { pieces: valid.map((piece) => ({ title: piece.title.trim(), type: piece.type })) } });
  };

  /** Abre el diálogo de conversión con los valores iniciales que corresponden al área. */
  const openConvert = (request: WorkRequest) => {
    setConvertFor(request);
    if (request.area === 'audiovisual') {
      const fields = request.creativeFields ?? {};
      setSession({
        // Lo que ya declaró quien pidió no se vuelve a preguntar.
        type: String(fields.tipoAudiovisual ?? 'reel'),
        date: String(fields.fechaGrabacion ?? request.neededBy?.slice(0, 10) ?? ''),
        location: String(fields.locacion ?? ''),
        team: request.assignedTo ? [request.assignedTo] : [],
      });
      setPieces([]);
      return;
    }
    setPieces([{ title: request.title, type: 'post_simple' }]);
  };

  const renderField = (field: IntakeField) => {
    const value = creative[field.name] ?? '';
    const onChange = (next: string) => setCreative((current) => ({ ...current, [field.name]: next }));
    return (
      <label className="intake-field" key={field.name}>
        <span>{field.label}{field.required && <i aria-hidden="true"> *</i>}</span>
        {field.type === 'textarea' ? (
          <textarea className="input" rows={3} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : field.type === 'select' ? (
          <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Sin definir</option>
            {field.options?.map(([option, label]) => <option key={option} value={option}>{label}</option>)}
          </select>
        ) : (
          <input className="input" type={field.type === 'date' ? 'date' : 'text'} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
        )}
        {field.help && <small>{field.help}</small>}
      </label>
    );
  };

  const cardActions = (request: WorkRequest) => {
    if (!canCoordinate) return null;
    const move = (status: string) => updateMutation.mutate({ id: request.id, body: { status } });
    return (
      <div className="kanban-card-actions">
        {request.status === 'new' && <button className="btn btn-sm btn-outline" onClick={() => move('in_review')}>Revisar</button>}
        {request.status === 'in_review' && <button className="btn btn-sm btn-primary" onClick={() => move('accepted')}>Aceptar</button>}
        {request.status === 'accepted' && request.area !== 'community' && (
          <button className="btn btn-sm btn-primary" onClick={() => openConvert(request)}>
            {request.area === 'audiovisual' ? 'Agendar sesión' : 'Convertir en piezas'}
          </button>
        )}
        {['new', 'in_review', 'accepted'].includes(request.status) && (
          <button className="btn btn-sm btn-outline" onClick={() => { setRejectFor(request); setRejectReason(''); }}>Rechazar</button>
        )}
      </div>
    );
  };

  if (isLoading) return <LoadingSpinner text="Cargando solicitudes..." />;
  if (error) return <QueryErrorState title="No pudimos cargar las solicitudes" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Solicitudes</h1>
          <p className="page-subtitle">La única puerta de entrada al trabajo de producción.</p>
        </div>
        <div className="portal-item-actions">
          <select className="input" aria-label="Filtrar por área" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
            <option value="">Todas las áreas</option>
            {AREAS.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}
          </select>
          <select className="input" aria-label="Filtrar por cuenta" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">Todas las cuentas</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <label className="intake-toggle">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Solo lo mío
          </label>
          <button className="btn btn-primary" onClick={() => { setFeedback(null); setFormError(null); setCreateOpen(true); }}>
            Nueva solicitud
          </button>
        </div>
      </div>
      <div className="process-line" style={{ marginBottom: 16 }}>
        <span><b>1</b>Solicitud</span><span><b>2</b>Revisión</span><span><b>3</b>Asignación</span><span><b>4</b>Producción</span><span><b>5</b>Entrega</span>
      </div>

      {feedback && (
        <div className={`alert ${feedback.startsWith('Error:') ? 'alert-error' : 'alert-success'}`} role="alert">{feedback}</div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Sin solicitudes"
          description="Cuando alguien pida trabajo aparece acá, con su cuenta, su plazo y quién lo pidió."
          action={<button className="btn btn-primary" onClick={() => setCreateOpen(true)}>Nueva solicitud</button>}
        />
      ) : (
        <div className="production-board intake-board">
          {COLUMNS.map((column) => {
            const columnRequests = requests.filter((request) => column.statuses.includes(request.status));
            return (
              <section className="kanban-column" key={column.label}>
                <div className="kanban-header"><strong>{column.label}</strong><span className="kanban-count">{columnRequests.length}</span></div>
                <div className="kanban-cards">
                  {columnRequests.length === 0 ? <div className="kanban-empty">Sin solicitudes</div> : columnRequests.map((request) => {
                    const area = AREAS.find((candidate) => candidate.value === request.area);
                    return (
                      <article className={`kanban-card intake-card priority-${request.priority}`} key={request.id}>
                        <header className="intake-card-head">
                          <span className="intake-code">{request.code}</span>
                          <span className={`intake-area area-${request.area}`}>{area?.icon} {area?.label ?? request.area}</span>
                        </header>
                        <button className="intake-card-title" onClick={() => setDetail(request)}>{request.title}</button>
                        <div className="kanban-card-client">{request.client?.name ?? 'Cuenta'}</div>
                        <div className="kanban-card-metrics">
                          <span>{PRIORITIES.find(([value]) => value === request.priority)?.[1] ?? request.priority}</span>
                          <span>{ageInDays(request.createdAt)} d</span>
                          {request.neededBy && <span>Para {formatDate(request.neededBy)}</span>}
                        </div>
                        <div className="kanban-card-info">
                          {request.assignee?.name ? `Responsable: ${request.assignee.name}` : 'Sin responsable'}
                        </div>
                        {canCoordinate && !['converted', 'rejected'].includes(request.status) && (
                          <select
                            className="input intake-assign"
                            aria-label={`Responsable de ${request.code}`}
                            value={request.assignedTo ?? ''}
                            onChange={(e) => updateMutation.mutate({ id: request.id, body: { assignedTo: e.target.value } })}
                          >
                            <option value="">Sin responsable</option>
                            {assigneesByArea[request.area].map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                          </select>
                        )}
                        {request.status === 'rejected' && request.rejectionReason && (
                          <p className="intake-rejection">Rechazada: {request.rejectionReason}</p>
                        )}
                        {request.status === 'converted' && (
                          <p className="intake-converted">
                            {request.sessionId ? 'Sesión agendada' : `${request.pieceIds?.length ?? 0} pieza(s) en producción`}
                          </p>
                        )}
                        {cardActions(request)}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva solicitud de trabajo">
        <div className="intake-form">
          <p className="intake-form-intro">
            Un solo formulario para las tres áreas. Elige el área y aparecen los campos que esa área necesita
            para no tener que preguntarte después.
          </p>

          <div className="intake-area-picker" role="radiogroup" aria-label="Área que ejecuta el trabajo">
            {AREAS.map((area) => (
              <button
                key={area.value}
                type="button"
                role="radio"
                aria-checked={form.area === area.value}
                className={`intake-area-option ${form.area === area.value ? 'is-selected' : ''}`}
                onClick={() => { setForm((current) => ({ ...current, area: area.value })); setCreative({}); }}
              >
                <span aria-hidden="true">{area.icon}</span>
                <strong>{area.label}</strong>
                <small>{area.hint}</small>
              </button>
            ))}
          </div>

          <div className="intake-grid">
            <label className="intake-field">
              <span>Cuenta <i aria-hidden="true">*</i></span>
              <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">Elige la cuenta</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label className="intake-field">
              <span>Prioridad</span>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="intake-field">
              <span>Para cuándo</span>
              <input className="input" type="date" value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} />
              <small>Cuándo lo necesitas. El plazo de producción lo pone Operaciones.</small>
            </label>
          </div>

          <label className="intake-field">
            <span>Título <i aria-hidden="true">*</i></span>
            <input className="input" value={form.title} placeholder="Carrusel de la promo de martes" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>

          <label className="intake-field">
            <span>Descripción</span>
            <textarea className="input" rows={3} value={form.description} placeholder="Qué hay que hacer y por qué." onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>

          <fieldset className="intake-section">
            <legend>{AREAS.find((area) => area.value === form.area)?.label}</legend>
            <div className="intake-grid">{CREATIVE_FIELDS[form.area].map(renderField)}</div>
          </fieldset>

          {formError && <div className="alert alert-error" role="alert">{formError}</div>}

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Abriendo...' : 'Abrir solicitud'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `${detail.code} · ${detail.title}` : ''}>
        {detail && (
          <div className="intake-detail">
            <dl>
              <div><dt>Cuenta</dt><dd>{detail.client?.name ?? '—'}</dd></div>
              <div><dt>Área</dt><dd>{AREAS.find((area) => area.value === detail.area)?.label ?? detail.area}</dd></div>
              <div><dt>Estado</dt><dd>{STATUS_LABELS[detail.status] ?? detail.status}</dd></div>
              <div><dt>Prioridad</dt><dd>{PRIORITIES.find(([value]) => value === detail.priority)?.[1] ?? detail.priority}</dd></div>
              <div><dt>La pidió</dt><dd>{detail.requester?.name ?? '—'}</dd></div>
              <div><dt>Responsable</dt><dd>{detail.assignee?.name ?? 'Sin asignar'}</dd></div>
              <div><dt>Para cuándo</dt><dd>{detail.neededBy ? formatDate(detail.neededBy) : 'Sin fecha'}</dd></div>
              <div><dt>Abierta hace</dt><dd>{ageInDays(detail.createdAt)} día(s)</dd></div>
            </dl>
            {detail.description && <><h3>Descripción</h3><p>{detail.description}</p></>}
            {detail.creativeFields && Object.keys(detail.creativeFields).length > 0 && (
              <>
                <h3>Datos del área</h3>
                <dl>
                  {CREATIVE_FIELDS[detail.area]
                    .filter((field) => detail.creativeFields?.[field.name])
                    .map((field) => {
                      const raw = detail.creativeFields?.[field.name] ?? '';
                      const label = field.options?.find(([value]) => value === raw)?.[1] ?? raw;
                      return <div key={field.name}><dt>{field.label}</dt><dd>{label}</dd></div>;
                    })}
                </dl>
              </>
            )}
            {detail.rejectionReason && <><h3>Motivo del rechazo</h3><p>{detail.rejectionReason}</p></>}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(rejectFor)} onClose={() => setRejectFor(null)} title="Rechazar la solicitud">
        <div className="intake-form">
          <p>Una solicitud rechazada sin motivo se vuelve a pedir igual la semana siguiente. Escribe por qué no se hace.</p>
          <label className="intake-field">
            <span>Motivo <i aria-hidden="true">*</i></span>
            <textarea className="input" rows={3} value={rejectReason} maxLength={500} onChange={(e) => setRejectReason(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setRejectFor(null)}>Cancelar</button>
            <button
              className="btn btn-primary"
              disabled={!rejectReason.trim() || updateMutation.isPending}
              onClick={() => rejectFor && updateMutation.mutate({ id: rejectFor.id, body: { status: 'rejected', rejectionReason: rejectReason.trim() } })}
            >
              Rechazar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(convertFor)}
        onClose={() => setConvertFor(null)}
        title={convertFor?.area === 'audiovisual' ? 'Agendar la sesión de rodaje' : 'Convertir en piezas de producción'}
      >
        {convertFor?.area === 'audiovisual' ? (
          <div className="intake-form">
            <p>
              Una solicitud audiovisual agenda <strong>una sesión</strong>: un día de trabajo, con un equipo y en
              una locación. No crea piezas de diseño ni consume presupuesto de diseño.
            </p>
            <div className="intake-grid">
              <label className="intake-field">
                <span>Tipo de sesión <i aria-hidden="true">*</i></span>
                <select className="input" value={session.type} onChange={(e) => setSession({ ...session, type: e.target.value })}>
                  {SESSION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="intake-field">
                <span>Fecha de rodaje <i aria-hidden="true">*</i></span>
                <input className="input" type="date" value={session.date} onChange={(e) => setSession({ ...session, date: e.target.value })} />
              </label>
              <label className="intake-field">
                <span>Locación</span>
                <input className="input" value={session.location} placeholder="Local, estudio, exterior…" onChange={(e) => setSession({ ...session, location: e.target.value })} />
              </label>
            </div>
            <fieldset className="intake-section">
              <legend>Equipo</legend>
              <div className="intake-team">
                {assigneesByArea.audiovisual.length === 0 ? (
                  <p className="intake-form-intro">No hay nadie del área audiovisual activo en la organización.</p>
                ) : assigneesByArea.audiovisual.map((user) => (
                  <label className="intake-toggle" key={user.id}>
                    <input
                      type="checkbox"
                      checked={session.team.includes(user.id)}
                      onChange={(e) => setSession({
                        ...session,
                        team: e.target.checked
                          ? [...session.team, user.id]
                          : session.team.filter((id) => id !== user.id),
                      })}
                    />
                    {user.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConvertFor(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitConvert} disabled={convertMutation.isPending}>
                {convertMutation.isPending ? 'Agendando...' : 'Agendar sesión'}
              </button>
            </div>
          </div>
        ) : (
        <div className="intake-form">
          <p>
            Una solicitud puede convertirse en varias piezas —un carrusel y sus historias—. Cada pieza entra al
            tablero con la cuenta, el plazo y el responsable de esta solicitud.
          </p>
          {pieces.map((piece, index) => (
            <div className="intake-piece-row" key={index}>
              <input
                className="input"
                aria-label={`Título de la pieza ${index + 1}`}
                value={piece.title}
                onChange={(e) => setPieces(pieces.map((row, position) => position === index ? { ...row, title: e.target.value } : row))}
              />
              <select
                className="input"
                aria-label={`Tipo de la pieza ${index + 1}`}
                value={piece.type}
                onChange={(e) => setPieces(pieces.map((row, position) => position === index ? { ...row, type: e.target.value } : row))}
              >
                {PIECE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="btn btn-sm btn-outline" aria-label={`Quitar la pieza ${index + 1}`} onClick={() => setPieces(pieces.filter((_, position) => position !== index))}>✕</button>
            </div>
          ))}
          <button className="btn btn-sm btn-outline" onClick={() => setPieces([...pieces, { title: '', type: 'post_simple' }])} disabled={pieces.length >= 20}>
            Agregar pieza
          </button>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setConvertFor(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={submitConvert} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? 'Convirtiendo...' : `Crear ${pieces.length} pieza(s)`}
            </button>
          </div>
        </div>
        )}
      </Modal>
    </div>
  );
}
