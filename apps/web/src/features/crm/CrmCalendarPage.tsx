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
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { useCrmScope } from './crm-scope';
import { useVocabulario } from './use-vocabulario';
import { ExportButtons, type ExportDocument } from '../../shared/export';
import './crm-calendar.css';

interface Actividad {
  id: string;
  type: string;
  description?: string;
  date: string;
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
const TIPO_LABEL: Record<string, string> = {
  call: 'Llamada',
  email: 'Correo',
  meeting: 'Reunión',
  whatsapp: 'WhatsApp',
  note: 'Nota',
  visit: 'Visita',
};

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
  return primera || TIPO_LABEL[actividad.type] || 'Actividad';
}

/** Forma en que se mira la agenda. */
type Vista = 'mes' | 'semana' | 'dia';

export function CrmCalendarPage(): JSX.Element {
  const [ancla, setAncla] = useState(() => new Date());
  const [vista, setVista] = useState<Vista>('mes');
  // De qué empresa es la agenda. Sin esto se veían —y se exportaban— reuniones de otras cuentas
  // bajo el encabezado de la empresa elegida, que es la forma más silenciosa de mezclarlas.
  const scope = useCrmScope();
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

  const porDia = useMemo(() => {
    const mapa = new Map<string, Actividad[]>();
    for (const actividad of data?.data ?? []) {
      if (!actividad.date) continue;
      const clave = claveDia(new Date(actividad.date));
      mapa.set(clave, [...(mapa.get(clave) ?? []), actividad]);
    }
    return mapa;
  }, [data]);

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
            La agenda impresa del período que se está mirando.

            Se lleva a una reunión o se pega en la pared, y para eso hace falta en papel lo que
            en pantalla se ve de un vistazo. Exporta exactamente lo que está en la cuadrícula
            —mes o semana—, no un rango fijo: si se exportara siempre la semana, el archivo
            diría algo distinto de lo que la persona tenía delante al pulsar.
          */}
          <ExportButtons document={documento} csv={false} />
          <select
            className="input"
            aria-label="Forma de ver la agenda"
            value={vista}
            onChange={(evento) => setVista(evento.target.value as Vista)}
          >
            <option value="mes">Vista mensual</option>
            <option value="semana">Vista semanal</option>
            <option value="dia">Vista diaria</option>
          </select>
        </div>
      </div>

      <div
        className={`crm-cal-grilla${vista === 'semana' ? ' es-semana' : ''}${vista === 'dia' ? ' es-dia' : ''}`}
        role="grid"
        aria-label={`Calendario ${vista === 'mes' ? 'mensual' : vista === 'semana' ? 'semanal' : 'diario'}`}
      >
        {/*
          La fila de días de la semana solo tiene sentido cuando hay varias columnas. En la vista
          diaria hay una, y el encabezado ya dice qué día es: repetir siete rótulos sobre una
          sola columna sugiere una cuadrícula que no está.
        */}
        {vista === 'dia' ? null : DIAS.map((dia) => <span key={dia} className="crm-cal-cabecera">{dia}</span>)}

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
              <span className="crm-cal-numero">{fecha.getDate()}</span>
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
                  className={`crm-cal-evento tipo-${evento.type}`}
                  title={`${horaDe(evento.date)} · ${evento.description || TIPO_LABEL[evento.type] || evento.type}`}
                >
                  <time>{horaDe(evento.date)}</time>
                  <b>{tituloDe(evento)}</b>
                </span>
              ))}
              {vista === 'dia' && !eventos.length ? (
                <p className="crm-cal-dia-vacio">Nada agendado este día.</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {!data?.data.length ? (
        // No es un error: puede no haber nada agendado, o el cargo puede no alcanzar las
        // reuniones. Decirlo evita que un mes vacío se lea como calendario roto.
        <p className="crm-cal-vacio">
          No hay actividades agendadas visibles para esta {termino('empresa').toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}
