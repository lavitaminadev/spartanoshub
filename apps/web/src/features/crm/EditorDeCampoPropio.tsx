/**
 * @fileoverview Crear o cambiar un campo propio, mostrando lo que se va a obtener.
 *
 * Antes eran dos formularios distintos —uno para crear, otro para editar— que habían ido
 * quedando desparejos: sólo el de edición conectaba las preguntas de Meta, y sólo el de
 * creación dejaba elegir la empresa. Es el mismo campo en los dos casos, así que es el mismo
 * formulario, y lo que cambia según el momento se dice en voz alta.
 *
 * El tipo se elige de tarjetas con un ejemplo y no de una lista: «Una opción» y «Varias
 * opciones» no significan nada leídos sueltos, y la diferencia entre ellos —elegir una o
 * marcar varias— sólo se entiende viéndola. Por eso la vista previa de abajo no es adorno: es
 * exactamente el control que aparecerá en la ficha.
 */

import { useState } from 'react';
import { claveDesdeEtiqueta, TIPOS_DE_CAMPO, type CustomFieldType } from '@espartanos/shared';

/** Los tipos que guardan una lista de opciones escritas a mano. */
export const CON_OPCIONES = new Set<CustomFieldType>(['select', 'multi_select']);

/**
 * Para qué sirve cada tipo, con un caso real al lado.
 *
 * La etiqueta sola obliga a imaginarse el resultado; el ejemplo lo enseña. Se mantiene aquí y
 * no en el paquete compartido porque es texto de esta pantalla, no parte del contrato.
 */
const AYUDA_POR_TIPO: Record<CustomFieldType, { ayuda: string; ejemplo: string }> = {
  text: { ayuda: 'Una línea escrita a mano.', ejemplo: 'Ej: «Providencia»' },
  long_text: { ayuda: 'Varias líneas, para anotar con detalle.', ejemplo: 'Ej: «Pidió que lo llamemos después de las 16:00…»' },
  number: { ayuda: 'Sólo números. Se puede sumar y ordenar.', ejemplo: 'Ej: 850000' },
  date: { ayuda: 'Una fecha del calendario.', ejemplo: 'Ej: 12-03-2026' },
  select: { ayuda: 'Se elige UNA de las opciones que tú escribas.', ejemplo: 'Ej: WhatsApp · Correo · Llamada' },
  multi_select: { ayuda: 'Se pueden marcar VARIAS de tus opciones a la vez.', ejemplo: 'Ej: Meta Ads + Sitio web' },
  boolean: { ayuda: 'Una casilla: o sí, o no.', ejemplo: 'Ej: ¿Ya firmó?' },
};

/** Qué es cada tipo de registro y dónde se rellenan sus campos. */
export const ENTIDADES: Array<{ value: 'lead' | 'contact' | 'opportunity'; label: string; que: string; donde: string }> = [
  {
    value: 'lead',
    label: 'Leads',
    que: 'Cada persona que llegó por un anuncio, el sitio o el teléfono.',
    donde: 'Se rellenan en la ficha del lead, y pueden llenarse solos desde el formulario de Meta.',
  },
  {
    value: 'contact',
    label: 'Contactos',
    que: 'La misma persona, pero vista desde una de las empresas que atiende.',
    donde: 'Se rellenan dentro de la ficha del lead, en el bloque «En esta empresa».',
  },
  {
    value: 'opportunity',
    label: 'Oportunidades',
    que: 'Cada negocio concreto que se está tratando de cerrar.',
    donde: 'Se rellenan en la ficha de la oportunidad, dentro del tablero.',
  },
];

export interface CampoEnEdicion {
  label: string;
  key: string;
  claveTocada: boolean;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  clientId: string;
  metaQuestions: string[];
}

/** Una vista previa del control tal como se verá en la ficha. */
function VistaPrevia({ campo }: { campo: CampoEnEdicion }) {
  const nombre = campo.label.trim() || 'Tu campo';
  const opciones = campo.options.filter((opcion) => opcion.trim());

  return (
    <div className="campo-previa">
      <span className="campo-previa-titulo">Así se verá en la ficha</span>
      <label className="campo-previa-campo">
        {nombre}{campo.required ? <em> *</em> : null}
        {campo.type === 'long_text' ? <textarea className="input" rows={3} disabled placeholder={AYUDA_POR_TIPO.long_text.ejemplo} />
          : campo.type === 'select' ? (
            <select className="input" disabled>
              <option>{opciones.length ? `Elige una: ${opciones[0]}…` : 'Todavía no escribiste opciones'}</option>
            </select>
          ) : campo.type === 'multi_select' ? (
            <span className="campo-previa-marcas">
              {opciones.length
                ? opciones.map((opcion) => <span key={opcion}><input type="checkbox" disabled /> {opcion}</span>)
                : <small>Todavía no escribiste opciones</small>}
            </span>
          ) : campo.type === 'boolean' ? <span className="campo-previa-marcas"><span><input type="checkbox" disabled /> Sí</span></span>
            : <input className="input" disabled type={campo.type === 'number' ? 'number' : campo.type === 'date' ? 'date' : 'text'}
              placeholder={AYUDA_POR_TIPO[campo.type].ejemplo} />}
      </label>
    </div>
  );
}

/**
 * @param campo - Lo que se está escribiendo.
 * @param esNuevo - Al crear se piden la clave y la empresa; al editar ya no se pueden cambiar.
 * @param entidad - A qué tipo de registro pertenece: decide si se ofrecen las preguntas de Meta.
 */
export function EditorDeCampoPropio({
  campo, setCampo, esNuevo, entidad, empresas, problemaDeLaClave, guardando, onGuardar, onCancelar,
}: {
  campo: CampoEnEdicion;
  setCampo: (siguiente: CampoEnEdicion) => void;
  esNuevo: boolean;
  entidad: 'lead' | 'contact' | 'opportunity';
  empresas: Array<{ id: string; name: string }>;
  problemaDeLaClave: string | null;
  guardando: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const [verMeta, setVerMeta] = useState(campo.metaQuestions.length > 0);
  const necesitaOpciones = CON_OPCIONES.has(campo.type);
  const opcionesEscritas = campo.options.filter((opcion) => opcion.trim());

  const faltas: string[] = [];
  if (!campo.label.trim()) faltas.push('Ponle un nombre al campo.');
  if (esNuevo && campo.label.trim() && problemaDeLaClave) faltas.push(problemaDeLaClave);
  if (necesitaOpciones && opcionesEscritas.length < 2) faltas.push('Escribe al menos dos opciones para elegir entre ellas.');

  const cambiarOpcion = (indice: number, texto: string) => {
    const options = campo.options.map((opcion, i) => (i === indice ? texto : opcion));
    setCampo({ ...campo, options });
  };

  return (
    <form className="campos-propios-form campo-guiado" onSubmit={(evento) => { evento.preventDefault(); if (faltas.length === 0) onGuardar(); }}>
      <label>¿Cómo se va a llamar?
        <input className="input" autoFocus={esNuevo} maxLength={80} value={campo.label} placeholder="Ej. Canal preferido"
          onChange={(evento) => {
            const label = evento.target.value;
            // La clave sigue al nombre hasta que alguien la edita a mano.
            setCampo({ ...campo, label, key: !esNuevo || campo.claveTocada ? campo.key : claveDesdeEtiqueta(label) });
          }} />
        <small>Es el título que verá tu equipo sobre el dato, en la ficha.</small>
      </label>

      <fieldset className="campo-tipos">
        <legend>¿Qué clase de dato es?</legend>
        {TIPOS_DE_CAMPO.map((tipo) => (
          <label key={tipo.value} className={`campo-tipo ${campo.type === tipo.value ? 'elegido' : ''}`}>
            <input type="radio" name="campo-tipo" checked={campo.type === tipo.value}
              onChange={() => setCampo({
                ...campo,
                type: tipo.value,
                // Las opciones sólo existen para los tipos que eligen de una lista.
                options: CON_OPCIONES.has(tipo.value) && campo.options.length === 0 ? ['', ''] : campo.options,
              })} />
            <span>
              <strong>{tipo.label}</strong>
              <small>{AYUDA_POR_TIPO[tipo.value].ayuda}</small>
              <small className="campo-tipo-ejemplo">{AYUDA_POR_TIPO[tipo.value].ejemplo}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {/*
        Las opciones, una por caja y no un bloque de texto.

        Escritas en un recuadro de varias líneas no se veía que cada línea fuera una opción:
        alguien escribía «WhatsApp, Correo» en una sola y creaba una opción llamada así.
      */}
      {necesitaOpciones ? (
        <fieldset className="campo-opciones">
          <legend>
            {campo.type === 'select' ? 'Entre cuáles se elige (se marca una sola)' : 'Cuáles se pueden marcar (se pueden marcar varias)'}
          </legend>
          {campo.options.map((opcion, indice) => (
            <div key={indice} className="campo-opcion">
              <span>{indice + 1}</span>
              <input className="input" maxLength={80} value={opcion} placeholder={['WhatsApp', 'Correo', 'Llamada'][indice] ?? 'Otra opción'}
                onChange={(evento) => cambiarOpcion(indice, evento.target.value)} />
              <button type="button" className="btn btn-outline btn-xs" aria-label={`Quitar la opción ${indice + 1}`}
                disabled={campo.options.length <= 2}
                onClick={() => setCampo({ ...campo, options: campo.options.filter((_, i) => i !== indice) })}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" disabled={campo.options.length >= 30}
            onClick={() => setCampo({ ...campo, options: [...campo.options, ''] })}>
            + Agregar otra opción
          </button>
        </fieldset>
      ) : null}

      <VistaPrevia campo={campo} />

      <label className="toggle-row">
        <input type="checkbox" checked={campo.required} onChange={(evento) => setCampo({ ...campo, required: evento.target.checked })} />
        {' '}No dejar guardar la ficha sin este dato
        <small>
          Se exige sólo cuando una persona edita la ficha a mano. Lo que llega por Meta o por
          una importación nunca se rechaza por esto.
        </small>
      </label>

      {/*
        Conectar el campo con el formulario del anuncio.

        Va plegado porque no todos los campos vienen de Meta, y abierto en cuanto hay alguna
        pregunta escrita: lo que ya está configurado no se esconde.
      */}
      {entidad === 'lead' ? (
        <div className="campo-meta">
          <label className="toggle-row">
            <input type="checkbox" checked={verMeta} onChange={(evento) => setVerMeta(evento.target.checked)} />
            {' '}Este dato lo pregunta mi formulario de Meta
            <small>Márcalo para que las respuestas del anuncio caigan solas en este campo.</small>
          </label>
          {verMeta ? (
            <label>Copia aquí la pregunta, tal como está escrita en el anuncio
              <textarea className="input" rows={3} value={campo.metaQuestions.join('\n')}
                placeholder={'¿Cuál es tu presupuesto?\n¿Cuánto piensas invertir?'}
                onChange={(evento) => setCampo({ ...campo, metaQuestions: evento.target.value.split('\n') })} />
              <small>
                Una por línea: si cambias la redacción entre campañas, pon las dos y las dos
                sirven. Dan igual las tildes, las mayúsculas y los signos. Lo que no coincida con
                ningún campo sigue yendo a las notas del lead.
              </small>
            </label>
          ) : null}
        </div>
      ) : null}

      {esNuevo ? (
        <>
          <label>¿De qué empresa es este campo?
            <select className="input" value={campo.clientId} onChange={(evento) => setCampo({ ...campo, clientId: evento.target.value })}>
              <option value="">De todas — aparece en las fichas de cualquier empresa</option>
              {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>Sólo {empresa.name}</option>)}
            </select>
            <small>Si sólo un cliente lo necesita, elige su empresa: así no aparece en las fichas de los demás.</small>
          </label>
          <label className="campo-clave">Nombre interno <small>(no se podrá cambiar nunca más)</small>
            <input className="input" maxLength={40} value={campo.key}
              onChange={(evento) => setCampo({ ...campo, key: evento.target.value.toLowerCase(), claveTocada: true })} />
            <small>
              Se escribe solo a partir del nombre. Es como quedan guardados los datos por dentro,
              así que no se puede cambiar después sin perderlos. Normalmente no hay que tocarlo.
            </small>
          </label>
        </>
      ) : (
        <p className="field-hint">
          El nombre interno <code>{campo.key}</code> no cambia: es la llave de todo lo ya
          guardado. Si el tipo nuevo o las opciones dejaran algún dato guardado sin sentido, el
          cambio se rechaza y te dice cuántos.
        </p>
      )}

      {faltas.length > 0 ? (
        <div className="alert alert-warning" role="status">
          <strong>Falta esto:</strong>
          <ul>{faltas.map((falta) => <li key={falta}>{falta}</li>)}</ul>
        </div>
      ) : null}

      <div className="campos-propios-acciones">
        <button className="btn btn-primary btn-sm" disabled={guardando || faltas.length > 0}>
          {guardando ? 'Guardando…' : esNuevo ? 'Crear el campo' : 'Guardar cambios'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
