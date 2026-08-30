/**
 * @fileoverview Dashboard del CRM: cómo va el embudo.
 *
 * Cada cifra lleva un subtítulo que la explica. Un número solo no dice nada —«9» contra «9 · 0,3
 * por día» son el mismo dato y distinta información— y sin ese contexto el panel se lee como una
 * lista de cifras que nadie sabe si están bien o mal.
 */

import { useMemo, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { useUrlFilters } from '../../shared/use-url-filters';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { STAGE_LABEL } from './stage-labels';
import { useCrmScope } from './crm-scope';
import { useStageLabels } from './use-stage-labels';
import { useVocabulario } from './use-vocabulario';
import './crm-dashboard.css';

interface Conteo { key: string; total: number }
interface UserOption { id: string; name: string }

interface Campania {
  id: string;
  name: string;
  source: string;
  investment: number;
  status: string;
  leads: number;
  /** `null` mientras no haya llegado ningún lead: no es que salieran gratis. */
  costPerLead: number | null;
}

const ESTADO_CAMPANIA: Record<string, string> = {
  active: 'Activa', paused: 'Pausada', finished: 'Finalizada',
};
interface Panel {
  days: number;
  totals: {
    leads: number; calificados: number; conVisita: number; ventas: number;
    montoVendido: number; pipelineAbierto: number; ticketPromedio: number; estancados: number;
  };
  /** Días promedio de ingreso a venta. `null` mientras no haya ninguna cerrada. */
  tiempoDeCierre: number | null;
  /** Quien mejor convierte de los que tienen al menos tres leads. */
  mejorSetter: { assignedTo: string; leads: number; ventas: number; conversion: number } | null;
  /** La campaña que más dinero cerró en el período. Nula si aún no hay ventas con campaña. */
  mejorCampana: { campaignName: string; ventas: number; monto: number } | null;
  comision: { tasa: number; ganada: number; proyectada: number };
  porEtapa: Conteo[];
  porFuente: Conteo[];
  porDia: Conteo[];
  motivosDeCierre: Conteo[];
}

const VENTANAS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
];

/** Monto en pesos, sin decimales: el panel compara órdenes de magnitud, no centavos. */
function dinero(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-CL')}`;
}

/** Porcentaje con un decimal, o un guion cuando no hay divisor. */
function porcentaje(parte: number, total: number): string {
  if (!total) return '—';
  const valor = (parte / total) * 100;
  return `${valor % 1 === 0 ? valor : valor.toFixed(1)}%`;
}

/** Verde de la marca, el mismo que marca la sección activa en la barra del CRM. */
const ACENTO = '#17c78a';
/** Rojo apagado para lo que se perdió: un motivo de cierre no se lee como un logro. */
const ACENTO_PERDIDA = '#e2725b';

/** Altura fija de los paneles: distintas alturas hacen que dos gráficos no se puedan comparar. */
const ALTO = 240;


/**
 * Distribución en barras horizontales.
 *
 * Horizontales y no verticales porque las categorías son texto —«Visita agendada», el nombre de
 * una fuente— y en vertical esas etiquetas se rotan o se recortan. El eje arranca en cero y la
 * escala la fija el propio gráfico: recortar el eje exagera diferencias que no existen.
 */
function Barras({ datos, etiqueta, color = ACENTO }: { datos: Conteo[]; etiqueta: (key: string) => string; color?: string }): JSX.Element {
  const filas = datos.map((dato) => ({ ...dato, nombre: etiqueta(dato.key) }));
  // Cada barra necesita su alto mínimo legible; con muchas categorías el panel crece en vez de
  // apretarlas hasta que dejan de distinguirse.
  const alto = Math.max(ALTO, filas.length * 34);

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nombre"
          width={130}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--muted)' }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(23,199,138,.08)' }}
          formatter={(valor: number) => [valor, 'Leads']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CrmDashboardPage(): JSX.Element {
  // De qué empresa son las cifras. Lo decide la barra del CRM, igual que el resto de secciones.
  const scope = useCrmScope();
  const { user } = useAuth();
  const rotulos = useStageLabels(scope.clientId);
  // Cómo llama esta empresa a sus cosas. De fábrica para lo que no haya renombrado.
  const { termino } = useVocabulario(scope.clientId);
  const filtros = useUrlFilters(['dias']);
  const dias = filtros.values.dias || '30';

  // El equipo, para poder nombrar al setter en vez de mostrar su identificador.
  const { data: usuariosResp } = useQuery<UserOption[] | { data: UserOption[] }>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
    enabled: user?.role !== 'client',
  });
  const usuarios = Array.isArray(usuariosResp) ? usuariosResp : usuariosResp?.data ?? [];
  const nombreDe = (id: string) => usuarios.find((u) => u.id === id)?.name ?? 'Sin nombre';

  const { data: campanias } = useQuery<Campania[]>({
    queryKey: ['crm-campaigns', scope.clientId],
    queryFn: () => api.get(`/crm/campaigns${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`),
  });

  const { data, isLoading, error, refetch } = useQuery<Panel>({
    // La empresa entra en la clave: cambiarla arriba trae otras cifras, no las mismas filtradas.
    queryKey: ['crm-dashboard', dias, scope.domain, scope.clientId],
    queryFn: () => api.get(
      `/crm/home/dashboard?days=${dias}&domain=${scope.domain}${scope.clientId ? `&clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
  });

  const totals = data?.totals ?? {
    leads: 0, calificados: 0, conVisita: 0, ventas: 0,
    montoVendido: 0, pipelineAbierto: 0, ticketPromedio: 0, estancados: 0,
  };
  const porDia = data?.porDia ?? [];
  const porEtapa = data?.porEtapa ?? [];
  const porFuente = data?.porFuente ?? [];
  const motivos = data?.motivosDeCierre ?? [];
  const ventana = data?.days ?? Number(dias);

  const porDiaPromedio = useMemo(
    () => (ventana > 0 ? (totals.leads / ventana).toFixed(1) : '0'),
    [totals.leads, ventana],
  );

  if (isLoading) return <LoadingSpinner text="Calculando el embudo..." />;
  if (error) {
    return <QueryErrorState title="No pudimos cargar el panel" message={(error as Error).message} onRetry={() => void refetch()} />;
  }

  const maxDia = Math.max(...porDia.map((d) => d.total), 1);

  return (
    <div className="page crm-dash">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">MEDICIÓN</span>
          <h1>Dashboard</h1>
          <p className="page-subtitle">{scope.esAgencia ? 'Resultados comerciales de Espartanos.' : `Resultados comerciales de ${scope.empresa}.`}</p>
        </div>
        <select
          className="input"
          aria-label="Período"
          value={dias}
          onChange={(event) => filtros.setValue('dias', event.target.value)}
        >
          {VENTANAS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      </div>

      <section className="crm-dash-kpis">
        <article>
          <strong>{totals.leads}</strong>
          <span>{termino('leads')} del período</span>
          <small>{porDiaPromedio} por día</small>
        </article>
        <article>
          <strong>{totals.calificados}</strong>
          <span>Calificados</span>
          <small>{porcentaje(totals.calificados, totals.leads)} del total</small>
        </article>
        <article>
          <strong>{totals.conVisita}</strong>
          <span>Visitas agendadas</span>
          {/*
            Agendada, no cumplida.

            Decía «llegaron a visita», que es otra cosa: contaba los que tienen fecha, no los que
            vinieron. La etapa que medía eso —«Visitó»— se retiró del embudo por no usarse, así
            que la promesa se quedó sin dato detrás y el rótulo mentía por omisión.
          */}
          <small>{porcentaje(totals.conVisita, totals.calificados)} de los calificados</small>
        </article>
        <article>
          <strong>{totals.ventas}</strong>
          <span>Ventas</span>
          <small>{porcentaje(totals.ventas, totals.leads)} de conversión total</small>
        </article>
        <article>
          <strong>{dinero(totals.pipelineAbierto)}</strong>
          <span>Pipeline abierto</span>
          <small>Negocios en curso</small>
        </article>
        <article>
          <strong>{dinero(totals.montoVendido)}</strong>
          <span>Monto vendido</span>
          <small>{totals.ventas} venta(s) cerrada(s)</small>
        </article>
        <article>
          <strong>{dinero(totals.ticketPromedio)}</strong>
          <span>Ticket promedio</span>
          <small>Valor medio por negocio</small>
        </article>
        <article>
          {/* Un guion y no un cero: cero días diría «se cierran el mismo día», que es una
              afirmación muy distinta de no tener con qué calcularlo. */}
          <strong>{data?.tiempoDeCierre === null || data?.tiempoDeCierre === undefined ? '—' : `${data.tiempoDeCierre} d`}</strong>
          <span>Tiempo de cierre</span>
          <small>Días de ingreso a venta</small>
        </article>
        <article>
          <strong>{totals.estancados}</strong>
          <span>{termino('leads')} estancados</span>
          <small>Sin gestión hace +7 días</small>
        </article>
        {/*
          La comisión sale del panel.

          Se calculaba con una tasa fija del 2% sobre el pipeline y sobre lo vendido, y ese número
          no describe ningún acuerdo real: cada cuenta tiene el suyo. Un importe inventado en un
          panel se lee como un dato, y decisiones tomadas sobre él serían decisiones sobre nada.

          El cálculo sigue en el servidor por si se retoma con tasas de verdad; lo que se retira
          es mostrarlo como si ya fuera cierto.
        */}
      </section>

      {/*
        Quién convierte mejor, no quién vende más.

        Con volúmenes distintos el total premia a quien recibió más leads y no a quien los
        trabaja mejor, que es lo contrario de lo que sirve para repartir la cartera.
      */}
      <section className="crm-dash-panel crm-dash-setter">
        <h2>Setter con mayor conversión</h2>
        {data?.mejorSetter ? (
          <p className="crm-dash-setter-linea">
            <strong>{nombreDe(data.mejorSetter.assignedTo)}</strong>
            <span>
              {porcentaje(data.mejorSetter.ventas, data.mejorSetter.leads)} ·{' '}
              {data.mejorSetter.ventas}/{data.mejorSetter.leads} leads
            </span>
          </p>
        ) : (
          // Se dice el umbral en vez de mostrar un vacío: quien mira necesita saber si no hay
          // datos o si el reparto todavía es demasiado chico para comparar.
          <p className="crm-dash-vacio">
            Nadie alcanza los 3 leads asignados que se piden para comparar conversiones.
          </p>
        )}
      </section>

      {/*
        Qué campaña terminó en dinero.

        Va junto al setter porque responden la misma pregunta desde los dos lados: quién vende
        mejor y qué trae a quien compra. El panel ya dice cuánto costó cada campaña por lead;
        sin esto se optimiza por leads baratos, que es como se compra volumen que no cierra.
      */}
      <section className="crm-dash-panel crm-dash-setter">
        <h2>{termino('campana')} más vendida</h2>
        {data?.mejorCampana ? (
          <p className="crm-dash-setter-linea">
            <strong>{data.mejorCampana.campaignName}</strong>
            <span>
              {data.mejorCampana.monto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
              {' · '}{data.mejorCampana.ventas} venta{data.mejorCampana.ventas === 1 ? '' : 's'}
            </span>
          </p>
        ) : (
          <p className="crm-dash-vacio">
            Todavía no hay ventas con {termino('campana').toLowerCase()} registrada en este período.
          </p>
        )}
      </section>

      <section className="crm-dash-panel">
        <h2>Embudo por etapa</h2>
        {/* El embudo se rotula como lo llama esta empresa: el panel y el tablero deben decir lo
            mismo, o el gráfico parece de otro CRM. */}
        {porEtapa.length ? (
          <Barras datos={porEtapa} etiqueta={(key) => rotulos[key] ?? STAGE_LABEL[key] ?? key} />
        ) : (
          <p className="crm-dash-vacio">Sin leads en el período.</p>
        )}
      </section>

      <div className="crm-dash-dos">
        <section className="crm-dash-panel">
          <h2>{termino('leads')} por día</h2>
          {porDia.length ? (
            /* Barras verticales y no una línea: con pocos días una línea sugiere continuidad
               entre puntos que son conteos sueltos, no una serie que evolucione. */
            <ResponsiveContainer width="100%" height={ALTO}>
              <BarChart data={porDia} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="key"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  // Con 90 días no caben 90 fechas: se muestran las que quepan y el resto se
                  // consulta en el tooltip, en vez de solaparse hasta volverse ilegibles.
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tickFormatter={(valor: string) => valor.slice(5)}
                />
                <YAxis width={32} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <Tooltip
                  cursor={{ fill: 'rgba(23,199,138,.08)' }}
                  formatter={(valor: number) => [valor, 'Leads']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={26}>
                  {porDia.map((dia) => (
                    // El día más alto se destaca: es la pregunta que se le hace a este gráfico
                    // —«¿cuándo entró el pico?»— y buscarlo a ojo entre noventa barras iguales
                    // es justamente lo que cuesta.
                    <Cell key={dia.key} fill={dia.total === maxDia ? ACENTO : 'rgba(23,199,138,.45)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="crm-dash-vacio">Sin leads en el período.</p>
          )}
        </section>

        <section className="crm-dash-panel">
          <h2>{termino('leads')} por fuente</h2>
          {porFuente.length ? (
            <Barras datos={porFuente} etiqueta={(key) => key} />
          ) : (
            <p className="crm-dash-vacio">Sin fuentes registradas.</p>
          )}
        </section>
      </div>

      <section className="crm-dash-panel">
        <h2>Por qué perdemos negocios</h2>
        {motivos.length ? (
          <Barras datos={motivos} etiqueta={(key) => key} color={ACENTO_PERDIDA} />
        ) : (
          /* Distinto de «no hay datos»: puede haber leads descartados sin motivo anotado, y
             decirlo es lo que empuja a que se anote. */
          <p className="crm-dash-vacio">
            Ningún lead descartado tiene motivo anotado. Sin motivo no se puede saber qué corregir.
          </p>
        )}
      </section>

      {/*
        Costo por lead.

        Es la única cifra del panel que no sale de la tabla de leads: ellos dicen de qué campaña
        vinieron, pero no cuánto se invirtió. El cruce es por nombre, así que una campaña escrita
        distinta a como llega de Meta aparece con cero leads —y se dice, en vez de mostrar un
        costo que no significa nada—.
      */}
      <section className="crm-dash-panel">
        <h2>Campañas y costo por lead</h2>
        {!campanias?.length ? (
          <p className="crm-dash-vacio">
            Sin campañas registradas. Se dan de alta en Administración del CRM, y su nombre debe
            escribirse igual que el que traen los leads.
          </p>
        ) : (
          /*
            Las clases con las que el resto del proyecto dibuja sus tablas.

            `table-wrap` y `table` no tienen ninguna regla de CSS, así que la tabla salía sin
            contenedor de desplazamiento y sin el plegado a tarjetas: en el teléfono se desbordaba
            a lo ancho aunque sus celdas ya traían `data-label` para plegarse.
          */
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaña</th><th>Fuente</th><th>Inversión</th>
                  <th>Leads</th><th>Costo por lead</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {campanias.map((campania) => (
                  <tr key={campania.id}>
                    <td data-label="Campaña">{campania.name}</td>
                    <td data-label="Fuente">{campania.source}</td>
                    <td data-label="Inversión">{dinero(campania.investment)}</td>
                    <td data-label="Leads">{campania.leads}</td>
                    <td data-label="Costo por lead">
                      {campania.costPerLead === null
                        ? <span className="text-muted">Sin leads aún</span>
                        : dinero(campania.costPerLead)}
                    </td>
                    <td data-label="Estado">{ESTADO_CAMPANIA[campania.status] ?? campania.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
