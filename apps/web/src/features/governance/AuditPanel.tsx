import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { Modal } from '../../shared/Modal';
import { matchesSearch } from '../../shared/search';

interface AuditRow {
  [key: string]: unknown;
  id: string; entityType: string; entityId?: string; action: string; actorId?: string; actorName?: string; actorEmail?: string;
  before?: unknown; after?: unknown; reason?: string; ipAddress?: string; occurredAt: string;
}

/** Tope de filas por consulta. Se nombra en pantalla cuando se alcanza. */
const TOPE = 300;

const ACTION_LABELS: Record<string, string> = { create: 'Creación', update: 'Actualización', delete: 'Eliminación', publish: 'Publicación', unpublish: 'Volver a borrador', reset_password: 'Reset de clave', accept: 'Aceptación', send: 'Envío', created: 'Creado', updated: 'Actualizado', deleted: 'Eliminado', converted: 'Convertido', status_change: 'Cambio de estado', status_changed: 'Cambio de estado', anonymize: 'Anonimización', anonymized: 'Anonimización', extend: 'Extensión' };

/** Los datos de una fila vienen como objeto o como texto JSON; se muestran siempre como objeto cuando se puede. */
function comoDatos(valor: unknown): unknown {
  if (valor == null) return null;
  if (typeof valor !== 'string') return valor;
  try { return JSON.parse(valor); } catch { return valor; }
}
const ENTITY_LABELS: Record<string, string> = { users: 'Usuarios', clients: 'Clientes', production: 'Producción', content: 'Contenido', meetings: 'Reuniones', catalog: 'Catálogo', contracts: 'Contratos', reporting: 'Reportes', workflows: 'Flujos', pods: 'Pods', settings: 'Configuración', auth: 'Acceso' };

export function AuditPanel() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [accion, setAccion] = useState('');
  const [registro, setRegistro] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  /*
   * El recorte lo hace el servidor, que es donde está la bitácora entera.
   *
   * `GET /audit` acepta módulo, acción, registro y responsable desde siempre, y esta pantalla no
   * mandaba ninguno: pedía trescientas filas planas y filtraba encima. En una bitácora eso es lo
   * contrario de lo que sirve, porque se entra buscando **un** evento concreto y el que se busca
   * suele ser justo el que no vino.
   */
  const registroBuscado = useDeferredValue(registro.trim());
  const query = useQuery<AuditRow[]>({
    queryKey: ['audit-log', entity, accion, registroBuscado],
    queryFn: () => api.get(`/audit?${new URLSearchParams({
      limit: String(TOPE),
      ...(entity ? { entityType: entity } : {}),
      ...(accion ? { action: accion } : {}),
      ...(registroBuscado ? { entityId: registroBuscado } : {}),
    })}`),
    placeholderData: (previa) => previa,
  });
  const all = query.data ?? [];
  /*
   * Los módulos salen del catálogo y no de lo traído.
   *
   * Sacarlos de las filas en pantalla dejaba fuera justamente el módulo que no aparecía, que es
   * por el que alguien querría filtrar.
   */
  const entities = [...new Set([...Object.keys(ENTITY_LABELS), ...all.map((row) => row.entityType)])].sort();
  /* El texto libre sí filtra acá: cruza campos que el servidor no indexa y la página ya está. */
  /*
   * Las acciones salen del catálogo y de lo traído: el servidor las deriva del último tramo de la
   * ruta, así que el conjunto es abierto y una fija dejaría sin filtro a las que no conoce.
   */
  const acciones = [...new Set([...Object.keys(ACTION_LABELS), ...all.map((row) => row.action)])].sort();
  const rows = all.filter((row) => matchesSearch(search, [row.actorName, row.actorEmail, row.entityType, row.action, row.entityId]));
  const payload = comoDatos(selected?.after);
  const anterior = comoDatos(selected?.before);

  return <section className="audit-workspace">
    <div className="section-toolbar"><div><span className="page-eyebrow">TRAZABILIDAD</span><h2>Bitácora de cambios</h2><p>Cada operación relevante queda asociada a persona, fecha, origen y datos no sensibles.</p></div><button className="btn btn-outline" onClick={() => query.refetch()} disabled={query.isFetching}>{query.isFetching ? 'Actualizando...' : 'Actualizar'}</button></div>
    <div className="audit-integrity-note"><span>✓</span><div><strong>Registro automático activo</strong><p>Contraseñas, tokens, secretos y credenciales se eliminan antes de guardar la evidencia.</p></div></div>
    <div className="filters">
      <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar actor, módulo, acción o identificador..." />
      <select className="input" aria-label="Filtrar por módulo" value={entity} onChange={(event) => setEntity(event.target.value)}><option value="">Todos los módulos</option>{entities.map((value) => <option key={value} value={value}>{ENTITY_LABELS[value] ?? value}</option>)}</select>
      <select className="input" aria-label="Filtrar por acción" value={accion} onChange={(event) => setAccion(event.target.value)}><option value="">Todas las acciones</option>{acciones.map((valor) => <option key={valor} value={valor}>{ACTION_LABELS[valor] ?? valor.replaceAll('_', ' ')}</option>)}</select>
      {/* Por identificador exacto: es como se entra cuando se investiga un registro concreto. */}
      <input className="input" aria-label="Buscar por identificador de registro" value={registro} onChange={(event) => setRegistro(event.target.value)} placeholder="Id del registro" />
      {entity || accion || registro ? <button type="button" className="btn btn-link" onClick={() => { setEntity(''); setAccion(''); setRegistro(''); }}>Limpiar</button> : null}
    </div>
    {/*
      El tope se dice. Una bitácora recortada en silencio hace creer que un evento no ocurrió
      cuando lo que pasa es que quedó fuera de las últimas filas.
    */}
    {all.length >= TOPE ? <p className="page-subtitle">Se muestran los {TOPE} movimientos más recientes de este filtro. Acota por módulo, acción o identificador para encontrar uno anterior: la bitácora todavía no se puede filtrar por fecha.</p> : null}
    {query.error ? <div className="alert alert-error">No se pudo cargar la bitácora: {query.error.message}</div> : <DataTable<AuditRow> loading={query.isLoading} data={rows} keyExtractor={(row) => row.id} emptyMessage="Aún no existen cambios registrados para este filtro." columns={[
      { key: 'occurredAt', label: 'Fecha', sortable: true, render: (row) => new Date(row.occurredAt).toLocaleString('es-CL') },
      { key: 'actorName', label: 'Responsable', render: (row) => <span className="audit-actor"><strong>{row.actorName ?? 'Sistema'}</strong><small>{row.actorEmail}</small></span> },
      { key: 'entityType', label: 'Módulo', render: (row) => ENTITY_LABELS[row.entityType] ?? row.entityType },
      { key: 'action', label: 'Acción', render: (row) => <span className="audit-action">{ACTION_LABELS[row.action] ?? row.action.replaceAll('_', ' ')}</span> },
      { key: 'ipAddress', label: 'Origen', render: (row) => row.ipAddress ?? 'Interno' },
      { key: 'id', label: 'Evidencia', render: (row) => <button className="btn btn-sm btn-outline" onClick={() => setSelected(row)}>Ver detalle</button> },
    ]} />}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalle de auditoría"><div className="audit-detail"><dl><div><dt>Responsable</dt><dd>{selected?.actorName ?? 'Sistema'}</dd></div><div><dt>Fecha</dt><dd>{selected ? new Date(selected.occurredAt).toLocaleString('es-CL') : ''}</dd></div><div><dt>Módulo</dt><dd>{selected ? ENTITY_LABELS[selected.entityType] ?? selected.entityType : ''}</dd></div><div><dt>Acción</dt><dd>{selected ? ACTION_LABELS[selected.action] ?? selected.action : ''}</dd></div><div><dt>Registro</dt><dd>{selected?.entityId ?? 'Operación global'}</dd></div><div><dt>IP</dt><dd>{selected?.ipAddress ?? 'No informada'}</dd></div></dl>{anterior != null && <><h3>Antes</h3><pre>{JSON.stringify(anterior, null, 2)}</pre></>}<h3>{anterior != null ? 'Después' : 'Datos asociados'}</h3><pre>{payload == null ? 'Sin datos adicionales' : JSON.stringify(payload, null, 2)}</pre></div></Modal>
  </section>;
}
