"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCondition = evaluateCondition;
exports.assertValidGraph = assertValidGraph;
exports.nextNode = nextNode;
const common_1 = require("@nestjs/common");
const automation_catalog_1 = require("./automation-catalog");
function evaluateCondition(config, context) {
    const actual = context[config.field];
    const expected = config.value;
    const operators = {
        equals: () => String(actual ?? '') === String(expected ?? ''),
        not_equals: () => String(actual ?? '') !== String(expected ?? ''),
        contains: () => String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase()),
        is_empty: () => actual === null || actual === undefined || actual === '',
        is_not_empty: () => actual !== null && actual !== undefined && actual !== '',
        greater_than: () => toNumber(actual) !== null && toNumber(expected) !== null && toNumber(actual) > toNumber(expected),
        less_than: () => toNumber(actual) !== null && toNumber(expected) !== null && toNumber(actual) < toNumber(expected),
    };
    const evaluate = operators[config.operator];
    if (!evaluate)
        return false;
    return evaluate();
}
function toNumber(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function assertValidGraph(graph) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
        throw new common_1.BadRequestException('El flujo debe tener nodos y conexiones');
    }
    const triggers = graph.nodes.filter((node) => node.type === 'trigger');
    if (triggers.length !== 1) {
        throw new common_1.BadRequestException('El flujo debe tener exactamente un disparador');
    }
    if (!(0, automation_catalog_1.findTrigger)(triggers[0].key)) {
        throw new common_1.BadRequestException(`El disparador "${triggers[0].key}" no existe`);
    }
    const ids = new Set();
    for (const node of graph.nodes) {
        if (ids.has(node.id))
            throw new common_1.BadRequestException(`Hay dos nodos con el identificador "${node.id}"`);
        ids.add(node.id);
        assertValidNode(node);
    }
    for (const edge of graph.edges) {
        if (!ids.has(edge.source))
            throw new common_1.BadRequestException(`La conexión sale de un nodo inexistente: "${edge.source}"`);
        if (!ids.has(edge.target))
            throw new common_1.BadRequestException(`La conexión llega a un nodo inexistente: "${edge.target}"`);
        const source = graph.nodes.find((node) => node.id === edge.source);
        if (source.type === 'condition' && edge.branch !== 'true' && edge.branch !== 'false') {
            throw new common_1.BadRequestException('Cada salida de una condición debe indicar si es la rama verdadera o la falsa');
        }
        if (source.type !== 'condition' && edge.branch) {
            throw new common_1.BadRequestException('Solo una condición puede tener ramas');
        }
    }
    assertNoCycle(graph);
}
function assertValidNode(node) {
    if (node.type === 'action') {
        const action = (0, automation_catalog_1.findAction)(node.key);
        if (!action)
            throw new common_1.BadRequestException(`La acción "${node.key}" no existe`);
        const missing = action.requiredConfig.filter((field) => {
            const value = node.config?.[field];
            return value === undefined || value === null || value === '';
        });
        if (missing.length) {
            throw new common_1.BadRequestException(`A la acción "${action.label}" le falta configurar: ${missing.join(', ')}`);
        }
    }
    if (node.type === 'condition') {
        const config = node.config;
        if (!config?.field || !config?.operator) {
            throw new common_1.BadRequestException('Cada condición necesita un campo y un operador');
        }
    }
    if (node.type === 'delay') {
        const amount = node.config?.amount;
        if (typeof amount !== 'number' || amount <= 0) {
            throw new common_1.BadRequestException('Una espera debe indicar cuánto tiempo esperar');
        }
    }
}
function assertNoCycle(graph) {
    const salientes = new Map();
    for (const edge of graph.edges) {
        salientes.set(edge.source, [...(salientes.get(edge.source) ?? []), edge.target]);
    }
    const EN_CURSO = 1;
    const TERMINADO = 2;
    const estado = new Map();
    const visitar = (nodeId) => {
        if (estado.get(nodeId) === TERMINADO)
            return;
        if (estado.get(nodeId) === EN_CURSO) {
            throw new common_1.BadRequestException('El flujo no puede volver sobre un paso anterior');
        }
        estado.set(nodeId, EN_CURSO);
        for (const siguiente of salientes.get(nodeId) ?? [])
            visitar(siguiente);
        estado.set(nodeId, TERMINADO);
    };
    for (const node of graph.nodes)
        visitar(node.id);
}
function nextNode(graph, fromNodeId, branch) {
    const edge = graph.edges.find((candidate) => candidate.source === fromNodeId
        && (branch === undefined || candidate.branch === branch));
    if (!edge)
        return null;
    return graph.nodes.find((node) => node.id === edge.target) ?? null;
}
