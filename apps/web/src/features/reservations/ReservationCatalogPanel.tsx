/**
 * @fileoverview Panel "Rubros y captación": edición del catálogo de rubros y tipos de
 * captación que alimenta el constructor de formularios (presets con campos tipo candado).
 *
 * El catálogo es un documento por organización guardado como JSON. El panel lo carga,
 * lo deja editar localmente y solo escribe con PUT al guardar. "Restaurar catálogo por
 * defecto" borra la fila personalizada para que el backend vuelva a servir el de sistema.
 *
 * Los campos tipo candado (`locked`) son los que el preset aplica al constructor como
 * "protegidos": el creador del formulario no puede borrarlos ni volverlos opcionales.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { triggerToast } from '../../shared/toast-events';

export interface CatalogField { id: string; tipo: string; label: string; required: boolean; locked: boolean }
export interface CatalogTipo { key: string; nombre: string; cta?: string; confirmacion?: string; duracionMin?: number; capacidad?: number; agenda?: string; campos?: CatalogField[] }
export interface CatalogRubro { key: string; nombre: string; tipos: CatalogTipo[] }

const FIELD_TYPES: Array<[string, string]> = [
  ['text', 'Texto corto'], ['textarea', 'Texto largo'], ['email', 'Correo'],
  ['phone', 'Teléfono'], ['select', 'Selector'], ['multi_select', 'Selección múltiple'],
  ['number', 'Número'], ['date', 'Fecha'], ['consent', 'Aceptación'],
  ['rating', 'Calificación'], ['coupon', 'Cupón promocional'],
];

function keyOf(label: string): string {
  const slug = label.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || 'item';
}

function clone(rubros: CatalogRubro[]): CatalogRubro[] {
  return JSON.parse(JSON.stringify(rubros)) as CatalogRubro[];
}

export function ReservationCatalogPanel() {
  const qc = useQueryClient();
  const catalogQuery = useQuery<CatalogRubro[]>({ queryKey: ['reservation-catalog'], queryFn: () => api.get('/reservations/catalog') });
  const data = Array.isArray(catalogQuery.data) ? catalogQuery.data : [];
  const [draft, setDraft] = useState<CatalogRubro[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data);

  useEffect(() => { setDraft(data.length > 0 ? clone(data) : null); }, [catalogQuery.dataUpdatedAt]);

  const saveMutation = useMutation({
    mutationFn: (rubros: CatalogRubro[]) => api.put('/reservations/catalog', { rubros }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservation-catalog'] }); triggerToast('Catálogo de rubros guardado'); },
  });
  const resetMutation = useMutation({
    mutationFn: () => api.delete<CatalogRubro[]>('/reservations/catalog'),
    onSuccess: (rubros) => { qc.invalidateQueries({ queryKey: ['reservation-catalog'] }); setDraft(Array.isArray(rubros) ? clone(rubros) : null); triggerToast('Catálogo restaurado al por defecto'); },
  });

  const update = (rubros: CatalogRubro[]) => setDraft(clone(rubros));

  const patchRubro = (index: number, patch: Partial<CatalogRubro>) => {
    if (!draft) return;
    update(draft.map((rubro, current) => current === index ? { ...rubro, ...patch } : rubro));
  };
  const addRubro = () => {
    if (!draft) return;
    update([...draft, { key: keyOf('Nuevo rubro'), nombre: 'Nuevo rubro', tipos: [] }]);
  };
  const removeRubro = (index: number) => {
    if (!draft) return;
    update(draft.filter((_, current) => current !== index));
  };
  const moveRubro = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const to = index + direction;
    if (to < 0 || to >= draft.length) return;
    const next = [...draft];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    update(next);
  };
  const addTipo = (rubroIndex: number) => {
    if (!draft) return;
    patchRubro(rubroIndex, { tipos: [...(draft[rubroIndex].tipos || []), { key: keyOf('Nuevo tipo'), nombre: 'Nuevo tipo', cta: '', confirmacion: '', duracionMin: 30, capacidad: 1, agenda: 'slot', campos: [] }] });
  };
  const patchTipo = (rubroIndex: number, tipoIndex: number, patch: Partial<CatalogTipo>) => {
    if (!draft) return;
    update(draft.map((rubro, ri) => ri !== rubroIndex ? rubro : { ...rubro, tipos: rubro.tipos.map((tipo, ti) => ti !== tipoIndex ? tipo : { ...tipo, ...patch }) }));
  };
  const removeTipo = (rubroIndex: number, tipoIndex: number) => {
    if (!draft) return;
    patchRubro(rubroIndex, { tipos: draft[rubroIndex].tipos.filter((_, ti) => ti !== tipoIndex) });
  };
  const addCampo = (rubroIndex: number, tipoIndex: number) => {
    if (!draft) return;
    const tipo = draft[rubroIndex].tipos[tipoIndex];
    patchTipo(rubroIndex, tipoIndex, { campos: [...(tipo.campos || []), { id: keyOf('Nuevo campo'), tipo: 'text', label: 'Nuevo campo', required: false, locked: true }] });
  };
  const patchCampo = (rubroIndex: number, tipoIndex: number, campoIndex: number, patch: Partial<CatalogField>) => {
    if (!draft) return;
    update(draft.map((rubro, ri) => ri !== rubroIndex ? rubro : {
      ...rubro,
      tipos: rubro.tipos.map((tipo, ti) => ti !== tipoIndex ? tipo : { ...tipo, campos: (tipo.campos || []).map((campo, ci) => ci !== campoIndex ? campo : { ...campo, ...patch }) }),
    }));
  };
  const removeCampo = (rubroIndex: number, tipoIndex: number, campoIndex: number) => {
    if (!draft) return;
    patchTipo(rubroIndex, tipoIndex, { campos: (draft[rubroIndex].tipos[tipoIndex].campos || []).filter((_, ci) => ci !== campoIndex) });
  };

  const rubroCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const rubro of data) counts[rubro.key] = rubro.tipos?.length ?? 0;
    return counts;
  }, [data]);

  if (catalogQuery.isLoading) return <LoadingSpinner text="Cargando catálogo de rubros..." />;
  if (catalogQuery.error) return <QueryErrorState title="No pudimos cargar el catálogo" message={catalogQuery.error.message} onRetry={() => void catalogQuery.refetch()} retrying={catalogQuery.isFetching} />;
  if (!draft) return null;

  return <section>
    <div className="section-toolbar">
      <div>
        <span className="page-eyebrow">RUBROS Y CAPTACIÓN</span>
        <h2>Catálogo de rubros y tipos</h2>
        <p className="page-subtitle">Estos presets aparecen al crear un formulario de reserva. Cada tipo trae su configuración base y sus campos; los campos con candado no se pueden quitar desde el constructor.</p>
      </div>
      <div className="reservation-flow-actions">
        {dirty && <span className="catalog-dirty">Cambios sin guardar</span>}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(clone(data))} disabled={!dirty}>Descartar</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmReset(true)} disabled={resetMutation.isPending || saveMutation.isPending}>Restaurar por defecto</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || saveMutation.isPending || resetMutation.isPending} onClick={() => saveMutation.mutate(draft)}>{saveMutation.isPending ? 'Guardando...' : 'Guardar catálogo'}</button>
      </div>
    </div>
    {saveMutation.error && <div className="alert alert-error">{saveMutation.error.message}</div>}

    <div className="catalog-rubro-list">
      {draft.map((rubro, rubroIndex) => <article className="catalog-rubro" key={rubro.key}>
        <header className="catalog-rubro-head">
          <div className="catalog-rubro-fields">
            <label>Nombre del rubro<input className="input" value={rubro.nombre} onChange={(event) => patchRubro(rubroIndex, { nombre: event.target.value, key: keyOf(event.target.value) })} /></label>
            <span className="catalog-key">clave: <code>{rubro.key}</code> · {rubroCounts[rubro.key] ?? rubro.tipos?.length ?? 0} tipo{rubro.tipos?.length === 1 ? '' : 's'}</span>
          </div>
          <div className="catalog-rubro-actions">
            <button type="button" className="btn btn-outline btn-xs" disabled={rubroIndex === 0} onClick={() => moveRubro(rubroIndex, -1)}>↑</button>
            <button type="button" className="btn btn-outline btn-xs" disabled={rubroIndex === draft.length - 1} onClick={() => moveRubro(rubroIndex, 1)}>↓</button>
            <button type="button" className="btn btn-outline btn-xs" onClick={() => addTipo(rubroIndex)}>+ Tipo</button>
            <button type="button" className="btn btn-outline btn-xs btn-danger" onClick={() => removeRubro(rubroIndex)}>Quitar rubro</button>
          </div>
        </header>

        {rubro.tipos.length === 0
          ? <p className="catalog-empty-tipos">Este rubro todavía no tiene tipos. Agrega el primero para que aparezca en el constructor.</p>
          : rubro.tipos.map((tipo, tipoIndex) => <details className="catalog-tipo" key={`${rubro.key}-${tipo.key}`} open>
            <summary>
              <span className="catalog-tipo-name">{tipo.nombre || 'Tipo sin nombre'}</span>
              <span className="catalog-tipo-meta">{tipo.campos?.length ?? 0} campo{(tipo.campos?.length ?? 0) === 1 ? '' : 's'} · {tipo.duracionMin || 0} min · {(tipo.capacidad ?? 0) === 0 ? 'sin cupo fijo' : `${tipo.capacidad} cupo(s)`}</span>
            </summary>
            <div className="catalog-tipo-body">
              <div className="catalog-tipo-grid">
                <label>Nombre del tipo<input className="input" value={tipo.nombre} onChange={(event) => patchTipo(rubroIndex, tipoIndex, { nombre: event.target.value, key: keyOf(event.target.value) })} /></label>
                <label>Botón de confirmación (CTA)<input className="input" value={tipo.cta || ''} onChange={(event) => patchTipo(rubroIndex, tipoIndex, { cta: event.target.value })} placeholder="Ej. Reserva tu mesa" /></label>
              </div>
              <label className="catalog-confirmacion">Mensaje de confirmación<textarea className="input" rows={2} value={tipo.confirmacion || ''} onChange={(event) => patchTipo(rubroIndex, tipoIndex, { confirmacion: event.target.value })} placeholder="Ej. Tu mesa está confirmada. ¡Te esperamos!" /></label>
              <div className="catalog-tipo-grid">
                <label>Duración (min)<input className="input" type="number" min="0" value={tipo.duracionMin ?? 0} onChange={(event) => patchTipo(rubroIndex, tipoIndex, { duracionMin: Number(event.target.value) })} /></label>
                <label>Cupos por bloque<input className="input" type="number" min="0" value={tipo.capacidad ?? 0} onChange={(event) => patchTipo(rubroIndex, tipoIndex, { capacidad: Number(event.target.value) })} /></label>
                <label>Agenda<select className="input" value={tipo.agenda || 'slot'} onChange={(event) => patchTipo(rubroIndex, tipoIndex, { agenda: event.target.value })}><option value="slot">Con hora (agenda)</option><option value="none">Sin hora (solo datos)</option></select></label>
              </div>

              <div className="catalog-campos">
                <div className="catalog-campos-head"><strong>Campos del formulario</strong><span>Con candado se aplican al constructor como protegidos: no se pueden borrar ni volver opcionales.</span></div>
                {tipo.campos?.map((campo, campoIndex) => <div className="catalog-campo" key={`${tipo.key}-${campo.id}`}>
                  <input className="input" aria-label="Etiqueta del campo" value={campo.label} onChange={(event) => patchCampo(rubroIndex, tipoIndex, campoIndex, { label: event.target.value, id: keyOf(event.target.value) })} />
                  <select className="input" aria-label="Tipo de campo" value={campo.tipo} onChange={(event) => patchCampo(rubroIndex, tipoIndex, campoIndex, { tipo: event.target.value })}>{FIELD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <label className="toggle-row catalog-campo-toggle" title={campo.required ? 'Obligatorio para el visitante' : 'Opcional para el visitante'}><input type="checkbox" checked={campo.required} onChange={(event) => patchCampo(rubroIndex, tipoIndex, campoIndex, { required: event.target.checked })} />Obligatorio</label>
                  <label className={`toggle-row catalog-campo-toggle ${campo.locked ? 'is-locked' : ''}`} title={campo.locked ? 'Candado activo: el constructor no puede quitarlo' : 'Campo editable desde el constructor'}><input type="checkbox" checked={campo.locked} onChange={(event) => patchCampo(rubroIndex, tipoIndex, campoIndex, { locked: event.target.checked })} />{campo.locked ? '🔒 Candado' : 'Candado'}</label>
                  <button type="button" className="btn btn-outline btn-xs btn-danger" aria-label={`Quitar campo ${campo.label}`} onClick={() => removeCampo(rubroIndex, tipoIndex, campoIndex)}>✕</button>
                </div>)}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addCampo(rubroIndex, tipoIndex)}>+ Agregar campo</button>
              </div>
              <button type="button" className="btn btn-outline btn-xs btn-danger" onClick={() => removeTipo(rubroIndex, tipoIndex)}>Quitar este tipo</button>
            </div>
          </details>)}
      </article>)}
    </div>

    <button type="button" className="btn btn-outline" onClick={addRubro}>+ Agregar rubro</button>

    <ConfirmDialog open={confirmReset} title="Restaurar catálogo por defecto" description="Se perderán todos los rubros, tipos y campos personalizados. ¿Quieres volver al catálogo recomendado por Espartanos?" confirmLabel="Restaurar" pending={resetMutation.isPending} onClose={() => setConfirmReset(false)} onConfirm={() => { resetMutation.mutate(); setConfirmReset(false); }} />
  </section>;
}
