/**
 * @fileoverview Administrar los campos propios del CRM.
 *
 * Crear, renombrar, ordenar, cambiar opciones y archivar, sin migraciones. Lo que la pantalla deja
 * hacer está pensado para no poder romper lo ya guardado:
 *
 * - **La clave se fija al crear** y no se edita: es la llave de los valores guardados.
 * - **Archivar no borra**: el campo se esconde y sus valores quedan, listos para volver.
 * - **Cambiar el tipo o quitar opciones** lo rechaza el servidor si algún registro dejaría de ser
 *   válido, diciendo cuántos.
 *
 * Crear campos cambia la forma de los datos de toda la organización: la pantalla lo muestra a
 * todos, pero el servidor sólo lo acepta de quien administra el CRM.
 */

import { useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claveDesdeEtiqueta, problemaDeClave, TIPOS_DE_CAMPO, type CustomFieldDefinition, type CustomFieldEntity, type CustomFieldType } from '@espartanos/shared';
import { api } from '../../core/api';

const ENTIDADES: Array<{ value: CustomFieldEntity; label: string }> = [
  { value: 'lead', label: 'Leads' },
  { value: 'contact', label: 'Contactos' },
  { value: 'opportunity', label: 'Oportunidades' },
];

const CON_OPCIONES = new Set<CustomFieldType>(['select', 'multi_select']);

function opcionesDesdeTexto(texto: string): string[] {
  return texto.split('\n').map((linea) => linea.trim()).filter(Boolean);
}

interface Borrador { label: string; key: string; claveTocada: boolean; type: CustomFieldType; options: string; required: boolean; clientId: string }
const VACIO: Borrador = { label: '', key: '', claveTocada: false, type: 'text', options: '', required: false, clientId: '' };

export function CamposPropiosDelCrm(): JSX.Element {
  const queryClient = useQueryClient();
  const [entidad, setEntidad] = useState<CustomFieldEntity>('lead');
  /*
   * De qué empresa es el campo.
   *
   * Un campo servía para toda la organización, así que el que una empresa necesitaba aparecía en
   * las fichas de todas y, si era obligatorio, bloqueaba el guardado de registros ajenos.
   */
  const { data: empresas } = useQuery<{ data: Array<{ id: string; name: string }> }>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    staleTime: 300_000,
  });
  const listaDeEmpresas = empresas?.data ?? [];
  const nombreDeEmpresa = (id?: string | null) => listaDeEmpresas.find((empresa) => empresa.id === id)?.name;
  const [verArchivados, setVerArchivados] = useState(false);
  const [nuevo, setNuevo] = useState<Borrador | null>(null);
  const [editando, setEditando] = useState<{ id: string; label: string; options: string; required: boolean; type: CustomFieldType; metaQuestions: string }  | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const clave = ['crm-fields', entidad, verArchivados];
  const campos = useQuery<CustomFieldDefinition[]>({
    queryKey: clave,
    queryFn: () => api.get(`/crm/fields?entity=${entidad}${verArchivados ? '&archivados=true' : ''}`),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['crm-fields'] });
  const fallo = (error: Error) => setAviso({ tono: 'error', texto: error.message || 'No se pudo guardar' });

  const crear = useMutation({
    mutationFn: (borrador: Borrador) => api.post<CustomFieldDefinition>('/crm/fields', {
      entity: entidad,
      label: borrador.label.trim(),
      clientId: borrador.clientId || undefined,
      key: borrador.key.trim(),
      type: borrador.type,
      options: CON_OPCIONES.has(borrador.type) ? opcionesDesdeTexto(borrador.options) : undefined,
      required: borrador.required,
    }),
    onSuccess: (campo) => { setNuevo(null); setAviso({ tono: 'ok', texto: `Campo «${campo.label}» creado.` }); void refrescar(); },
    onError: fallo,
  });

  const editar = useMutation({
    mutationFn: (datos: { id: string; cambios: Record<string, unknown> }) => api.patch<CustomFieldDefinition>(`/crm/fields/${datos.id}`, datos.cambios),
    onSuccess: () => { setEditando(null); setAviso({ tono: 'ok', texto: 'Cambios guardados.' }); void refrescar(); },
    onError: fallo,
  });

  const archivar = useMutation({
    mutationFn: (datos: { id: string; archivado: boolean }) => api.patch<CustomFieldDefinition>(`/crm/fields/${datos.id}/archivo`, { archivado: datos.archivado }),
    onSuccess: (campo) => { setAviso({ tono: 'ok', texto: campo.archivedAt ? `«${campo.label}» archivado. Sus valores se conservan.` : `«${campo.label}» volvió con sus valores.` }); void refrescar(); },
    onError: fallo,
  });

  const lista = campos.data ?? [];
  const activos = lista.filter((campo) => !campo.archivedAt);

  const mover = (campo: CustomFieldDefinition, delta: number) => {
    const indice = activos.findIndex((item) => item.id === campo.id);
    const otro = activos[indice + delta];
    if (!otro) return;
    // Se intercambian las dos posiciones: con dos escrituras el orden queda estable aunque haya huecos.
    editar.mutate({ id: campo.id, cambios: { position: otro.position } });
    editar.mutate({ id: otro.id, cambios: { position: campo.position } });
  };

  const problemaNuevo = nuevo ? (nuevo.label.trim() ? problemaDeClave(nuevo.key) : 'Escribe un nombre') : null;
  const faltanOpciones = nuevo ? CON_OPCIONES.has(nuevo.type) && opcionesDesdeTexto(nuevo.options).length === 0 : false;

  return (
    <section className="crm-admin-panel campos-propios">
      <header>
        <h2>Campos propios</h2>
        <span className="crm-admin-cuenta">{activos.length}</span>
      </header>
      <p className="crm-admin-ayuda">
        Datos que tu equipo necesita y el CRM no trae. Se completan en la ficha de cada registro. Archivar esconde el
        campo sin borrar lo que ya se guardó.
      </p>

      <div className="campos-propios-barra">
        <div role="group" aria-label="Tipo de registro" className="campos-propios-entidades">
          {ENTIDADES.map((item) => (
            <button key={item.value} type="button" aria-pressed={entidad === item.value} className={entidad === item.value ? 'active' : ''} onClick={() => { setEntidad(item.value); setNuevo(null); setEditando(null); }}>{item.label}</button>
          ))}
        </div>
        <label className="toggle-row"><input type="checkbox" checked={verArchivados} onChange={(evento) => setVerArchivados(evento.target.checked)} /> Mostrar archivados</label>
      </div>

      {/*
        * Un contacto todavía no tiene ficha donde completar nada.
        *
        * Los campos se pueden definir y lo guardado se conserva, pero ofrecerlos sin decirlo
        * dejaba a alguien creando campos que no aparecían en ninguna parte.
        */}
      {entidad === 'contact' ? (
        <p className="crm-admin-ayuda">Estos campos se completan dentro de la ficha del lead, en «En esta empresa»: el contacto es la misma persona vista desde una de sus cuentas.</p>
      ) : null}

      {aviso ? <div className={`alert ${aviso.tono === 'ok' ? 'alert-success' : 'alert-error'}`} role="status">{aviso.texto}</div> : null}

      {campos.isLoading ? <p className="crm-admin-ayuda">Cargando…</p> : lista.length === 0 && !nuevo ? (
        <p className="crm-admin-ayuda">Todavía no hay campos propios para {ENTIDADES.find((item) => item.value === entidad)?.label.toLowerCase()}.</p>
      ) : (
        <ul className="campos-propios-lista">
          {lista.map((campo) => {
            const indice = activos.findIndex((item) => item.id === campo.id);
            const enEdicion = editando?.id === campo.id;
            return (
              <li key={campo.id} className={campo.archivedAt ? 'es-archivado' : ''}>
                {enEdicion && editando ? (
                  <form className="campos-propios-form" onSubmit={(evento) => {
                    evento.preventDefault();
                    editar.mutate({ id: campo.id, cambios: {
                      label: editando.label,
                      required: editando.required,
                      type: editando.type,
                      metaQuestions: editando.metaQuestions.split('\n').map((linea) => linea.trim()).filter(Boolean),
                      ...(CON_OPCIONES.has(editando.type) ? { options: opcionesDesdeTexto(editando.options) } : {}),
                    } });
                  }}>
                    <label>Nombre<input className="input" maxLength={80} value={editando.label} onChange={(evento) => setEditando({ ...editando, label: evento.target.value })} /></label>
                    <label>Tipo<select className="input" value={editando.type} onChange={(evento) => setEditando({ ...editando, type: evento.target.value as CustomFieldType })}>{TIPOS_DE_CAMPO.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select></label>
                    {CON_OPCIONES.has(editando.type) ? <label className="campos-propios-opciones">Opciones <small>(una por línea)</small><textarea className="input" rows={4} value={editando.options} onChange={(evento) => setEditando({ ...editando, options: evento.target.value })} /></label> : null}
                    <label className="toggle-row"><input type="checkbox" checked={editando.required} onChange={(evento) => setEditando({ ...editando, required: evento.target.checked })} /> Obligatorio al editar la ficha</label>
                    {/*
                      * Qué preguntas de Meta llenan este campo.
                      *
                      * Las respuestas que no son nombre, correo, teléfono ni empresa se pegaban en
                      * las notas como texto: se leían, pero no se podían filtrar ni contar. Quien
                      * arma el anuncio escribe la pregunta a mano y cambia entre campañas, así que
                      * se aceptan varias redacciones para el mismo dato.
                      */}
                    {entidad === 'lead' ? (
                      <label className="campos-propios-opciones">Preguntas de Meta que llenan este campo <small>(una por línea, opcional)</small>
                        <textarea className="input" rows={3} placeholder={`${campo.key}\n¿Cuál es tu presupuesto?`} value={editando.metaQuestions} onChange={(evento) => setEditando({ ...editando, metaQuestions: evento.target.value })} />
                        <small className="crm-admin-ayuda">Da igual tildes, mayúsculas y signos. La clave <code>{campo.key}</code> ya funciona sin escribir nada. Lo que no coincida con ningún campo sigue yendo a las notas del lead.</small>
                      </label>
                    ) : null}
                    <small className="crm-admin-ayuda">La clave <code>{campo.key}</code> no cambia. Si el tipo nuevo o las opciones dejan algún valor guardado inválido, no se aplica.</small>
                    <div className="campos-propios-acciones">
                      <button className="btn btn-primary btn-sm" disabled={editar.isPending || !editando.label.trim()}>Guardar</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="campos-propios-dato">
                      <strong>{campo.label}{campo.required ? <span className="required-star"> *</span> : null}</strong>
                      <small>
                        {TIPOS_DE_CAMPO.find((tipo) => tipo.value === campo.type)?.label}
                        {campo.options?.length ? ` · ${campo.options.slice(0, 4).join(', ')}${campo.options.length > 4 ? '…' : ''}` : ''}
                        {campo.metaQuestions?.length ? ` · se llena desde Meta con ${campo.metaQuestions.length} ${campo.metaQuestions.length === 1 ? 'pregunta' : 'preguntas'}` : ''}
                        {campo.clientId ? ` · sólo ${nombreDeEmpresa(campo.clientId) ?? 'una empresa'}` : ''}
                        {' · '}<code>{campo.key}</code>
                        {campo.archivedAt ? ' · archivado' : ''}
                      </small>
                    </div>
                    <div className="campos-propios-acciones">
                      {!campo.archivedAt ? <>
                        <button type="button" className="btn btn-outline btn-xs" aria-label={`Subir ${campo.label}`} disabled={indice <= 0 || editar.isPending} onClick={() => mover(campo, -1)}>↑</button>
                        <button type="button" className="btn btn-outline btn-xs" aria-label={`Bajar ${campo.label}`} disabled={indice >= activos.length - 1 || editar.isPending} onClick={() => mover(campo, 1)}>↓</button>
                        <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditando({ id: campo.id, label: campo.label, options: (campo.options ?? []).join('\n'), required: campo.required, type: campo.type, metaQuestions: (campo.metaQuestions ?? []).join('\n') })}>Editar</button>
                      </> : null}
                      <button type="button" className="btn btn-outline btn-xs" disabled={archivar.isPending} onClick={() => archivar.mutate({ id: campo.id, archivado: !campo.archivedAt })}>
                        {campo.archivedAt ? 'Desarchivar' : 'Archivar'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nuevo ? (
        <form className="campos-propios-form campos-propios-nuevo" onSubmit={(evento) => { evento.preventDefault(); if (!problemaNuevo && !faltanOpciones) crear.mutate(nuevo); }}>
          <label>Nombre<input className="input" autoFocus maxLength={80} value={nuevo.label} placeholder="Ej. Canal preferido" onChange={(evento) => {
            const label = evento.target.value;
            // La clave sigue al nombre hasta que alguien la edita a mano.
            setNuevo({ ...nuevo, label, key: nuevo.claveTocada ? nuevo.key : claveDesdeEtiqueta(label) });
          }} /></label>
          <label>Tipo<select className="input" value={nuevo.type} onChange={(evento) => setNuevo({ ...nuevo, type: evento.target.value as CustomFieldType })}>{TIPOS_DE_CAMPO.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select></label>
          {CON_OPCIONES.has(nuevo.type) ? <label className="campos-propios-opciones">Opciones <small>(una por línea)</small><textarea className="input" rows={4} value={nuevo.options} onChange={(evento) => setNuevo({ ...nuevo, options: evento.target.value })} placeholder={'WhatsApp\nCorreo\nLlamada'} /></label> : null}
          <label>Clave <small>(no se podrá cambiar)</small><input className="input" maxLength={40} value={nuevo.key} onChange={(evento) => setNuevo({ ...nuevo, key: evento.target.value.toLowerCase(), claveTocada: true })} /></label>
          <label>Empresa <small>(opcional)</small>
            <select className="input" value={nuevo.clientId} onChange={(evento) => setNuevo({ ...nuevo, clientId: evento.target.value })}>
              <option value="">Todas las empresas</option>
              {listaDeEmpresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.name}</option>)}
            </select>
            <small>Elegir una empresa hace que el campo aparezca sólo en sus fichas. Vacío: en todas.</small>
          </label>
          <label className="toggle-row"><input type="checkbox" checked={nuevo.required} onChange={(evento) => setNuevo({ ...nuevo, required: evento.target.checked })} /> Obligatorio al editar la ficha</label>
          <small className="crm-admin-ayuda">Obligatorio se exige sólo cuando alguien edita la ficha. Lo que llega por Meta o por importación nunca rebota por esto.</small>
          {nuevo.label.trim() && problemaNuevo ? <small className="error-text">{problemaNuevo}</small> : null}
          {faltanOpciones ? <small className="error-text">Agrega al menos una opción.</small> : null}
          <div className="campos-propios-acciones">
            <button className="btn btn-primary btn-sm" disabled={crear.isPending || Boolean(problemaNuevo) || faltanOpciones}>{crear.isPending ? 'Creando…' : 'Crear campo'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setAviso(null); setNuevo({ ...VACIO }); }}>+ Agregar campo</button>
      )}
    </section>
  );
}
