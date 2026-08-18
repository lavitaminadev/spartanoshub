import { BadRequestException } from '@nestjs/common';
import type { AutomationGraph, AutomationNode } from './automation.entity';
import { findAction, findTrigger, type ConditionConfig, type ConditionOperator } from './automation-catalog';

/**
 * Evalúa una condición contra el contexto de la ejecución.
 *
 * Es una función pura y sin acceso a base a propósito: una condición debe poder probarse sin
 * montar nada, y no debe poder disparar consultas ocultas dentro de un bucle de ejecución.
 * Lo que necesite mirar tiene que estar ya en el contexto.
 *
 * Ante un campo ausente la comparación es falsa, salvo `is_empty`, que es justamente la
 * pregunta por la ausencia. Eso evita que una condición mal escrita deje pasar todo.
 */
export function evaluateCondition(config: ConditionConfig, context: Record<string, unknown>): boolean {
  const actual = context[config.field];
  const expected = config.value;

  const operators: Record<ConditionOperator, () => boolean> = {
    equals: () => String(actual ?? '') === String(expected ?? ''),
    not_equals: () => String(actual ?? '') !== String(expected ?? ''),
    contains: () => String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase()),
    is_empty: () => actual === null || actual === undefined || actual === '',
    is_not_empty: () => actual !== null && actual !== undefined && actual !== '',
    // Las comparaciones numéricas exigen números de verdad: comparar como texto haría que
    // "9" resultara mayor que "10" y un umbral de monto se comportaría al revés.
    greater_than: () => toNumber(actual) !== null && toNumber(expected) !== null && toNumber(actual)! > toNumber(expected)!,
    less_than: () => toNumber(actual) !== null && toNumber(expected) !== null && toNumber(actual)! < toNumber(expected)!,
  };

  const evaluate = operators[config.operator];
  if (!evaluate) return false;
  return evaluate();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Comprueba que un grafo pueda ejecutarse antes de permitir guardarlo.
 *
 * Un grafo inválido guardado no falla al guardarse: falla semanas después, en mitad de una
 * ejecución, sobre un trato real. Todo lo que pueda detectarse acá se detecta acá.
 *
 * @throws BadRequestException con el motivo, para que el editor lo muestre.
 */
export function assertValidGraph(graph: AutomationGraph): void {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new BadRequestException('El flujo debe tener nodos y conexiones');
  }

  const triggers = graph.nodes.filter((node) => node.type === 'trigger');
  if (triggers.length !== 1) {
    throw new BadRequestException('El flujo debe tener exactamente un disparador');
  }
  if (!findTrigger(triggers[0].key)) {
    throw new BadRequestException(`El disparador "${triggers[0].key}" no existe`);
  }

  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) throw new BadRequestException(`Hay dos nodos con el identificador "${node.id}"`);
    ids.add(node.id);
    assertValidNode(node);
  }

  for (const edge of graph.edges) {
    if (!ids.has(edge.source)) throw new BadRequestException(`La conexión sale de un nodo inexistente: "${edge.source}"`);
    if (!ids.has(edge.target)) throw new BadRequestException(`La conexión llega a un nodo inexistente: "${edge.target}"`);

    const source = graph.nodes.find((node) => node.id === edge.source)!;
    if (source.type === 'condition' && edge.branch !== 'true' && edge.branch !== 'false') {
      throw new BadRequestException('Cada salida de una condición debe indicar si es la rama verdadera o la falsa');
    }
    if (source.type !== 'condition' && edge.branch) {
      throw new BadRequestException('Solo una condición puede tener ramas');
    }
  }

  assertNoCycle(graph);
}

function assertValidNode(node: AutomationNode): void {
  if (node.type === 'action') {
    const action = findAction(node.key);
    if (!action) throw new BadRequestException(`La acción "${node.key}" no existe`);
    const missing = action.requiredConfig.filter((field) => {
      const value = node.config?.[field];
      return value === undefined || value === null || value === '';
    });
    if (missing.length) {
      throw new BadRequestException(`A la acción "${action.label}" le falta configurar: ${missing.join(', ')}`);
    }
  }

  if (node.type === 'condition') {
    const config = node.config as unknown as ConditionConfig;
    if (!config?.field || !config?.operator) {
      throw new BadRequestException('Cada condición necesita un campo y un operador');
    }
  }

  if (node.type === 'delay') {
    const amount = node.config?.amount;
    if (typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestException('Una espera debe indicar cuánto tiempo esperar');
    }
  }
}

/**
 * Rechaza los grafos con ciclos.
 *
 * Un ciclo convierte la automatización en un bucle sin fin: cada vuelta escribe pasos,
 * consume memoria y, en un alojamiento con memoria compartida, termina afectando a todo lo
 * demás. Se impide al guardar y no en la ejecución porque en la ejecución ya es tarde.
 */
function assertNoCycle(graph: AutomationGraph): void {
  const salientes = new Map<string, string[]>();
  for (const edge of graph.edges) {
    salientes.set(edge.source, [...(salientes.get(edge.source) ?? []), edge.target]);
  }

  const EN_CURSO = 1;
  const TERMINADO = 2;
  const estado = new Map<string, number>();

  const visitar = (nodeId: string): void => {
    if (estado.get(nodeId) === TERMINADO) return;
    if (estado.get(nodeId) === EN_CURSO) {
      throw new BadRequestException('El flujo no puede volver sobre un paso anterior');
    }
    estado.set(nodeId, EN_CURSO);
    for (const siguiente of salientes.get(nodeId) ?? []) visitar(siguiente);
    estado.set(nodeId, TERMINADO);
  };

  for (const node of graph.nodes) visitar(node.id);
}

/**
 * Nodo que sigue a uno dado.
 *
 * @param branch - Rama a tomar cuando el nodo es una condición.
 * @returns El nodo siguiente, o `null` cuando el flujo termina acá.
 */
export function nextNode(graph: AutomationGraph, fromNodeId: string, branch?: 'true' | 'false'): AutomationNode | null {
  const edge = graph.edges.find((candidate) => candidate.source === fromNodeId
    && (branch === undefined || candidate.branch === branch));
  if (!edge) return null;
  return graph.nodes.find((node) => node.id === edge.target) ?? null;
}
