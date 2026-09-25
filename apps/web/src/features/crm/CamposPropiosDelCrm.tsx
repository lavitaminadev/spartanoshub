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
import { problemaDeClave, TIPOS_DE_CAMPO, type CustomFieldDefinition, type CustomFieldEntity } from '@espartanos/shared';
import { api } from '../../core/api';
import { CON_OPCIONES, EditorDeCampoPropio, ENTIDADES, type CampoEnEdicion } from './EditorDeCampoPropio';
import './campos-propios-guiado.css';

/** Deja fuera las líneas en blanco que quedan de las cajas vacías del formulario. */
const limpiar = (lineas: string[]): string[] => lineas.map((linea) => linea.trim()).filter(Boolean);

const VACIO: CampoEnEdicion ={ label: '', key: '', claveTocada: false, type: 'text', options: [], required: false, clientId: '', metaQuestions: [] };

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
  const [nuevo, setNuevo] = useState<CampoEnEdicion | null>(null);
  const [editando, setEditando] = useState<{ id: string; datos: CampoEnEdicion } | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const clave = ['crm-fields', entidad, verArchivados];
  const campos = useQuery<CustomFieldDefinition[]>({
    queryKey: clave,
    queryFn: () => api.get(`/crm/fields?entity=${entidad}${verArchivados ? '&archivados=true' : ''}`),
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['crm-fields'] });
  const fallo = (error: Error) => setAviso({ tono: 'error', texto: error.message || 'No se pudo guardar' });

  const crear = useMutation({
    mutationFn: (borrador: CampoEnEdicion) => api.post<CustomFieldDefinition>('/crm/fields', {
      entity: entidad,
      label: borrador.label.trim(),
      clientId: borrador.clientId || undefined,
      key: borrador.key.trim(),
      type: borrador.type,
      options: CON_OPCIONES.has(borrador.type) ? limpiar(borrador.options) : undefined,
      required: borrador.required,
      metaQuestions: entidad === 'lead' ? limpiar(borrador.metaQuestions) : undefined,
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

  const problemaNuevo = nuevo && nuevo.label.trim() ? problemaDeClave(nuevo.key) : null;

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
      {/*
        Aquí un campo sin empresa se hereda; una campaña sin empresa no.

        Son dos reglas opuestas en la misma pantalla, y cada una tiene su motivo: un campo que
        sirve a todas se declara una vez, mientras que una campaña de la agencia no es de nadie
        más. Lo que faltaba era decirlo: se avisaba en campañas y no acá, así que un campo creado
        sin empresa aparecía en las fichas de todas sin que nadie lo hubiera pedido.
      */}
      <p className="crm-admin-explica">
        Un campo <strong>sin empresa aparece en todas</strong>, y uno con empresa sólo en la suya. Para algo
        que necesita un solo cliente, elige su empresa al crearlo.
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
        Qué es cada pestaña y dónde se rellena, siempre a la vista.

        Se explicaba sólo «Contactos», así que las otras dos parecían no necesitar explicación
        —y no es cierto: «Oportunidades» no dice por sí solo que se refiere al negocio y no a
        la persona, y nadie sabía dónde iban a aparecer esos campos una vez creados—.
      */}
      <p className="campos-propios-que-es">
        <strong>{ENTIDADES.find((item) => item.value === entidad)?.que}</strong>
        <span>{ENTIDADES.find((item) => item.value === entidad)?.donde}</span>
      </p>

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
                  <EditorDeCampoPropio
                    campo={editando.datos}
                    setCampo={(datos) => setEditando({ id: campo.id, datos })}
                    esNuevo={false}
                    entidad={entidad}
                    empresas={listaDeEmpresas}
                    problemaDeLaClave={null}
                    guardando={editar.isPending}
                    onCancelar={() => setEditando(null)}
                    onGuardar={() => editar.mutate({ id: campo.id, cambios: {
                      label: editando.datos.label,
                      required: editando.datos.required,
                      type: editando.datos.type,
                      metaQuestions: limpiar(editando.datos.metaQuestions),
                      ...(CON_OPCIONES.has(editando.datos.type) ? { options: limpiar(editando.datos.options) } : {}),
                    } })}
                  />
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
                        <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditando({ id: campo.id, datos: { label: campo.label, key: campo.key, claveTocada: true, type: campo.type, options: campo.options ?? [], required: campo.required, clientId: campo.clientId ?? '', metaQuestions: campo.metaQuestions ?? [] } })}>Editar</button>
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
        <EditorDeCampoPropio
          campo={nuevo}
          setCampo={setNuevo}
          esNuevo
          entidad={entidad}
          empresas={listaDeEmpresas}
          problemaDeLaClave={problemaNuevo}
          guardando={crear.isPending}
          onGuardar={() => crear.mutate(nuevo)}
          onCancelar={() => setNuevo(null)}
        />
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setAviso(null); setNuevo({ ...VACIO }); }}>+ Agregar campo</button>
      )}
    </section>
  );
}
