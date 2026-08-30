/**
 * @fileoverview Calendario del CRM: mes, semana o día, con lo que hay agendado.
 *
 * Las tres vistas responden preguntas distintas y por eso conviven: el mes dice cómo viene el
 * período, la semana permite leer las horas, y el día es a lo que se entra por la mañana para
 * saber qué toca. Cada una exporta exactamente lo que se está mirando.
 *
 * Usa las actividades del propio CRM. Así la agenda comparte alcance, empresa y permisos con el
 * tablero, en vez de depender del módulo futuro de Reuniones y terminar en 403.
 */

import { useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { MEDIOS, TIPOS_AGENDABLES, TIPO_DE_ACTIVIDAD, admiteMedio, campoDelMedio } from './tipos-de-actividad';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { Modal } from '../../shared/Modal';
import { useCrmScope } from './crm-scope';
import { useVocabulario } from './use-vocabulario';
import { franjasDelDia } from './jornada';
import { ExportButtons, type ExportDocument } from '../../shared/export';
import './crm-calendar.css';

interface Actividad {
  id: string;
  type: string;
  description?: string;
  date: string;
  /**
   * Si es un compromiso futuro en vez de algo que ya ocurrió.
   *
   * Las dos cosas caben en la misma agenda —el día tuvo lo que pasó y lo que hay que hacer—
   * pero no se leen igual: una tarea pendiente es una decisión, y una actividad registrada es
   * historia. Se distinguen al pintarlas.
   */
  esTarea?: boolean;
  completada?: boolean;
}


const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Clave estable de un día, en hora local. `toISOString` la desplazaría al huso UTC. */
function claveDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/**
 * Celdas del mes, empezando en lunes y completando la primera y última semana.
 *
 * Se devuelven los días vecinos en gris en vez de dejar huecos: una cuadrícula incompleta hace
 * que las columnas dejen de alinearse con los días de la semana.
 */
function celdasDelMes(ancla: Date): Array<{ fecha: Date; delMes: boolean }> {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  // `getDay()` devuelve 0 para domingo; acá la semana empieza el lunes.
  const desplazamiento = (primero.getDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - desplazamiento);

  return Array.from({ length: 42 }, (_, indice) => {
    const fecha = new Date(inicio);
    fecha.setDate(inicio.getDate() + indice);
    return { fecha, delMes: fecha.getMonth() === ancla.getMonth() };
  });
}

/**
 * Los siete días de la semana en que cae la fecha, empezando en lunes.
 *
 * La vista semanal existe porque el mes no sirve para trabajar el día: con celdas de un
 * centímetro, tres visitas seguidas se ven como tres líneas cortadas. La semana da alto
 * suficiente para leer a qué hora es cada una.
 */
function celdasDeLaSemana(ancla: Date): Array<{ fecha: Date; delMes: boolean }> {
  const desplazamiento = (ancla.getDay() + 6) % 7;
  const lunes = new Date(ancla);
  lunes.setDate(ancla.getDate() - desplazamiento);

  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + indice);
    // En la semana todos los días son «del mes»: no hay vecinos que atenuar.
    return { fecha, delMes: true };
  });
}

/**
 * El día en que cae la fecha, como única celda.
 *
 * El mes responde «cómo viene la semana que entra» y el día responde «qué hago ahora». Con
 * cuatro visitas el mismo martes, la celda del mes las recorta y ni la semana da alto para
 * leerlas completas: se veían cuatro líneas cortadas sin hora.
 */
function celdasDelDia(ancla: Date): Array<{ fecha: Date; delMes: boolean }> {
  return [{ fecha: new Date(ancla), delMes: true }];
}

/** Cómo se lee cada tipo de actividad. La clave es la que guarda el servidor. */

/** Hora local de una actividad, sin la fecha: la fecha ya la da la celda donde está. */
function horaDe(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Cómo se titula una actividad en la cuadrícula.
 *
 * La descripción entera no cabe en una celda de mes y se cortaba a media palabra, así que la
 * celda mostraba un párrafo truncado en vez de decir qué era. Acá se toma la primera línea y,
 * cuando no hay descripción, el tipo: «Reunión» dice más que un hueco. El texto completo sigue
 * disponible en el `title` y en la exportación.
 */
function tituloDe(actividad: Actividad): string {
  const primera = actividad.description?.split('\n')[0]?.trim();
  return primera || TIPO_DE_ACTIVIDAD[actividad.type] || 'Actividad';
}

/** Forma en que se mira la agenda. */
type Vista = 'mes' | 'semana' | 'dia';

const VISTAS: Array<{ value: Vista; label: string }> = [
  { value: 'mes', label: 'Mes' },
  { value: 'semana', label: 'Semana' },
  { value: 'dia', label: 'Día' },
];


export function CrmCalendarPage(): JSX.Element {
  const [ancla, setAncla] = useState(() => new Date());
  const [vista, setVista] = useState<Vista>('mes');
  // De qué empresa es la agenda. Sin esto se veían —y se exportaban— reuniones de otras cuentas
  // bajo el encabezado de la empresa elegida, que es la forma más silenciosa de mezclarlas.
  const scope = useCrmScope();
  const queryClient = useQueryClient();
  // Cómo llama esta empresa a sus cosas. De fábrica para lo que no haya renombrado.
  const { termino } = useVocabulario(scope.clientId);

  const celdas = useMemo(() => {
    if (vista === 'mes') return celdasDelMes(ancla);
    if (vista === 'semana') return celdasDeLaSemana(ancla);
    return celdasDelDia(ancla);
  }, [ancla, vista]);

  /**
   * Extremos de lo que se está dibujando, para pedir exactamente eso.
   *
   * Antes se pedían las 100 actividades más recientes sin rango, y la pantalla fallaba de dos
   * formas que se leían igual —«no hay nada agendado»—: retroceder a un mes anterior no traía
   * ninguna de ese mes, porque las recientes agotaban el cupo; y un mes con más de cien se
   * dibujaba incompleto sin avisar.
   *
   * El día se cubre entero: desde su primer instante hasta el último, porque una actividad de
   * las 23:40 pertenece a ese día aunque la petición se arme a mediodía.
   */
  const rango = useMemo(() => {
    const desde = new Date(celdas[0].fecha);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(celdas[celdas.length - 1].fecha);
    hasta.setHours(23, 59, 59, 999);
    return { desde: desde.toISOString(), hasta: hasta.toISOString() };
  }, [celdas]);

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ data: Actividad[] }>({
    // El rango forma parte de la clave: cambiar de mes trae otras actividades, no las mismas
    // filtradas, así que su resultado no puede reutilizar la caché del período anterior.
    queryKey: ['crm-calendario', scope.clientId, rango.desde, rango.hasta],
    queryFn: () => api.get(
      `/crm/interactions?limit=500&from=${encodeURIComponent(rango.desde)}&to=${encodeURIComponent(rango.hasta)}`
      + `${scope.clientId ? `&clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
    retry: false,
  });

  /*
   * Las tareas que vencen en el mismo rango.
   *
   * Van en una consulta aparte y no dentro de la de actividades porque son cosas distintas en
   * tablas distintas: una es lo que se registró, la otra lo que falta por hacer. Unirlas en el
   * servidor obligaría a inventar una vista para ahorrar una petición que el navegador ya hace
   * en paralelo con la otra.
   *
   * Si falla, el calendario sigue mostrando las actividades: perder los compromisos es malo,
   * pero mucho menos que una pantalla en blanco.
   */
  const { data: tareas } = useQuery<{ data: Array<{ id: string; title: string; dueAt?: string | null; status: string }> }>({
    queryKey: ['crm-calendario-tareas', scope.clientId, rango.desde, rango.hasta],
    queryFn: () => api.get(
      `/tasks/agenda?from=${encodeURIComponent(rango.desde)}&to=${encodeURIComponent(rango.hasta)}`,
    ),
    retry: false,
  });

  /** Las tareas con forma de actividad, para que el calendario pinte una sola lista ordenada. */
  const tareasComoActividad = useMemo<Actividad[]>(() => (tareas?.data ?? [])
    .filter((tarea) => Boolean(tarea.dueAt))
    .map((tarea) => ({
      id: `tarea-${tarea.id}`,
      type: 'task',
      description: tarea.title,
      date: tarea.dueAt as string,
      esTarea: true,
      completada: tarea.status === 'done' || tarea.status === 'cancelled',
    })), [tareas]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Actividad[]>();
    for (const actividad of [...(data?.data ?? []), ...tareasComoActividad]) {
      if (!actividad.date) continue;
      const clave = claveDia(new Date(actividad.date));
      mapa.set(clave, [...(mapa.get(clave) ?? []), actividad]);
    }
    return mapa;
  }, [data, tareasComoActividad]);

  const hoy = claveDia(new Date());

  /** Las flechas avanzan lo que se está mirando: un mes, una semana o un día. */
  const mover = (pasos: number) => {
    const siguiente = new Date(ancla);
    if (vista === 'mes') siguiente.setMonth(ancla.getMonth() + pasos);
    else if (vista === 'semana') siguiente.setDate(ancla.getDate() + pasos * 7);
    else siguiente.setDate(ancla.getDate() + pasos);
    setAncla(siguiente);
  };

  const titulo = vista === 'mes'
    ? ancla.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    : vista === 'semana'
      ? `Semana del ${celdas[0].fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
      : ancla.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  /**
   * Agendar desde el propio calendario.
   *
   * Hasta ahora la agenda era de solo lectura: para anotar una visita había que buscar el lead,
   * abrir su ficha y registrar la actividad ahí. Pero quien está mirando la semana para ver dónde
   * cabe algo ya tiene delante la respuesta, y mandarlo a otra pantalla convierte un gesto en un
   * recado.
   *
   * El lead es opcional a propósito: no toda actividad de la agenda cuelga de un contacto —una
   * reunión de equipo, un bloqueo— y exigirlo obligaría a inventar uno.
   */
  const [agendando, setAgendando] = useState<{ type: string; description: string; date: string; leadId: string; medium: string; location: string } | null>(null);

  const agendar = useMutation({
    mutationFn: () => api.post('/crm/interactions', {
      type: agendando!.type,
      description: agendando!.description.trim(),
      date: new Date(agendando!.date).toISOString(),
      leadId: agendando!.leadId || undefined,
      // Vacío se manda como ausente y no como cadena vacía: en la base, «no tiene medio» y
      // «tiene el medio ""» se leerían igual al mostrarlo pero distinto al filtrar.
      medium: agendando!.medium || undefined,
      location: agendando!.location.trim() || undefined,
    }),
    onSuccess: async () => {
      setAgendando(null);
      await queryClient.invalidateQueries({ queryKey: ['crm-calendario'] });
    },
  });

  /** Lo que hay agendado dentro de la cuadrícula visible, en orden cronológico. */
  const eventosDelPeriodo = useMemo(() => {
    const claves = new Set(celdas.map(({ fecha }) => claveDia(fecha)));
    return (data?.data ?? [])
      .filter((actividad) => actividad.date && claves.has(claveDia(new Date(actividad.date))))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, celdas]);

  const documento: ExportDocument<Actividad> = {
    fileName: vista === 'mes' ? 'agenda-mensual' : vista === 'semana' ? 'agenda-semanal' : 'agenda-del-dia',
    title: `Agenda · ${titulo}`,
    subtitle: `${eventosDelPeriodo.length} actividad(es) en el período`,
    meta: [
      { label: 'Período', value: titulo },
      { label: 'Vista', value: vista === 'mes' ? 'Mensual' : vista === 'semana' ? 'Semanal' : 'Diaria' },
    ],
    columns: [
      { header: 'Fecha', value: (r) => new Date(r.date).toLocaleDateString('es-CL'), width: 12 },
      { header: 'Hora', value: (r) => new Date(r.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), width: 8 },
      { header: 'Tipo', value: (r) => r.type, width: 12 },
      { header: 'Actividad', value: (r) => r.description || 'Actividad CRM', width: 40 },
    ],
    rows: eventosDelPeriodo,
    footer: 'Espartanos · CRM',
  };

  if (isLoading) return <LoadingSpinner text="Cargando el mes..." />;
  if (error) return <QueryErrorState title="No pudimos cargar el calendario CRM" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  return (
    <div className="page crm-cal">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">AGENDA</span>
          <h1>Calendario</h1>
        </div>
        <div className="crm-cal-controles">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => mover(-1)} aria-label="Anterior">‹</button>
          <strong>{titulo}</strong>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => mover(1)} aria-label="Siguiente">›</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setAncla(new Date())}>Hoy</button>
          {/*
            Agenda sobre el día que se está mirando, no sobre hoy.

            Quien retrocedió a la semana pasada para anotar algo que pasó ahí espera que la fecha
            venga puesta en lo que tiene delante. Se propone la mañana —09:00— porque una hora
            vacía obliga a escribirla entera y la mayoría de las visitas se agendan de día.
          */}
          {scope.puedeEditar ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const propuesta = new Date(ancla);
                propuesta.setHours(9, 0, 0, 0);
                const local = new Date(propuesta.getTime() - propuesta.getTimezoneOffset() * 60_000);
                setAgendando({ type: 'meeting', description: '', date: local.toISOString().slice(0, 16), leadId: '', medium: '', location: '' });
              }}
            >
              + Agendar
            </button>
          ) : null}
          {/*
            La agenda impresa del período que se está mirando.

            Se lleva a una reunión o se pega en la pared, y para eso hace falta en papel lo que
            en pantalla se ve de un vistazo. Exporta exactamente lo que está en la cuadrícula
            —mes o semana—, no un rango fijo: si se exportara siempre la semana, el archivo
            diría algo distinto de lo que la persona tenía delante al pulsar.
          */}
          <ExportButtons document={documento} csv={false} />
          {/*
            Tres botones a la vista, no un desplegable.

            Cambiar de mes a día es lo que más se hace en esta pantalla, y estaba escondido en un
            <select> sin rótulo visible entre botones: había que abrirlo para saber que existía.
            Con las tres opciones delante se ve de un vistazo cuál está puesta y cuáles hay.
          */}
          <div className="crm-cal-vistas" role="group" aria-label="Forma de ver la agenda">
            {VISTAS.map((opcion) => (
              <button
                key={opcion.value}
                type="button"
                className={`btn btn-sm ${vista === opcion.value ? 'btn-primary' : 'btn-outline'}`}
                aria-pressed={vista === opcion.value}
                onClick={() => setVista(opcion.value)}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*
        El día no es una casilla del mes: es una jornada con horas.

        Antes la vista diaria reusaba la misma celda del mes, así que mostraba el número del día
        y una lista suelta. Sin la columna de horas no se ve el hueco entre las 11 y las 16, que
        es justo lo que se mira al decidir a qué hora ofrecer una visita.
      */}
      {vista === 'dia' ? (
        <div className="crm-cal-dia" aria-label="Agenda del día">
          {/*
            El día que se mira, escrito.

            La jornada es una columna de horas idénticas para cualquier fecha: sin el encabezado,
            volver de «Hoy» a otro día deja la pantalla sin decir de cuál se trata.
          */}
          <p className="crm-cal-dia-titulo">
            {ancla.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {franjasDelDia(porDia.get(claveDia(ancla)) ?? []).map((franja) => (
            <div key={franja.hora} className={`crm-cal-franja${franja.eventos.length ? ' con-eventos' : ''}`}>
              <time className="crm-cal-hora">{String(franja.hora).padStart(2, '0')}:00</time>
              <div className="crm-cal-franja-cuerpo">
                {franja.eventos.map((evento) => (
                  <span
                    key={evento.id}
                    className={`crm-cal-evento tipo-${evento.type}${evento.completada ? ' esta-completada' : ''}`}
                    title={`${horaDe(evento.date)} · ${evento.description || TIPO_DE_ACTIVIDAD[evento.type] || evento.type}`}
                  >
                    <time>{horaDe(evento.date)}</time>
                    <b>{tituloDe(evento)}</b>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {/*
            Una jornada vacía se dice, no se deja en blanco.

            Doce franjas sin nada y una pantalla que no cargó se ven parecido; la frase separa
            «miré y no hay nada» de «esto está roto».
          */}
          {!(porDia.get(claveDia(ancla)) ?? []).length ? (
            <p className="crm-cal-dia-vacio">Nada agendado este día.</p>
          ) : null}
        </div>
      ) : (
        <div
          className={`crm-cal-grilla${vista === 'semana' ? ' es-semana' : ''}`}
          role="grid"
          aria-label={`Calendario ${vista === 'mes' ? 'mensual' : 'semanal'}`}
        >
          {DIAS.map((dia) => <span key={dia} className="crm-cal-cabecera">{dia}</span>)}

          {celdas.map(({ fecha, delMes }) => {
            const clave = claveDia(fecha);
            // En orden de reloj: una agenda que no va de la mañana a la tarde no es una agenda.
            const eventos = [...(porDia.get(clave) ?? [])]
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            return (
              <div
                key={clave}
                className={`crm-cal-celda${delMes ? '' : ' fuera'}${clave === hoy ? ' hoy' : ''}`}
              >
                {/*
                  El número del día abre ese día.

                  Sin esto, para ver el martes por horas había que pulsar «Día» —que muestra el
                  día anclado, no el que se está mirando— y después navegar hasta él. Pulsar la
                  fecha es lo que cualquiera intenta primero.
                */}
                <button
                  type="button"
                  className="crm-cal-numero"
                  title={`Ver el ${fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })} por horas`}
                  onClick={() => { setAncla(new Date(fecha)); setVista('dia'); }}
                >
                  {fecha.getDate()}
                </button>
                {/*
                  Hora primero y después qué es.

                  Antes la celda volcaba la descripción completa, así que en el mes se leía un
                  párrafo cortado a media palabra y no se veía a qué hora era nada —que es lo
                  único que se busca al mirar la agenda—. El texto entero sigue en el `title` y
                  en la exportación.
                */}
                {eventos.map((evento) => (
                  <span
                    key={evento.id}
                    className={`crm-cal-evento tipo-${evento.type}${evento.completada ? ' esta-completada' : ''}`}
                    title={`${horaDe(evento.date)} · ${evento.description || TIPO_DE_ACTIVIDAD[evento.type] || evento.type}`}
                  >
                    <time>{horaDe(evento.date)}</time>
                    <b>{tituloDe(evento)}</b>
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!data?.data.length ? (
        // No es un error: puede no haber nada agendado, o el cargo puede no alcanzar las
        // reuniones. Decirlo evita que un mes vacío se lea como calendario roto.
        <p className="crm-cal-vacio">
          No hay actividades agendadas visibles para esta {termino('empresa').toLowerCase()}.
        </p>
      ) : null}

      {agendando ? (
        <Modal open onClose={() => setAgendando(null)} title="Agendar actividad">
          <div className="modal-form">
            <label>
              Tipo
              <select
                className="input"
                value={agendando.type}
                onChange={(evento) => setAgendando({ ...agendando, type: evento.target.value })}
              >
                {TIPOS_AGENDABLES.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </label>
            {/*
              El medio solo se pregunta donde significa algo.

              Una llamada ya dice por dónde ocurre y una nota no ocurre en ninguna parte:
              ofrecerles el campo sería pedir un dato que nadie puede responder bien.
            */}
            {admiteMedio(agendando.type) ? (
              <label>
                Medio
                <select
                  className="input"
                  value={agendando.medium}
                  onChange={(evento) => setAgendando({ ...agendando, medium: evento.target.value })}
                >
                  <option value="">Sin especificar</option>
                  {MEDIOS.map((medio) => <option key={medio.value} value={medio.value}>{medio.label}</option>)}
                </select>
              </label>
            ) : null}
            {/*
              Y el enlace o la dirección, según lo que pida el medio elegido.

              Es lo que hace útil el recordatorio previo: sin este campo, el enlace acaba dentro
              de la descripción y el correo no puede sacarlo de un párrafo.
            */}
            {campoDelMedio(agendando.medium) ? (
              <label>
                {campoDelMedio(agendando.medium)!.etiqueta}
                <input
                  className="input"
                  value={agendando.location}
                  onChange={(evento) => setAgendando({ ...agendando, location: evento.target.value })}
                  placeholder={campoDelMedio(agendando.medium)!.ejemplo}
                />
              </label>
            ) : null}
            <label>
              Fecha y hora
              <input
                className="input"
                type="datetime-local"
                value={agendando.date}
                onChange={(evento) => setAgendando({ ...agendando, date: evento.target.value })}
              />
            </label>
            <label>
              Qué se hará
              <textarea
                className="input"
                rows={3}
                value={agendando.description}
                onChange={(evento) => setAgendando({ ...agendando, description: evento.target.value })}
                placeholder="Visita con la familia Pérez, depto 402"
              />
            </label>
            {/*
              El lead es opcional: no toda actividad de la agenda cuelga de un contacto. Cuando se
              indica, la actividad aparece además en su ficha, que es donde se lee en contexto.
            */}
            <label>
              {termino('lead')} relacionado <small>(opcional)</small>
              <input
                className="input"
                value={agendando.leadId}
                onChange={(evento) => setAgendando({ ...agendando, leadId: evento.target.value })}
                placeholder="Identificador del contacto, si aplica"
              />
            </label>
            {agendar.error ? <div className="alert alert-error">{(agendar.error as Error).message}</div> : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setAgendando(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={agendar.isPending || !agendando.date || agendando.description.trim().length < 3}
                onClick={() => agendar.mutate()}
              >
                {agendar.isPending ? 'Agendando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
