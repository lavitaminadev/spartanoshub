import { useCallback, useMemo, useState, type JSX } from 'react';
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow,
  addEdge, useEdgesState, useNodesState,
  type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AutomationGraph, AutomationNodeData, AutomationNodeType } from './automation-types';

/** Lo que cada nodo del lienzo lleva consigo. */
type CanvasNodeData = {
  kind: AutomationNodeType;
  nodeKey: string;
  label: string;
  summary: string;
  selected?: boolean;
};

/**
 * Nodo dibujado en el lienzo.
 *
 * Los conectores (`Handle`) son lo que hace que React Flow permita unir dos nodos. El
 * disparador no tiene entrada —nada puede desembocar en él— y una condición saca dos salidas
 * etiquetadas, que es como se dibuja una bifurcación sin necesidad de un nodo aparte.
 */
function AutomationNodeView({ data }: NodeProps): JSX.Element {
  const node = data as CanvasNodeData;
  return (
    <div className={`flow-node is-${node.kind}${node.selected ? ' is-selected' : ''}`}>
      {node.kind !== 'trigger' ? <Handle type="target" position={Position.Top} /> : null}

      <span className="flow-node-kind">{KIND_LABEL[node.kind]}</span>
      <strong className="flow-node-label">{node.label}</strong>
      {node.summary ? <small className="flow-node-summary">{node.summary}</small> : null}

      {node.kind === 'condition' ? (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} />
      )}
    </div>
  );
}

const KIND_LABEL: Record<AutomationNodeType, string> = {
  trigger: 'Cuando',
  condition: 'Si',
  action: 'Entonces',
  delay: 'Esperar',
};

const nodeTypes = { automation: AutomationNodeView };

export interface AutomationCanvasProps {
  graph: AutomationGraph;
  onChange: (graph: AutomationGraph) => void;
  onSelectNode: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  /** Descripción corta de un nodo, para mostrar bajo su título. */
  describeNode: (node: AutomationNodeData) => { label: string; summary: string };
  readOnly?: boolean;
}

/**
 * Lienzo del constructor de automatizaciones.
 *
 * Se apoya en React Flow (licencia MIT), que resuelve arrastre, conexiones, zoom, minimapa y
 * selección. Su formato de nodos y aristas coincide casi uno a uno con el que guarda el
 * backend, así que la conversión entre ambos es directa y no hay un modelo intermedio que
 * mantener sincronizado.
 *
 * El componente no valida: la validación real vive en el servidor, que es quien tiene que
 * rechazar un flujo imposible venga de donde venga.
 */
export function AutomationCanvas({
  graph, onChange, onSelectNode, selectedNodeId, describeNode, readOnly = false,
}: AutomationCanvasProps): JSX.Element {
  const initialNodes = useMemo<Node[]>(() => graph.nodes.map((node, index) => {
    const { label, summary } = describeNode(node);
    return {
      id: node.id,
      type: 'automation',
      // Los nodos guardados conservan su posición; los que nunca la tuvieron se apilan en
      // vertical para que al menos queden legibles en vez de superpuestos en el origen.
      position: node.position ?? { x: 80, y: index * 130 },
      data: { kind: node.type, nodeKey: node.key, label, summary, selected: node.id === selectedNodeId },
    };
  }), [graph.nodes, describeNode, selectedNodeId]);

  const initialEdges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.branch,
    label: edge.branch === 'true' ? 'Sí' : edge.branch === 'false' ? 'No' : undefined,
    animated: true,
  })), [graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  /**
   * Vuelve a sembrar el lienzo cuando el flujo cambia desde fuera.
   *
   * `useNodesState` toma su valor inicial una sola vez, así que sin esto un paso agregado
   * desde la paleta, o la edición de su configuración en el panel lateral, no aparecerían
   * hasta recargar.
   *
   * La firma deja fuera las posiciones a propósito: se comparan los pasos y las conexiones,
   * no dónde están. Incluirlas haría que arrastrar un nodo —que ya actualiza el estado local—
   * volviera a sembrar el lienzo en mitad del arrastre.
   *
   * Sí incluye el nodo seleccionado, porque el resaltado se dibuja dentro del nodo: sin eso,
   * elegir un paso en el lienzo abría su configuración en el panel pero no marcaba cuál era.
   */
  const signature = useMemo(() => JSON.stringify({
    nodes: graph.nodes.map((node) => [node.id, node.key, node.config]),
    edges: graph.edges.map((edge) => [edge.id, edge.source, edge.target, edge.branch]),
    selectedNodeId,
  }), [graph, selectedNodeId]);

  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setNodes(initialNodes);
    setEdges(initialEdges);
  }

  /**
   * Traduce el estado del lienzo al formato que guarda el backend.
   *
   * Se llama solo desde manejadores de eventos, nunca desde dentro de un actualizador de
   * estado: avisar al componente padre es un efecto, y hacerlo mientras React calcula el
   * estado siguiente provoca que el padre vuelva a renderizar en mitad del cálculo. Eso era
   * lo que dejaba el lienzo sin conexiones al abrir una automatización guardada.
   */
  const emit = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    onChange({
      nodes: nextNodes.map((node) => {
        const original = graph.nodes.find((candidate) => candidate.id === node.id);
        return {
          id: node.id,
          type: (node.data as CanvasNodeData).kind,
          key: (node.data as CanvasNodeData).nodeKey,
          config: original?.config ?? {},
          position: node.position,
        };
      }),
      edges: nextEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        branch: (edge.sourceHandle as 'true' | 'false' | undefined) ?? undefined,
      })),
    });
  }, [graph.nodes, onChange]);

  const handleConnect = useCallback((connection: Connection) => {
    const next = addEdge({ ...connection, animated: true }, edges);
    setEdges(next);
    emit(nodes, next);
  }, [setEdges, emit, nodes, edges]);

  return (
    <div className="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        // El lienzo lleva su propio estado mientras se manipula; el padre se entera en los
        // momentos que importan —soltar un nodo, conectar, borrar—, que son los únicos que
        // cambian lo que hay que guardar. Reenviar cada fotograma del arrastre solo produciría
        // un renderizado por píxel recorrido.
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={() => emit(nodes, edges)}
        onNodesDelete={(deleted) => {
          const ids = new Set(deleted.map((node) => node.id));
          const restantes = nodes.filter((node) => !ids.has(node.id));
          const aristas = edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target));
          emit(restantes, aristas);
        }}
        onEdgesDelete={(deleted) => {
          const ids = new Set(deleted.map((edge) => edge.id));
          emit(nodes, edges.filter((edge) => !ids.has(edge.id)));
        }}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeClick={(_event, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
