/** Formas que comparte el editor con la API de automatizaciones. */

export type AutomationNodeType = 'trigger' | 'condition' | 'action' | 'delay';

export interface AutomationNodeData {
  id: string;
  type: AutomationNodeType;
  key: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface AutomationEdgeData {
  id: string;
  source: string;
  target: string;
  branch?: 'true' | 'false';
}

export interface AutomationGraph {
  nodes: AutomationNodeData[];
  edges: AutomationEdgeData[];
}

export interface Automation {
  id: string;
  name: string;
  description?: string | null;
  triggerType: string;
  isActive: boolean;
  version: number;
  graph: AutomationGraph;
  runAsUserId: string;
  /** Cuenta a la que se limita. Vacío o nulo significa que vale para todas. */
  clientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationVersion: number;
  triggerKey: string;
  entityType: string;
  entityId: string;
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  resumeAt?: string | null;
  attempts: number;
  lastError?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export interface AutomationRunStep {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeKey: string;
  status: 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  error?: string | null;
  durationMs?: number | null;
  createdAt: string;
}

/**
 * Catálogo que publica el backend.
 *
 * El editor construye su paleta leyéndolo en vez de traer su propia lista: así, agregar una
 * acción en el servidor la vuelve disponible en la pantalla sin tocar el frontend.
 */
export interface AutomationCatalog {
  triggers: Array<{ key: string; label: string; entityType: string; event: string }>;
  actions: Array<{ key: string; label: string; requiredConfig: string[] }>;
}

/** Etiqueta legible de cada estado de ejecución. */
export const RUN_STATUS_LABEL: Record<AutomationRun['status'], string> = {
  pending: 'En cola',
  running: 'Ejecutando',
  waiting: 'Esperando',
  completed: 'Completada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};
