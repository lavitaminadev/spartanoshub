/**
 * @fileoverview Las reglas que califican los leads solos.
 *
 * Se escribe eligiendo de listas y no redactando condiciones: quien sabe describir a un buen
 * cliente tiene que poder escribir la regla. Por eso arriba se muestran las preguntas que están
 * llegando con sus respuestas reales — para escribir «contado» hay que saber que esa palabra
 * aparece, y con qué ortografía.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Modal } from '../../shared/Modal';
import { EmptyState } from '../../shared/EmptyState';
import { triggerToast } from '../../shared/toast-events';
import './reglas-de-calificacion.css';

interface Condicion { donde: string; clave?: string; comparador: string; valor?: string }
interface Acciones {
  semaforo?: 'green' | 'yellow' | 'red';
  calificacion?: string;
  descartarMotivo?: string;
  nota?: string;
}
interface Regla {
  id: string;
  nombre: string;
  posicion: number;
  activa: boolean;
  automatica: boolean;
  unir: 'todas' | 'alguna';
  condiciones?: Condicion[];
  acciones?: Acciones;
  archivedAt?: string | null;
}
interface Pregunta {
  pregunta: string;
  total: number;
  respuestas: Array<{ respuesta: string; total: number; tieneRegla: boolean }>;
}

const DONDE = [
  { value: 'respuestas', label: 'lo que contestó' },
  { value: 'pregunta', label: 'una pregunta concreta' },
  { value: 'campo', label: 'un campo propio' },
  { value: 'fuente', label: 'de dónde vino' },
  { value: 'responsable', label: 'quién lo atiende' },
  { value: 'monto', label: 'el monto' },
  { value: 'campana', label: 'la campaña' },
];

const COMPARADORES = [
  { value: 'contiene', label: 'contiene' },
  { value: 'no_contiene', label: 'no contiene' },
  { value: 'es', label: 'es exactamente' },
  { value: 'no_es', label: 'no es' },
  { value: 'mayor_que', label: 'es mayor que' },
  { value: 'menor_que', label: 'es menor que' },
  { value: 'vacio', label: 'está vacío' },
  { value: 'no_vacio', label: 'tiene algo' },
];

const SEMAFOROS = [
  { value: '', label: 'No cambiar' },
  { value: 'green', label: 'Verde · calificado' },
  { value: 'yellow', label: 'Amarillo · en revisión' },
  { value: 'red', label: 'Rojo · no califica' },
];

/** Los comparadores que no necesitan un valor escrito. */
const SIN_VALOR = ['vacio', 'no_vacio'];

const CONDICION_NUEVA: Condicion = { donde: 'respuestas', comparador: 'contiene', valor: '' };

export function ReglasDeCalificacion({ clientId, puedeEditar }: { clientId: string; puedeEditar: boolean }) {
  const qc = useQueryClient();
  const sufijo = `?clientId=${encodeURIComponent(clientId)}`;
  const claveReglas = ['crm-reglas', clientId];

  const reglas = useQuery<Regla[]>({
    queryKey: claveReglas,
    queryFn: () => api.get(`/crm/reglas${sufijo}`),
    enabled: Boolean(clientId),
  });
  const preguntas = useQuery<Pregunta[]>({
    queryKey: ['crm-reglas-preguntas', clientId],
    queryFn: () => api.get(`/crm/reglas/preguntas${sufijo}`),
    enabled: Boolean(clientId),
  });

  const [editando, setEditando] = useState<Regla | null>(null);
  const [borrador, setBorrador] = useState<{ nombre: string; unir: 'todas' | 'alguna'; condiciones: Condicion[]; acciones: Acciones } | null>(null);
  const [prueba, setPrueba] = useState<{ total: number; revisados: number; ejemplos: Array<{ nombre: string; porque: string }> } | null>(null);

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: claveReglas });
    void qc.invalidateQueries({ queryKey: ['crm-reglas-preguntas', clientId] });
  };
  const fallo = (error: Error) => triggerToast(error.message || 'No se pudo guardar', 'error');

  const guardar = useMutation({
    mutationFn: () => (editando
      ? api.put(`/crm/reglas/${editando.id}`, borrador)
      : api.post(`/crm/reglas${sufijo}`, borrador)),
    onSuccess: () => { refrescar(); cerrar(); triggerToast('Regla guardada'); },
    onError: fallo,
  });

  const cambiar = useMutation({
    mutationFn: ({ id, campo, valor }: { id: string; campo: 'activa' | 'automatica'; valor: boolean }) =>
      api.put(`/crm/reglas/${id}/${campo}`, { [campo]: valor }),
    onSuccess: () => { refrescar(); triggerToast('Regla actualizada'); },
    onError: fallo,
  });

  const archivar = useMutation({
    mutationFn: (id: string) => api.delete(`/crm/reglas/${id}`),
    onSuccess: () => { refrescar(); triggerToast('Regla archivada'); },
    onError: fallo,
  });

  const mover = useMutation({
    mutationFn: (ids: string[]) => api.put(`/crm/reglas/orden${sufijo}`, { ids }),
    onSuccess: () => { refrescar(); },
    onError: fallo,
  });

  const probar = useMutation({
    mutationFn: (): Promise<{ total: number; revisados: number; ejemplos: Array<{ nombre: string; porque: string }> }> => api.post(`/crm/reglas/probar${sufijo}`, borrador),
    onSuccess: (resultado: { total: number; revisados: number; ejemplos: Array<{ nombre: string; porque: string }> }) => setPrueba(resultado),
    onError: fallo,
  });

  const abrirNueva = () => {
    setEditando(null);
    setPrueba(null);
    setBorrador({ nombre: '', unir: 'todas', condiciones: [{ ...CONDICION_NUEVA }], acciones: { semaforo: 'green' } });
  };

  const abrirExistente = (regla: Regla) => {
    setEditando(regla);
    setPrueba(null);
    setBorrador({
      nombre: regla.nombre,
      unir: regla.unir,
      condiciones: regla.condiciones?.length ? regla.condiciones.map((c) => ({ ...c })) : [{ ...CONDICION_NUEVA }],
      acciones: { ...(regla.acciones ?? {}) },
    });
  };

  const cerrar = () => { setBorrador(null); setEditando(null); setPrueba(null); };

  /**
   * Una regla para una respuesta concreta, de un solo gesto.
   *
   * Es el camino natural: se mira lo que la gente contesta y se decide qué hacer con cada
   * respuesta. Obligar a abrir un editor vacío y transcribir el texto —que es como empezó esto—
   * convierte cuatro decisiones en cuatro formularios, y la ortografía se escribe a mano justo
   * donde un acento de más deja la regla sin calzar con nadie.
   */
  const crearDesdeRespuesta = useMutation({
    mutationFn: ({ texto, semaforo }: { texto: string; semaforo: 'green' | 'yellow' | 'red' }) => api.post(`/crm/reglas${sufijo}`, {
      nombre: texto.slice(0, 120),
      unir: 'todas',
      condiciones: [{ donde: 'respuestas', comparador: 'contiene', valor: texto }],
      acciones: { semaforo },
    }),
    onSuccess: () => { refrescar(); triggerToast('Regla creada. Pruébala y luego déjala correr sola.'); },
    onError: fallo,
  });

  const lista = reglas.data ?? [];
  /*
   * Las respuestas que ninguna regla cubre, y cuántos leads arrastran.
   *
   * El número importa tanto como la cuenta: tres respuestas sueltas de un lead cada una no son
   * lo mismo que una con cuarenta, y decidir cuál atender primero exige verlo.
   */
  const sinCubrir = (preguntas.data ?? []).flatMap((fila) => fila.respuestas.filter((respuesta) => !respuesta.tieneRegla));
  const totalSinCubrir = sinCubrir.reduce((suma, respuesta) => suma + respuesta.total, 0);
  const puedeGuardar = Boolean(borrador?.nombre.trim()) && (borrador?.condiciones ?? []).every(
    (condicion) => SIN_VALOR.includes(condicion.comparador) || String(condicion.valor ?? '').trim(),
  );

  return (
    <section className="crm-admin-panel reglas-calificacion">
      <header>
        <h2>Reglas de calificación</h2>
        {puedeEditar ? <button type="button" className="btn btn-primary btn-sm" onClick={abrirNueva}>+ Nueva regla</button> : null}
      </header>
      <p className="crm-admin-ayuda">
        Califican los leads solos según lo que contestaron. Se prueba la lista de arriba abajo y
        manda <strong>la primera que calza</strong>: si dos se contradicen, gana la de más arriba.
      </p>

      {/*
        Las preguntas que están llegando, con sus respuestas reales.

        Es lo que evita escribir reglas de memoria: el texto sale de los leads que ya entraron,
        con su ortografía exacta, y el número dice cuánto pesa cada respuesta antes de decidir.
      */}
      {/*
        Lo que está llegando y ninguna regla cubre.

        Es el fallo que no se ve: Meta cambia una opción del formulario, las reglas siguen
        buscando el texto viejo, y veinte leads entran sin calificar en la misma columna que los
        demás. Nadie lo nota hasta que alguien pregunta por qué no se llamó a nadie.
      */}
      {sinCubrir.length > 0 ? (
        <div className="alert alert-warning" role="status">
          <strong>{sinCubrir.length === 1 ? 'Una respuesta no tiene regla' : `${sinCubrir.length} respuestas no tienen regla`}</strong>
          <span> — {totalSinCubrir} {totalSinCubrir === 1 ? 'lead entra' : 'leads entran'} sin calificar. Decide qué hacer con {sinCubrir.length === 1 ? 'ella' : 'ellas'} en la lista de abajo.</span>
        </div>
      ) : null}

      <details className="reglas-preguntas" open={lista.length === 0 || sinCubrir.length > 0}>
        <summary>Qué están contestando {preguntas.data?.length ? `(${preguntas.data.length} preguntas)` : ''}</summary>
        {preguntas.isLoading ? <p className="page-subtitle">Buscando…</p> : !preguntas.data?.length ? (
          <p className="page-subtitle">Todavía no llegan respuestas de formularios en esta empresa.</p>
        ) : (
          <div className="reglas-preguntas-lista">
            {preguntas.data.map((fila) => (
              <div key={fila.pregunta} className="reglas-pregunta">
                <strong>{fila.pregunta}</strong>
                <small>{fila.total} {fila.total === 1 ? 'lead' : 'leads'}</small>
                <ul>
                  {fila.respuestas.map((respuesta) => (
                    <li key={respuesta.respuesta} className={respuesta.tieneRegla ? 'tiene-regla' : ''}>
                      <span>{respuesta.respuesta}</span>
                      <small>{respuesta.total}</small>
                      {respuesta.tieneRegla ? <em>ya tiene regla</em> : puedeEditar ? (
                        <select
                          className="input input-en-frase"
                          aria-label={`Qué hacer con «${respuesta.respuesta}»`}
                          value=""
                          disabled={crearDesdeRespuesta.isPending}
                          onChange={(evento) => {
                            const semaforo = evento.target.value as 'green' | 'yellow' | 'red' | '';
                            if (semaforo) crearDesdeRespuesta.mutate({ texto: respuesta.respuesta, semaforo });
                          }}
                        >
                          <option value="">¿Qué hago?</option>
                          <option value="green">Marcar verde</option>
                          <option value="yellow">Marcar amarillo</option>
                          <option value="red">Marcar rojo</option>
                        </select>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </details>

      {reglas.isLoading ? <p className="page-subtitle">Cargando reglas…</p> : lista.length === 0 ? (
        <EmptyState
          title="Todavía no hay reglas"
          description="Mira arriba qué están contestando y crea la primera desde una respuesta real."
        />
      ) : (
        <ol className="reglas-lista">
          {lista.map((regla, indice) => (
            <li key={regla.id} className={regla.activa ? '' : 'esta-apagada'}>
              <div className="reglas-orden">
                <span className="reglas-numero">{indice + 1}</span>
                {puedeEditar ? (
                  <>
                    <button type="button" className="btn btn-outline btn-xs" disabled={indice === 0 || mover.isPending} aria-label={`Subir ${regla.nombre}`}
                      onClick={() => mover.mutate(lista.map((r) => r.id).map((id, i, todos) => (i === indice - 1 ? todos[indice] : i === indice ? todos[indice - 1] : id)))}>↑</button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={indice === lista.length - 1 || mover.isPending} aria-label={`Bajar ${regla.nombre}`}
                      onClick={() => mover.mutate(lista.map((r) => r.id).map((id, i, todos) => (i === indice + 1 ? todos[indice] : i === indice ? todos[indice + 1] : id)))}>↓</button>
                  </>
                ) : null}
              </div>

              <div className="reglas-cuerpo">
                <strong>{regla.nombre}</strong>
                <small>
                  Si {regla.unir === 'alguna' ? 'alguna' : 'todas'}: {(regla.condiciones ?? []).map((condicion) => (
                    `${DONDE.find((d) => d.value === condicion.donde)?.label ?? condicion.donde}`
                    + `${condicion.clave ? ` «${condicion.clave}»` : ''}`
                    + ` ${COMPARADORES.find((c) => c.value === condicion.comparador)?.label ?? condicion.comparador}`
                    + `${condicion.valor ? ` «${condicion.valor}»` : ''}`
                  )).join(regla.unir === 'alguna' ? ' o ' : ' y ')}
                </small>
                <small className="reglas-hace">
                  Entonces: {[
                    regla.acciones?.semaforo ? SEMAFOROS.find((s) => s.value === regla.acciones?.semaforo)?.label : '',
                    regla.acciones?.descartarMotivo ? `descartar («${regla.acciones.descartarMotivo}»)` : '',
                    regla.acciones?.nota ? 'anotar' : '',
                  ].filter(Boolean).join(' · ') || 'nada todavía'}
                </small>
              </div>

              <div className="reglas-acciones">
                <span className={`reglas-estado ${regla.automatica ? 'es-automatica' : ''}`}>
                  {regla.automatica ? 'Corre sola' : 'Solo a mano'}
                </span>
                {puedeEditar ? (
                  <>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => abrirExistente(regla)}>Editar</button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={cambiar.isPending}
                      onClick={() => cambiar.mutate({ id: regla.id, campo: 'activa', valor: !regla.activa })}>
                      {regla.activa ? 'Pausar' : 'Reanudar'}
                    </button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={cambiar.isPending}
                      onClick={() => cambiar.mutate({ id: regla.id, campo: 'automatica', valor: !regla.automatica })}>
                      {regla.automatica ? 'Dejar de aplicarla sola' : 'Aplicarla sola'}
                    </button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={archivar.isPending}
                      onClick={() => { if (window.confirm(`«${regla.nombre}» deja de calificar leads nuevos.

Los que ya marcó se quedan como están, y la regla se conserva para poder explicar por qué.`)) archivar.mutate(regla.id); }}>
                      Quitar de la lista
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {borrador ? (
        <Modal open onClose={cerrar} title={editando ? `Editar «${editando.nombre}»` : 'Nueva regla'}>
          <div className="modal-form reglas-editor">
            <label>Nombre
              <input className="input" value={borrador.nombre} maxLength={120}
                onChange={(evento) => setBorrador({ ...borrador, nombre: evento.target.value })}
                placeholder="Ej. Paga al contado" />
            </label>

            {/*
              La regla, leída como una frase.

              Tres desplegables sueltos no dicen qué representa cada uno; la misma elección
              dentro de una frase sí. Se actualiza al escribir, así se lee lo que va a pasar
              antes de guardarlo.
            */}
            <p className="reglas-frase">
              <span>Si</span>
              <select className="input input-en-frase" aria-label="Cuántas condiciones deben cumplirse"
                value={borrador.unir} onChange={(evento) => setBorrador({ ...borrador, unir: evento.target.value as 'todas' | 'alguna' })}>
                <option value="todas">se cumple todo lo de abajo</option>
                <option value="alguna">se cumple alguna de abajo</option>
              </select>
              <span>, entonces marcar</span>
              <strong>{SEMAFOROS.find((opcion) => opcion.value === (borrador.acciones.semaforo ?? ''))?.label}</strong>
              {borrador.acciones.descartarMotivo ? <span>y descartarlo</span> : null}
            </p>

            <h4 className="reglas-subtitulo">Condiciones</h4>
            <p className="field-hint">Cada línea es una comprobación sobre el lead. Arriba eliges si hacen falta todas o basta una.</p>
            {borrador.condiciones.map((condicion, indice) => (
              <div key={indice} className="reglas-condicion">
                <span className="reglas-condicion-numero">{indice + 1}</span>
                <select className="input" aria-label="Qué mirar" value={condicion.donde}
                  onChange={(evento) => {
                    const condiciones = [...borrador.condiciones];
                    condiciones[indice] = { ...condicion, donde: evento.target.value };
                    setBorrador({ ...borrador, condiciones }); setPrueba(null);
                  }}>
                  {DONDE.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
                </select>

                {['pregunta', 'campo'].includes(condicion.donde) ? (
                  <input className="input" placeholder={condicion.donde === 'pregunta' ? 'Parte de la pregunta' : 'Clave del campo'}
                    value={condicion.clave ?? ''}
                    onChange={(evento) => {
                      const condiciones = [...borrador.condiciones];
                      condiciones[indice] = { ...condicion, clave: evento.target.value };
                      setBorrador({ ...borrador, condiciones }); setPrueba(null);
                    }} />
                ) : null}

                <select className="input" aria-label="Cómo comparar" value={condicion.comparador}
                  onChange={(evento) => {
                    const condiciones = [...borrador.condiciones];
                    condiciones[indice] = { ...condicion, comparador: evento.target.value };
                    setBorrador({ ...borrador, condiciones }); setPrueba(null);
                  }}>
                  {COMPARADORES.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
                </select>

                {SIN_VALOR.includes(condicion.comparador) ? null : (
                  <input className="input" placeholder="Qué buscar" value={condicion.valor ?? ''}
                    onChange={(evento) => {
                      const condiciones = [...borrador.condiciones];
                      condiciones[indice] = { ...condicion, valor: evento.target.value };
                      setBorrador({ ...borrador, condiciones }); setPrueba(null);
                    }} />
                )}

                {borrador.condiciones.length > 1 ? (
                  <button type="button" className="btn btn-outline btn-xs" aria-label="Quitar condición"
                    onClick={() => setBorrador({ ...borrador, condiciones: borrador.condiciones.filter((_, i) => i !== indice) })}>×</button>
                ) : null}
              </div>
            ))}

            <button type="button" className="btn btn-outline btn-sm" disabled={borrador.condiciones.length >= 10}
              onClick={() => setBorrador({ ...borrador, condiciones: [...borrador.condiciones, { ...CONDICION_NUEVA }] })}>
              + Otra condición
            </button>

            <h4 className="reglas-subtitulo">Qué hacer cuando se cumple</h4>
            <label>Marcar el semáforo
              <select className="input" value={borrador.acciones.semaforo ?? ''}
                onChange={(evento) => setBorrador({ ...borrador, acciones: { ...borrador.acciones, semaforo: (evento.target.value || undefined) as Acciones['semaforo'] } })}>
                {SEMAFOROS.map((opcion) => <option key={opcion.value} value={opcion.value}>{opcion.label}</option>)}
              </select>
            </label>

            <label>Y además descartarlo, con este motivo <em>(opcional — déjalo vacío para no descartar)</em>
              <input className="input" value={borrador.acciones.descartarMotivo ?? ''} maxLength={200}
                placeholder="Ej. Solo consultaba (sin intención)"
                onChange={(evento) => setBorrador({ ...borrador, acciones: { ...borrador.acciones, descartarMotivo: evento.target.value || undefined } })} />
            </label>

            {/*
              Probar antes de guardar.

              El número es lo que caza el error tonto: si sale 0 la regla no sirve, y si salen
              todos está mal escrita. Verlo antes evita descubrirlo con cien leads calificados.
            */}
            <div className="reglas-prueba">
              <button type="button" className="btn btn-outline btn-sm" disabled={!puedeGuardar || probar.isPending} onClick={() => probar.mutate()}>
                {probar.isPending ? 'Probando…' : 'Probar con mis leads'}
              </button>
              {prueba ? (
                <div className={prueba.total === 0 ? 'alert alert-warning' : 'alert alert-info'}>
                  <strong>{prueba.total} de {prueba.revisados}</strong> leads calzarían.
                  {prueba.total === 0 ? ' Revisa el texto: así no calificaría a nadie.' : null}
                  {prueba.ejemplos.length > 0 ? (
                    <ul>{prueba.ejemplos.map((ejemplo, i) => <li key={i}>{ejemplo.nombre} — «{ejemplo.porque}»</li>)}</ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p className="field-hint">
              La regla nace <strong>solo a mano</strong>: pruébala sobre unos pocos leads y, cuando
              confíes, déjala correr sola desde la lista.
            </p>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={cerrar}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={!puedeGuardar || guardar.isPending} onClick={() => guardar.mutate()}>
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
