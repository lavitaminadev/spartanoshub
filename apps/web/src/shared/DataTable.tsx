import { useMemo, useState, type JSX, type ReactNode } from 'react';
import { readStoredJson, storageKey as namespacedKey, writeStoredJson } from '../core/browser-storage';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  exportValue?: (row: T) => string | number | boolean | null | undefined;
  exportable?: boolean;
}

export interface BulkAction<T> {
  label: string;
  onClick: (rows: T[]) => void | Promise<void>;
  tone?: 'default' | 'danger';
}

interface SavedView {
  name: string;
  visibleKeys: string[];
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
}

/**
 * Paginación resuelta en el servidor.
 *
 * Sin esto la tabla ordena, filtra y pagina sobre lo que ya tiene en memoria, así que solo
 * sirve mientras quepa todo. Cuando el listado crece, o se trae de más —y la pantalla tarda—
 * o se trae de menos —y faltan filas sin que nada lo diga—.
 *
 * Al recibir esta propiedad, la tabla deja de ordenar por su cuenta: el orden lo decide quien
 * responde la consulta, porque ordenar una página contra el total daría un orden falso.
 */
export interface ServerPagination {
  page: number;
  pageSize: number;
  /** Total de filas que existen, no las de esta página. */
  total: number;
  onPageChange: (page: number) => void;
  /**
   * Se llama al pedir otro orden. Sin este manejador las cabeceras no se vuelven pulsables:
   * ofrecer ordenar y que no ordene es peor que no ofrecerlo.
   */
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /**
   * Presente cuando la paginación la resuelve el servidor.
   *
   * Omitirla mantiene el comportamiento anterior: todo en memoria, que sigue siendo lo
   * correcto para un catálogo de veinte filas.
   */
  serverPagination?: ServerPagination;
  keyExtractor: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  storageKey?: string;
  exportFileName?: string;
  selectable?: boolean;
  bulkActions?: BulkAction<T>[];
}

function csvValue(value: unknown): string {
  const normalized = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function DataTable<T extends object>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyMessage = 'No hay datos',
  storageKey,
  exportFileName,
  selectable = false,
  bulkActions = [],
  serverPagination,
}: DataTableProps<T>): JSX.Element {
  const settingsKey = namespacedKey('table', storageKey || 'temporary');
  const viewsKey = `${settingsKey}:views`;
  const [sortKey, setSortKey] = useState<string | null>(() => storageKey ? readStoredJson<{ sortKey?: string }>(settingsKey, {}).sortKey || null : null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => storageKey ? readStoredJson<{ sortDir?: 'asc' | 'desc' }>(settingsKey, {}).sortDir || 'asc' : 'asc');
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() => {
    if (!storageKey) return [];
    const stored = readStoredJson<{ hiddenKeys?: unknown }>(settingsKey, {});
    return Array.isArray(stored.hiddenKeys) ? stored.hiddenKeys.filter((value): value is string => typeof value === 'string') : [];
  });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (!storageKey) return [];
    const stored = readStoredJson<unknown>(viewsKey, []);
    return Array.isArray(stored) ? stored.filter((item): item is SavedView => Boolean(item) && typeof item === 'object' && typeof (item as SavedView).name === 'string' && Array.isArray((item as SavedView).visibleKeys)) : [];
  });

  const persist = (next: { sortKey?: string | null; sortDir?: 'asc' | 'desc'; hiddenKeys?: string[] }) => {
    if (!storageKey) return;
    const current = readStoredJson<Record<string, unknown>>(settingsKey, {});
    writeStoredJson(settingsKey, { ...current, sortKey, sortDir, hiddenKeys, ...next });
  };

  const serverMode = Boolean(serverPagination);
  const activeSortKey = serverPagination ? serverPagination.sortKey ?? null : sortKey;
  const activeSortDir = serverPagination ? serverPagination.sortDir ?? 'asc' : sortDir;

  const handleSort = (key: keyof T | string) => {
    const normalizedKey = String(key);

    if (serverPagination) {
      // Con paginación de servidor el orden lo decide la consulta: ordenar la página contra el
      // total daría un orden que solo vale dentro de esa página y engaña al leerlo.
      const nextDirection = activeSortKey === normalizedKey && activeSortDir === 'asc' ? 'desc' : 'asc';
      serverPagination.onSortChange?.(normalizedKey, nextDirection);
      return;
    }

    if (sortKey === normalizedKey) {
      const nextDirection = sortDir === 'asc' ? 'desc' : 'asc';
      setSortDir(nextDirection); persist({ sortDir: nextDirection });
    } else {
      setSortKey(normalizedKey); setSortDir('asc'); persist({ sortKey: normalizedKey, sortDir: 'asc' });
    }
  };

  const visibleColumns = useMemo(() => columns.filter((column) => !hiddenKeys.includes(String(column.key))), [columns, hiddenKeys]);
  const sorted = useMemo(() => {
    if (serverMode || !sortKey) return data;
    const column = columns.find((candidate) => String(candidate.key) === sortKey);
    return [...data].sort((a, b) => {
      const first = column?.sortValue ? column.sortValue(a) : Reflect.get(a, sortKey) as unknown;
      const second = column?.sortValue ? column.sortValue(b) : Reflect.get(b, sortKey) as unknown;
      if (first == null) return 1;
      if (second == null) return -1;
      const comparison = String(first).localeCompare(String(second), undefined, { numeric: true });
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir, columns, serverMode]);
  const selectedRows = useMemo(() => data.filter((row) => selected.has(String(keyExtractor(row)))), [data, selected, keyExtractor]);
  const allVisibleSelected = sorted.length > 0 && sorted.every((row) => selected.has(String(keyExtractor(row))));
  const smart = Boolean(storageKey || exportFileName || selectable || bulkActions.length);
  // Sin manejador de orden en modo servidor, la cabecera no se ofrece: prometer un orden que
  // nadie atiende es peor que no ofrecerlo.
  const sortEnabled = !serverMode || Boolean(serverPagination?.onSortChange);

  const toggleColumn = (key: string) => {
    const next = hiddenKeys.includes(key) ? hiddenKeys.filter((item) => item !== key) : [...hiddenKeys, key];
    setHiddenKeys(next); persist({ hiddenKeys: next });
  };

  const exportCsv = () => {
    const rows = selectedRows.length ? selectedRows : sorted;
    const exportColumns = visibleColumns.filter((column) => column.exportable !== false && String(column.key) !== 'id');
    const csv = [exportColumns.map((column) => csvValue(column.label)).join(','), ...rows.map((row) => exportColumns.map((column) => csvValue(column.exportValue ? column.exportValue(row) : Reflect.get(row, String(column.key)))).join(','))].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${exportFileName || storageKey || 'datos'}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const saveView = () => {
    const name = viewName.trim();
    if (!name || !storageKey) return;
    const view: SavedView = { name, visibleKeys: visibleColumns.map((column) => String(column.key)), sortKey, sortDir };
    const next = [...savedViews.filter((item) => item.name !== name), view];
    setSavedViews(next); setViewName('');
    writeStoredJson(viewsKey, next);
  };

  const applyView = (view: SavedView) => {
    const nextHidden = columns.map((column) => String(column.key)).filter((key) => !view.visibleKeys.includes(key));
    setHiddenKeys(nextHidden); setSortKey(view.sortKey); setSortDir(view.sortDir); persist({ hiddenKeys: nextHidden, sortKey: view.sortKey, sortDir: view.sortDir });
  };

  if (loading) return <div className="table-loading">Cargando...</div>;
  /*
   * En modo servidor, una página sin filas no siempre significa que no haya datos: puede ser
   * una página que quedó fuera de rango al filtrar o al borrar. Ahí se conserva la paginación
   * para poder volver; sin ella la pantalla decía «no hay datos» y no dejaba salir.
   */
  if (!data.length) {
    const fueraDeRango = serverPagination && serverPagination.total > 0;
    return (
      <div className="smart-table">
        <div className="table-empty">{fueraDeRango ? 'Esta página no tiene registros.' : emptyMessage}</div>
        {fueraDeRango && (
          <Pagination
            page={serverPagination.page}
            pageSize={serverPagination.pageSize}
            total={serverPagination.total}
            onPageChange={serverPagination.onPageChange}
          />
        )}
      </div>
    );
  }

  return <div className={`smart-table ${selectedRows.length ? 'has-selection' : ''}`}>
    {smart && <div className="smart-table-toolbar"><div><span>{serverPagination ? serverPagination.total : data.length} registros</span>{selectedRows.length > 0 && <strong>{selectedRows.length} seleccionados</strong>}</div><div>{selectedRows.length > 0 && bulkActions.map((action) => <button className={`btn btn-sm ${action.tone === 'danger' ? 'btn-danger' : 'btn-outline'}`} key={action.label} onClick={() => void action.onClick(selectedRows)}>{action.label}</button>)}{exportFileName && <button className="btn btn-outline btn-sm" onClick={exportCsv}>Exportar {selectedRows.length ? 'selección' : 'CSV'}</button>}{storageKey && <details className="smart-table-menu"><summary>Vistas</summary><div><label>Guardar configuración<input className="input" value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Ej. Seguimiento semanal" /></label><button className="btn btn-primary btn-sm" disabled={!viewName.trim()} onClick={saveView}>Guardar vista</button>{savedViews.map((view) => <button className="saved-view" key={view.name} onClick={() => applyView(view)}>{view.name}</button>)}</div></details>}{storageKey && <details className="smart-table-menu"><summary>Columnas</summary><div>{columns.map((column) => <label className="column-option" key={String(column.key)}><input type="checkbox" checked={!hiddenKeys.includes(String(column.key))} onChange={() => toggleColumn(String(column.key))} /> {column.label}</label>)}</div></details>}</div></div>}
    <div className="table-wrapper"><table className="data-table"><thead><tr>{selectable && <th className="table-select"><input type="checkbox" aria-label="Seleccionar filas visibles" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(sorted.map((row) => String(keyExtractor(row)))))} /></th>}{visibleColumns.map((column) => <th key={String(column.key)} className={column.sortable && sortEnabled ? 'sortable' : ''} onClick={() => column.sortable && sortEnabled && handleSort(column.key)} onKeyDown={(event) => { if (column.sortable && sortEnabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleSort(column.key); } }} tabIndex={column.sortable && sortEnabled ? 0 : undefined} aria-sort={activeSortKey === String(column.key) ? (activeSortDir === 'asc' ? 'ascending' : 'descending') : column.sortable ? 'none' : undefined}>{column.label}{activeSortKey === String(column.key) && <span className="sort-indicator">{activeSortDir === 'asc' ? ' ▲' : ' ▼'}</span>}</th>)}</tr></thead><tbody>{sorted.map((row) => { const id = String(keyExtractor(row)); return <tr key={id} className={selected.has(id) ? 'is-selected' : ''}>{selectable && <td className="table-select" data-label="Seleccionar"><input type="checkbox" aria-label={`Seleccionar registro ${id}`} checked={selected.has(id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} /></td>}{visibleColumns.map((column) => <td key={String(column.key)} data-label={column.label}>{column.render ? column.render(row) : String(Reflect.get(row, String(column.key)) ?? '')}</td>)}</tr>; })}</tbody></table></div>
    {serverPagination && <Pagination page={serverPagination.page} pageSize={serverPagination.pageSize} total={serverPagination.total} onPageChange={serverPagination.onPageChange} />}
  </div>;
}
