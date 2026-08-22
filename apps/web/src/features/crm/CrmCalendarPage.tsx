/**
 * @fileoverview Calendario del CRM: el mes, con lo que hay agendado.
 *
 * Reutiliza las reuniones que ya existen en vez de crear una agenda propia: una visita comercial
 * es una reunión con fecha y cliente, que es exactamente lo que esa tabla guarda. Duplicar el
 * modelo habría dejado dos agendas que hay que mirar por separado para saber si alguien está libre.
 */

import { useMemo, useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { useCrmScope } from './crm-scope';
import { ExportButtons, type ExportDocument } from '../../shared/export';
import './crm-calendar.css';

interface Reunion {
  id: string;
  title: string;
  scheduledAt: string;
  clientId?: string | null;
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

/** Forma en que se mira la agenda. */
type Vista = 'mes' | 'semana';

export function CrmCalendarPage(): JSX.Element {
  const [ancla, setAncla] = useState(() => new Date());
  const [vista, setVista] = useState<Vista>('mes');
  // De qué empresa es la agenda. Sin esto se veían —y se exportaban— reuniones de otras cuentas
  // bajo el encabezado de la empresa elegida, que es la forma más silenciosa de mezclarlas.
  const scope = useCrmScope();

  const { data, isLoading } = useQuery<Reunion[]>({
    queryKey: ['crm-calendario', scope.clientId],
    queryFn: () => api.get(
      `/meetings${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
    retry: false,
  });

  const porDia = useMemo(() => {
    const mapa = new Map<string, Reunion[]>();
    for (const reunion of data ?? []) {
      if (!reunion.scheduledAt) continue;
      const clave = claveDia(new Date(reunion.scheduledAt));
      mapa.set(clave, [...(mapa.get(clave) ?? []), reunion]);
    }
    return mapa;
  }, [data]);

  const celdas = useMemo(
    () => (vista === 'mes' ? celdasDelMes(ancla) : celdasDeLaSemana(ancla)),
    [ancla, vista],
  );
  const hoy = claveDia(new Date());

  /** Las flechas avanzan lo que se está mirando: un mes en la vista mensual, una semana en la otra. */
  const mover = (pasos: number) => {
    const siguiente = new Date(ancla);
    if (vista === 'mes') siguiente.setMonth(ancla.getMonth() + pasos);
    else siguiente.setDate(ancla.getDate() + pasos * 7);
    setAncla(siguiente);
  };

  const titulo = vista === 'mes'
    ? ancla.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    : `Semana del ${celdas[0].fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`;

  /** Lo que hay agendado dentro de la cuadrícula visible, en orden cronológico. */
  const eventosDelPeriodo = useMemo(() => {
    const claves = new Set(celdas.map(({ fecha }) => claveDia(fecha)));
    return (data ?? [])
      .filter((reunion) => reunion.scheduledAt && claves.has(claveDia(new Date(reunion.scheduledAt))))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [data, celdas]);

  const documento: ExportDocument<Reunion> = {
    fileName: vista === 'mes' ? 'agenda-mensual' : 'agenda-semanal',
    title: `Agenda · ${titulo}`,
    subtitle: `${eventosDelPeriodo.length} actividad(es) en el período`,
    meta: [
      { label: 'Período', value: titulo },
      { label: 'Vista', value: vista === 'mes' ? 'Mensual' : 'Semanal' },
    ],
    columns: [
      { header: 'Fecha', value: (r) => new Date(r.scheduledAt).toLocaleDateString('es-CL'), width: 12 },
      { header: 'Hora', value: (r) => new Date(r.scheduledAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), width: 8 },
      { header: 'Actividad', value: (r) => r.title, width: 40 },
    ],
    rows: eventosDelPeriodo,
    footer: 'Espartanos · CRM',
  };

  if (isLoading) return <LoadingSpinner text="Cargando el mes..." />;

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
          <ExportButtons document={documento} />
          <select
            className="input"
            aria-label="Forma de ver la agenda"
            value={vista}
            onChange={(evento) => setVista(evento.target.value as Vista)}
          >
            <option value="mes">Vista mensual</option>
            <option value="semana">Vista semanal</option>
          </select>
        </div>
      </div>

      <div
        className={`crm-cal-grilla${vista === 'semana' ? ' es-semana' : ''}`}
        role="grid"
        aria-label={vista === 'mes' ? 'Calendario mensual' : 'Calendario semanal'}
      >
        {DIAS.map((dia) => <span key={dia} className="crm-cal-cabecera">{dia}</span>)}

        {celdas.map(({ fecha, delMes }) => {
          const clave = claveDia(fecha);
          const eventos = porDia.get(clave) ?? [];
          return (
            <div
              key={clave}
              className={`crm-cal-celda${delMes ? '' : ' fuera'}${clave === hoy ? ' hoy' : ''}`}
            >
              <span className="crm-cal-numero">{fecha.getDate()}</span>
              {eventos.map((evento) => (
                <span key={evento.id} className="crm-cal-evento" title={evento.title}>{evento.title}</span>
              ))}
            </div>
          );
        })}
      </div>

      {!data?.length ? (
        // No es un error: puede no haber nada agendado, o el cargo puede no alcanzar las
        // reuniones. Decirlo evita que un mes vacío se lea como calendario roto.
        <p className="crm-cal-vacio">
          No hay reuniones agendadas visibles para tu cargo. Se agendan desde Reuniones.
        </p>
      ) : null}
    </div>
  );
}
