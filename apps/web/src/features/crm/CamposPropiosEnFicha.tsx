/**
 * @fileoverview Los campos propios dentro de la ficha de un registro.
 *
 * Lo usan la ficha del lead, del contacto y de la oportunidad: cambia sólo qué definiciones pide.
 * Valida con la misma función que el servidor, así el error aparece junto al campo antes de
 * guardar y no como un mensaje genérico después.
 *
 * Un campo archivado con valor guardado se muestra en sólo lectura: el dato existe y alguien
 * puede necesitarlo, pero ya no se edita.
 */

import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { normalizarValor, type CustomFieldDefinition, type CustomFieldEntity, type CustomFieldValue } from '@espartanos/shared';
import { api } from '../../core/api';
import './campos-propios-ficha.css';

export type ValoresEnEdicion = Record<string, unknown>;

/**
 * Las definiciones de un tipo de registro, archivadas incluidas para mostrar lo guardado.
 *
 * @param clientId - Empresa del registro que se está mirando. Trae los campos de todas las
 *   empresas más los suyos: los de otra empresa llenarían la ficha de datos que ahí no dicen nada.
 */
export function useDefinicionesDeCampos(entidad: CustomFieldEntity, clientId?: string) {
  return useQuery<CustomFieldDefinition[]>({
    queryKey: ['crm-fields', entidad, true, clientId ?? null],
    queryFn: () => api.get(`/crm/fields?entity=${entidad}&archivados=true${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}`),
    staleTime: 60_000,
  });
}

function textoDe(valor: unknown): string {
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return valor === null || valor === undefined ? '' : String(valor);
}

export function CamposPropiosEnFicha({ entidad, valores, onCambiar, deshabilitado }: {
  entidad: CustomFieldEntity;
  valores: ValoresEnEdicion;
  onCambiar: (clave: string, valor: unknown) => void;
  deshabilitado?: boolean;
}): JSX.Element | null {
  const { data: definiciones = [] } = useDefinicionesDeCampos(entidad);
  const activos = definiciones.filter((def) => !def.archivedAt);
  const archivadosConValor = definiciones.filter((def) => def.archivedAt && textoDe(valores[def.key]) !== '');
  if (activos.length === 0 && archivadosConValor.length === 0) return null;

  const problema = (def: CustomFieldDefinition): string | null => {
    const valor = valores[def.key];
    const vacio = valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0);
    if (vacio) return def.required ? 'Obligatorio' : null;
    const resultado = normalizarValor(def, valor);
    return resultado.ok ? null : resultado.error;
  };

  return (
    <fieldset className="campos-propios-ficha">
      <legend>Datos propios</legend>
      {activos.map((def) => {
        const valor = valores[def.key];
        const error = problema(def);
        const id = `campo-propio-${def.key}`;
        const etiqueta = <span>{def.label}{def.required ? <span className="required-star"> *</span> : null}</span>;
        let control: JSX.Element;
        switch (def.type) {
          case 'long_text':
            control = <textarea id={id} className="input" rows={3} value={textoDe(valor)} disabled={deshabilitado} onChange={(evento) => onCambiar(def.key, evento.target.value)} />;
            break;
          case 'number':
            control = <input id={id} className="input" type="number" inputMode="decimal" value={textoDe(valor)} disabled={deshabilitado} onChange={(evento) => onCambiar(def.key, evento.target.value)} />;
            break;
          case 'date':
            control = <input id={id} className="input" type="date" value={textoDe(valor)} disabled={deshabilitado} onChange={(evento) => onCambiar(def.key, evento.target.value)} />;
            break;
          case 'boolean':
            control = (
              <select id={id} className="input" value={valor === true ? 'si' : valor === false ? 'no' : ''} disabled={deshabilitado} onChange={(evento) => onCambiar(def.key, evento.target.value === '' ? '' : evento.target.value === 'si')}>
                <option value="">Sin dato</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            );
            break;
          case 'select':
            control = (
              <select id={id} className="input" value={textoDe(valor)} disabled={deshabilitado} onChange={(evento) => onCambiar(def.key, evento.target.value)}>
                <option value="">Sin dato</option>
                {(def.options ?? []).map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
              </select>
            );
            break;
          case 'multi_select': {
            const elegidas = Array.isArray(valor) ? valor.map(String) : [];
            control = (
              <div className="campos-propios-multiple" role="group" aria-labelledby={`${id}-titulo`}>
                {(def.options ?? []).map((opcion) => (
                  <label key={opcion}>
                    <input
                      type="checkbox"
                      checked={elegidas.includes(opcion)}
                      disabled={deshabilitado}
                      onChange={(evento) => onCambiar(def.key, evento.target.checked ? [...elegidas, opcion] : elegidas.filter((item) => item !== opcion))}
                    />
                    {opcion}
                  </label>
                ))}
              </div>
            );
            break;
          }
          default:
            control = <input id={id} className="input" value={textoDe(valor)} maxLength={255} disabled={deshabilitado} onChange={(evento) => onCambiar(def.key, evento.target.value)} />;
        }
        return (
          <div key={def.key} className={`campos-propios-ficha-campo ${error ? 'has-error' : ''}`}>
            {def.type === 'multi_select'
              ? <span id={`${id}-titulo`} className="campos-propios-ficha-titulo">{etiqueta}</span>
              : <label htmlFor={id} className="campos-propios-ficha-titulo">{etiqueta}</label>}
            {control}
            {error && error !== 'Obligatorio' ? <small className="field-error" role="alert">{error}</small> : null}
          </div>
        );
      })}
      {archivadosConValor.length > 0 ? (
        <dl className="campos-propios-archivados">
          {archivadosConValor.map((def) => (
            <div key={def.key}><dt>{def.label} <small>(archivado)</small></dt><dd>{textoDe(valores[def.key] as CustomFieldValue)}</dd></div>
          ))}
        </dl>
      ) : null}
    </fieldset>
  );
}

/** Si algún campo activo tiene un valor inválido. Los obligatorios vacíos los exige el servidor. */
export function hayValoresInvalidos(definiciones: CustomFieldDefinition[], valores: ValoresEnEdicion): boolean {
  return definiciones.some((def) => {
    if (def.archivedAt) return false;
    const valor = valores[def.key];
    if (valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && valor.length === 0)) return false;
    return !normalizarValor(def, valor).ok;
  });
}
