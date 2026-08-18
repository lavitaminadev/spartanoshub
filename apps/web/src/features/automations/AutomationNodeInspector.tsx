import type { JSX } from 'react';
import type { AutomationCatalog, AutomationNodeData } from './automation-types';

interface UserOption { id: string; name: string }

export interface AutomationNodeInspectorProps {
  node: AutomationNodeData | null;
  catalog?: AutomationCatalog;
  users: UserOption[];
  onChange: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}

/** Operadores que ofrece el evaluador del servidor, con su nombre en español. */
const OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'not_equals', label: 'no es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'is_empty', label: 'está vacío' },
  { value: 'is_not_empty', label: 'tiene valor' },
  { value: 'greater_than', label: 'es mayor que' },
  { value: 'less_than', label: 'es menor que' },
];

/**
 * Campos que trae el contexto de un trato.
 *
 * Se ofrecen como sugerencia y no como lista cerrada: el contexto acumula además lo que
 * produce cada acción, y encerrarlo acá impediría encadenar el resultado de un paso con la
 * condición del siguiente.
 */
const SUGGESTED_FIELDS = ['stage', 'previousStage', 'amount', 'assignedTo', 'clientId', 'leadId'];

/**
 * Panel de configuración del nodo seleccionado.
 *
 * Cada tipo de nodo pide lo suyo. Las acciones se dibujan a partir de `requiredConfig` del
 * catálogo, de modo que una acción nueva en el servidor aparece acá con sus campos sin tocar
 * este archivo.
 */
export function AutomationNodeInspector({ node, catalog, users, onChange, onRemove }: AutomationNodeInspectorProps): JSX.Element {
  if (!node) {
    return (
      <aside className="automation-inspector is-empty">
        <p>Selecciona un paso del flujo para configurarlo.</p>
      </aside>
    );
  }

  const set = (key: string, value: unknown) => onChange({ ...node.config, [key]: value });

  return (
    <aside className="automation-inspector">
      <header>
        <h3>{titleFor(node, catalog)}</h3>
        {node.type !== 'trigger' ? (
          <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>Quitar</button>
        ) : null}
      </header>

      {node.type === 'trigger' ? (
        <p className="automation-inspector-hint">
          Es el punto de partida del flujo. Se cambia desde el selector de arriba.
        </p>
      ) : null}

      {node.type === 'condition' ? (
        <>
          <label>
            Campo
            <input
              className="input"
              list="automation-fields"
              value={String(node.config.field ?? '')}
              onChange={(event) => set('field', event.target.value)}
            />
            <datalist id="automation-fields">
              {SUGGESTED_FIELDS.map((field) => <option key={field} value={field} />)}
            </datalist>
          </label>
          <label>
            Comparación
            <select className="input" value={String(node.config.operator ?? 'equals')} onChange={(event) => set('operator', event.target.value)}>
              {OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
            </select>
          </label>
          {/* Preguntar por la ausencia no necesita valor: mostrar el campo invitaría a
              rellenarlo y ese valor se ignoraría en silencio. */}
          {node.config.operator !== 'is_empty' && node.config.operator !== 'is_not_empty' ? (
            <label>
              Valor
              <input className="input" value={String(node.config.value ?? '')} onChange={(event) => set('value', event.target.value)} />
            </label>
          ) : null}
          <p className="automation-inspector-hint">
            La rama <strong>Sí</strong> continúa cuando se cumple; la rama <strong>No</strong>, cuando no.
          </p>
        </>
      ) : null}

      {node.type === 'delay' ? (
        <>
          <label>
            Esperar
            <input
              className="input"
              type="number"
              min={1}
              value={Number(node.config.amount ?? 1)}
              onChange={(event) => set('amount', Number(event.target.value))}
            />
          </label>
          <label>
            Unidad
            <select className="input" value={String(node.config.unit ?? 'hours')} onChange={(event) => set('unit', event.target.value)}>
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Días</option>
            </select>
          </label>
        </>
      ) : null}

      {node.type === 'action' ? (
        <>
          {(catalog?.actions.find((action) => action.key === node.key)?.requiredConfig ?? []).map((field) => (
            <label key={field}>
              {FIELD_LABEL[field] ?? field}
              {field === 'userId' ? (
                <select className="input" value={String(node.config[field] ?? '')} onChange={(event) => set(field, event.target.value)}>
                  <option value="">Selecciona una persona</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              ) : field === 'message' || field === 'body' ? (
                <textarea className="input" rows={4} value={String(node.config[field] ?? '')} onChange={(event) => set(field, event.target.value)} />
              ) : (
                <input className="input" value={String(node.config[field] ?? '')} onChange={(event) => set(field, event.target.value)} />
              )}
            </label>
          ))}
          <p className="automation-inspector-hint">
            En los textos puedes usar <code>{'{{campo}}'}</code> para insertar un dato del contexto,
            por ejemplo <code>{'{{amount}}'}</code>.
          </p>
        </>
      ) : null}
    </aside>
  );
}

const FIELD_LABEL: Record<string, string> = {
  userId: 'Persona',
  title: 'Título',
  message: 'Mensaje',
  to: 'Destinatario',
  subject: 'Asunto',
  body: 'Contenido',
};

function titleFor(node: AutomationNodeData, catalog?: AutomationCatalog): string {
  if (node.type === 'trigger') return catalog?.triggers.find((trigger) => trigger.key === node.key)?.label ?? 'Disparador';
  if (node.type === 'action') return catalog?.actions.find((action) => action.key === node.key)?.label ?? 'Acción';
  if (node.type === 'condition') return 'Condición';
  return 'Espera';
}
