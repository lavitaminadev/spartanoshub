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
import { EmptyState } from '../../shared/EmptyState';
import { triggerToast } from '../../shared/toast-events';
import { EditorDeRegla, comoSeLee, CONDICION_NUEVA } from './EditorDeRegla';
import { useEtapasOcultas, useStageLabels } from './use-stage-labels';
import { STAGES, STAGE_LABEL } from './stage-labels';
import type { Acciones, Condicion, Pregunta } from './EditorDeRegla';
import './reglas-de-calificacion.css';

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

  /*
   * Las columnas de verdad de ese tablero, con el nombre que les puso esa empresa.
   *
   * El editor traía su propia lista escrita a mano y decía «Cotizados» donde el tablero dice
   * «Agendado esperando reunión», y ofrecía columnas que la empresa había escondido: se
   * elegía un destino que no existe en su pantalla.
   */
  const rotulos = useStageLabels(clientId);
  const ocultas = useEtapasOcultas(clientId);
  const etapas = STAGES
    .filter((etapa) => !ocultas.includes(etapa))
    .map((etapa) => ({ value: etapa, titulo: rotulos[etapa] ?? STAGE_LABEL[etapa] ?? etapa }));

  const lista = reglas.data ?? [];
  /*
   * Las respuestas que ninguna regla cubre, y cuántos leads arrastran.
   *
   * El número importa tanto como la cuenta: tres respuestas sueltas de un lead cada una no son
   * lo mismo que una con cuarenta, y decidir cuál atender primero exige verlo.
   */
  const sinCubrir = (preguntas.data ?? []).flatMap((fila) => fila.respuestas.filter((respuesta) => !respuesta.tieneRegla));
  const totalSinCubrir = sinCubrir.reduce((suma, respuesta) => suma + respuesta.total, 0);

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
        El camino, cuando todavía no hay ninguna regla.

        La pantalla arrancaba con el catálogo de respuestas abierto y una lista vacía, y eso no
        dice por dónde empezar: lo que se ve son datos, no una tarea. Tres pasos numerados
        convierten la pantalla en algo que se sigue, y desaparecen en cuanto hay una regla,
        porque entonces estorban.
      */}
      {lista.length === 0 && !reglas.isLoading ? (
        <ol className="reglas-guia">
          <li>
            <strong>Mira qué te están contestando</strong>
            <span>Abajo están las respuestas reales de tus leads, con cuántos las dieron.</span>
          </li>
          <li>
            <strong>Elige qué hacer con cada una</strong>
            <span>En «¿Qué hago?» marcas verde, amarillo o rojo. Cada elección crea una regla.</span>
          </li>
          <li>
            <strong>Pruébala y déjala correr</strong>
            <span>Nace en «solo a mano»: la aplicas desde el tablero a unos pocos y, cuando confíes, la sueltas.</span>
          </li>
        </ol>
      ) : null}

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
                {/*
                  La regla contada igual en la lista que en el editor.

                  Antes la lista la resumía con sus propias palabras —«Si todas: lo que contestó
                  contiene…»— y el editor con otras: quien acababa de escribirla no reconocía en
                  la lista la misma regla. Ahora es la misma frase en los dos sitios.
                */}
                <small className="reglas-hace">{comoSeLee({
                  nombre: regla.nombre,
                  unir: regla.unir,
                  condiciones: regla.condiciones ?? [],
                  acciones: regla.acciones ?? {},
                }, etapas)}</small>
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
        <EditorDeRegla
          borrador={borrador}
          setBorrador={setBorrador}
          editando={editando}
          preguntas={preguntas.data ?? []}
          etapas={etapas}
          prueba={prueba}
          probando={probar.isPending}
          onProbar={() => probar.mutate()}
          guardando={guardar.isPending}
          onGuardar={() => guardar.mutate()}
          onCerrar={cerrar}
        />
      ) : null}
    </section>
  );
}
