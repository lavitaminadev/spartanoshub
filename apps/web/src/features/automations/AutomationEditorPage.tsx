import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { AutomationCanvas } from './AutomationCanvas';
import { AutomationNodeInspector } from './AutomationNodeInspector';
import type { Automation, AutomationCatalog, AutomationGraph, AutomationNodeData } from './automation-types';

interface UserOption { id: string; name: string }

/** Flujo inicial de una automatización nueva: solo el disparador, listo para encadenar. */
const emptyGraph = (triggerKey: string): AutomationGraph => ({
  nodes: [{ id: 'trigger', type: 'trigger', key: triggerKey, config: {}, position: { x: 120, y: 40 } }],
  edges: [],
});

/**
 * Constructor visual de una automatización.
 *
 * El lienzo dibuja la estructura y el panel lateral edita el nodo seleccionado. Están
 * separados porque son dos preguntas distintas: el lienzo responde "en qué orden ocurre" y el
 * panel "con qué datos". Meter la configuración dentro de cada nodo del lienzo obliga a
 * elegir entre nodos ilegibles o formularios diminutos.
 */
export function AutomationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nuevo';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [runAsUserId, setRunAsUserId] = useState('');
  const [graph, setGraph] = useState<AutomationGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data: catalog } = useQuery<AutomationCatalog>({
    queryKey: ['automations-catalog'],
    queryFn: () => api.get('/automations/catalog'),
  });

  const { data: usersResp } = useQuery<{ data: UserOption[] }>({
    queryKey: ['users-min'],
    queryFn: () => api.get('/users'),
  });

  const { data: existing, isLoading, error, refetch } = useQuery<Automation>({
    queryKey: ['automation', id],
    queryFn: () => api.get(`/automations/${id}`),
    enabled: !isNew,
  });

  // Vuelca la automatización cargada al formulario una sola vez, cuando llega.
  const [hydrated, setHydrated] = useState(false);
  if (existing && !hydrated) {
    setName(existing.name);
    setDescription(existing.description ?? '');
    setTriggerType(existing.triggerType);
    setRunAsUserId(existing.runAsUserId);
    setGraph(existing.graph);
    setHydrated(true);
  }

  const users = useMemo(() => usersResp?.data ?? [], [usersResp]);
  const currentGraph = graph ?? (triggerType ? emptyGraph(triggerType) : null);

  const describeNode = useCallback((node: AutomationNodeData) => {
    if (node.type === 'trigger') {
      const trigger = catalog?.triggers.find((candidate) => candidate.key === node.key);
      return { label: trigger?.label ?? node.key, summary: '' };
    }
    if (node.type === 'action') {
      const action = catalog?.actions.find((candidate) => candidate.key === node.key);
      return { label: action?.label ?? node.key, summary: String(node.config.title ?? node.config.to ?? '') };
    }
    if (node.type === 'condition') {
      return {
        label: String(node.config.field ?? 'Condición'),
        summary: `${node.config.operator ?? ''} ${node.config.value ?? ''}`.trim(),
      };
    }
    return { label: 'Esperar', summary: `${node.config.amount ?? ''} ${node.config.unit ?? ''}`.trim() };
  }, [catalog]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (
      isNew ? api.post('/automations', body) : api.put(`/automations/${id}`, body)
    ),
    onSuccess: (result: Automation) => {
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
      setFeedback({ tone: 'success', text: 'Automatización guardada' });
      if (isNew) navigate(`/automations/${result.id}`, { replace: true });
    },
    // El servidor devuelve exactamente qué falta o qué está mal conectado. Se muestra tal
    // cual: reescribir el mensaje acá solo lograría que dijera menos.
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const addNode = (type: AutomationNodeData['type'], key: string) => {
    if (!currentGraph) return;
    const nodeId = `${type}-${Date.now().toString(36)}`;
    const config = type === 'delay' ? { amount: 1, unit: 'hours' }
      : type === 'condition' ? { field: 'stage', operator: 'equals', value: '' }
        : {};
    setGraph({
      ...currentGraph,
      nodes: [...currentGraph.nodes, {
        id: nodeId, type, key, config,
        position: { x: 120, y: 60 + currentGraph.nodes.length * 130 },
      }],
    });
    setSelectedNodeId(nodeId);
  };

  const updateNodeConfig = (nodeId: string, config: Record<string, unknown>) => {
    if (!currentGraph) return;
    setGraph({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => (node.id === nodeId ? { ...node, config } : node)),
    });
  };

  const removeNode = (nodeId: string) => {
    if (!currentGraph) return;
    setGraph({
      nodes: currentGraph.nodes.filter((node) => node.id !== nodeId),
      // Las conexiones que tocaban el nodo se van con él: dejarlas produciría aristas que
      // apuntan a un nodo inexistente y el servidor rechazaría el flujo entero al guardar.
      edges: currentGraph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    });
    setSelectedNodeId(null);
  };

  const handleSave = () => {
    if (!currentGraph) return;
    save.mutate({ name, description: description || undefined, triggerType, runAsUserId, graph: currentGraph });
  };

  if (!isNew && isLoading) return <LoadingSpinner />;
  if (!isNew && error) return <QueryErrorState message={(error as Error).message} onRetry={() => void refetch()} />;

  const selectedNode = currentGraph?.nodes.find((node) => node.id === selectedNodeId) ?? null;

  return (
    <div className="page automation-editor">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Automatizaciones</span>
          <h1>{isNew ? 'Nueva automatización' : name || 'Editar automatización'}</h1>
          {!isNew && existing ? (
            <p className="page-subtitle">
              Versión {existing.version} · {existing.isActive ? 'Activa' : 'Inactiva'}
            </p>
          ) : null}
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/automations')}>Volver</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={save.isPending || !name.trim() || !triggerType || !runAsUserId}
            onClick={handleSave}
          >
            {save.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {feedback ? <div className={`alert alert-${feedback.tone === 'success' ? 'success' : 'error'}`}>{feedback.text}</div> : null}

      <div className="automation-meta">
        <label>
          Nombre
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Avisar al ganar un trato grande" />
        </label>
        <label>
          Se dispara cuando
          <select
            className="input"
            value={triggerType}
            onChange={(event) => {
              setTriggerType(event.target.value);
              // Cambiar el disparador reinicia el flujo: las condiciones y acciones del
              // anterior se escribieron sobre datos que el nuevo evento puede no traer.
              setGraph(emptyGraph(event.target.value));
              setSelectedNodeId(null);
            }}
          >
            <option value="">Selecciona un evento</option>
            {catalog?.triggers.map((trigger) => <option key={trigger.key} value={trigger.key}>{trigger.label}</option>)}
          </select>
        </label>
        <label>
          Actúa en nombre de
          <select className="input" value={runAsUserId} onChange={(event) => setRunAsUserId(event.target.value)}>
            <option value="">Selecciona una persona</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          <small className="field-hint">Todo lo que haga esta automatización queda registrado a nombre de esta persona.</small>
        </label>
        <label className="automation-meta-wide">
          Descripción
          <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Para qué sirve este flujo" />
        </label>
      </div>

      {!currentGraph ? (
        <p className="automation-hint">Elige un evento para empezar a construir el flujo.</p>
      ) : (
        <div className="automation-workspace">
          <aside className="automation-palette">
            <h3>Agregar paso</h3>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => addNode('condition', 'field')}>Condición</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => addNode('delay', 'wait')}>Espera</button>
            <h4>Acciones</h4>
            {catalog?.actions.map((action) => (
              <button key={action.key} type="button" className="btn btn-outline btn-sm" onClick={() => addNode('action', action.key)}>
                {action.label}
              </button>
            ))}
          </aside>

          <AutomationCanvas
            graph={currentGraph}
            onChange={setGraph}
            onSelectNode={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
            describeNode={describeNode}
          />

          <AutomationNodeInspector
            node={selectedNode}
            catalog={catalog}
            users={users}
            onChange={(config) => selectedNode && updateNodeConfig(selectedNode.id, config)}
            onRemove={() => selectedNode && removeNode(selectedNode.id)}
          />
        </div>
      )}
    </div>
  );
}
