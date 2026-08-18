import { describe, expect, it } from 'vitest';
import { assertValidGraph, evaluateCondition, nextNode } from '../../../src/modules/automations/automation-graph';
import type { AutomationGraph } from '../../../src/modules/automations/automation.entity';

const disparador = { id: 't1', type: 'trigger' as const, key: 'deal.won', config: {} };
const accion = {
  id: 'a1',
  type: 'action' as const,
  key: 'notify_assignee',
  config: { title: 'Trato ganado', message: 'Felicitaciones' },
};

const grafo = (partial: Partial<AutomationGraph>): AutomationGraph => ({
  nodes: [disparador, accion],
  edges: [{ id: 'e1', source: 't1', target: 'a1' }],
  ...partial,
});

describe('validación del flujo', () => {
  it('acepta un flujo con un disparador y una acción configurada', () => {
    expect(() => assertValidGraph(grafo({}))).not.toThrow();
  });

  it('exige exactamente un disparador', () => {
    expect(() => assertValidGraph(grafo({ nodes: [accion], edges: [] })))
      .toThrow(/exactamente un disparador/);
    expect(() => assertValidGraph(grafo({
      nodes: [disparador, { ...disparador, id: 't2' }, accion],
    }))).toThrow(/exactamente un disparador/);
  });

  it('rechaza un disparador que no existe en el catálogo', () => {
    expect(() => assertValidGraph(grafo({
      nodes: [{ ...disparador, key: 'trato.inventado' }, accion],
    }))).toThrow(/no existe/);
  });

  it('rechaza una acción a la que le falta configuración', () => {
    expect(() => assertValidGraph(grafo({
      nodes: [disparador, { ...accion, config: { title: 'Solo título' } }],
    }))).toThrow(/le falta configurar/);
  });

  it('rechaza conexiones que apuntan a un nodo inexistente', () => {
    expect(() => assertValidGraph(grafo({
      edges: [{ id: 'e1', source: 't1', target: 'fantasma' }],
    }))).toThrow(/nodo inexistente/);
  });

  it('exige que cada salida de una condición declare su rama', () => {
    const condicion = { id: 'c1', type: 'condition' as const, key: 'field', config: { field: 'stage', operator: 'equals', value: 'won' } };
    expect(() => assertValidGraph({
      nodes: [disparador, condicion, accion],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a1' },
      ],
    })).toThrow(/rama verdadera o la falsa/);
  });

  /**
   * Es la protección que importa: un ciclo convierte la automatización en un bucle sin fin, y
   * en un alojamiento con memoria compartida eso alcanza a toda la aplicación. Se rechaza al
   * guardar porque en la ejecución ya sería tarde.
   */
  it('rechaza un flujo que vuelve sobre un paso anterior', () => {
    expect(() => assertValidGraph({
      nodes: [disparador, accion, { ...accion, id: 'a2' }],
      edges: [
        { id: 'e1', source: 't1', target: 'a1' },
        { id: 'e2', source: 'a1', target: 'a2' },
        { id: 'e3', source: 'a2', target: 'a1' },
      ],
    })).toThrow(/volver sobre un paso anterior/);
  });

  it('exige que una espera indique cuánto esperar', () => {
    expect(() => assertValidGraph(grafo({
      nodes: [disparador, { id: 'd1', type: 'delay', key: 'wait', config: { amount: 0, unit: 'hours' } }],
      edges: [{ id: 'e1', source: 't1', target: 'd1' }],
    }))).toThrow(/cuánto tiempo esperar/);
  });
});

describe('evaluación de condiciones', () => {
  const contexto = { stage: 'won', amount: 1500, assignedTo: null, source: 'Meta Ads' };

  it('compara por igualdad sin distinguir el tipo', () => {
    expect(evaluateCondition({ field: 'stage', operator: 'equals', value: 'won' }, contexto)).toBe(true);
    expect(evaluateCondition({ field: 'amount', operator: 'equals', value: '1500' }, contexto)).toBe(true);
    expect(evaluateCondition({ field: 'stage', operator: 'not_equals', value: 'lost' }, contexto)).toBe(true);
  });

  it('busca texto sin distinguir mayúsculas', () => {
    expect(evaluateCondition({ field: 'source', operator: 'contains', value: 'meta' }, contexto)).toBe(true);
  });

  it('distingue el campo vacío del ausente', () => {
    expect(evaluateCondition({ field: 'assignedTo', operator: 'is_empty' }, contexto)).toBe(true);
    expect(evaluateCondition({ field: 'stage', operator: 'is_not_empty' }, contexto)).toBe(true);
  });

  /**
   * Comparar montos como texto haría que "9" resultara mayor que "10", y un umbral de valor
   * se comportaría al revés justo en los tratos grandes.
   */
  it('compara números como números y no como texto', () => {
    expect(evaluateCondition({ field: 'amount', operator: 'greater_than', value: 900 }, contexto)).toBe(true);
    expect(evaluateCondition({ field: 'amount', operator: 'greater_than', value: 9000 }, contexto)).toBe(false);
    expect(evaluateCondition({ field: 'amount', operator: 'greater_than', value: '9' }, { amount: '10' })).toBe(true);
  });

  it('es falsa cuando el campo no existe, salvo al preguntar por su ausencia', () => {
    expect(evaluateCondition({ field: 'inexistente', operator: 'equals', value: 'algo' }, contexto)).toBe(false);
    expect(evaluateCondition({ field: 'inexistente', operator: 'greater_than', value: 1 }, contexto)).toBe(false);
    expect(evaluateCondition({ field: 'inexistente', operator: 'is_empty' }, contexto)).toBe(true);
  });
});

describe('recorrido del flujo', () => {
  it('sigue la rama que corresponde al resultado de la condición', () => {
    const flujo: AutomationGraph = {
      nodes: [
        disparador,
        { id: 'c1', type: 'condition', key: 'field', config: { field: 'stage', operator: 'equals', value: 'won' } },
        accion,
        { ...accion, id: 'a2' },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a1', branch: 'true' },
        { id: 'e3', source: 'c1', target: 'a2', branch: 'false' },
      ],
    };
    expect(nextNode(flujo, 'c1', 'true')?.id).toBe('a1');
    expect(nextNode(flujo, 'c1', 'false')?.id).toBe('a2');
  });

  it('devuelve nulo cuando el flujo termina', () => {
    expect(nextNode(grafo({}), 'a1')).toBeNull();
  });
});
