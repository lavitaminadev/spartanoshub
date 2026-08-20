/**
 * @fileoverview Dashboard del CRM: cómo va el embudo.
 *
 * Cada cifra lleva un subtítulo que la explica. Un número solo no dice nada —«9» contra «9 · 0,3
 * por día» son el mismo dato y distinta información— y sin ese contexto el panel se lee como una
 * lista de cifras que nadie sabe si están bien o mal.
 */

import { useMemo, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useUrlFilters } from '../../shared/use-url-filters';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { STAGE_LABEL } from './stage-labels';
import './crm-dashboard.css';

interface Conteo { key: string; total: number }
interface Panel {
  days: number;
  totals: { leads: number; calificados: number; conVisita: number; ventas: number };
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

/** Porcentaje con un decimal, o un guion cuando no hay divisor. */
function porcentaje(parte: number, total: number): string {
  if (!total) return '—';
  const valor = (parte / total) * 100;
  return `${valor % 1 === 0 ? valor : valor.toFixed(1)}%`;
}

/**
 * Barra de una distribución, en porcentaje del mayor.
 *
 * Se escala contra el mayor y no contra el total: con siete etapas, la barra más larga ocuparía
 * un séptimo del ancho y ninguna se distinguiría de otra.
 */
function Barras({ datos, etiqueta }: { datos: Conteo[]; etiqueta: (key: string) => string }): JSX.Element {
  const mayor = Math.max(...datos.map((d) => d.total), 1);
  return (
    <ul className="crm-dash-barras">
      {datos.map((dato) => (
        <li key={dato.key}>
          <span className="crm-dash-barra-nombre">{etiqueta(dato.key)}</span>
          <span className="crm-dash-barra-pista">
            <i style={{ width: `${(dato.total / mayor) * 100}%` }} />
          </span>
          <span className="crm-dash-barra-valor">{dato.total}</span>
        </li>
      ))}
    </ul>
  );
}

export function CrmDashboardPage(): JSX.Element {
  const filtros = useUrlFilters(['dias']);
  const dias = filtros.values.dias || '30';

  const { data, isLoading, error, refetch } = useQuery<Panel>({
    queryKey: ['crm-dashboard', dias],
    queryFn: () => api.get(`/crm/home/dashboard?days=${dias}`),
  });

  const totals = data?.totals ?? { leads: 0, calificados: 0, conVisita: 0, ventas: 0 };
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
          <span>Leads del período</span>
          <small>{porDiaPromedio} por día</small>
        </article>
        <article>
          <strong>{totals.calificados}</strong>
          <span>Calificados</span>
          <small>{porcentaje(totals.calificados, totals.leads)} del total</small>
        </article>
        <article>
          <strong>{totals.conVisita}</strong>
          <span>Con visita agendada</span>
          <small>{porcentaje(totals.conVisita, totals.calificados)} de calificados</small>
        </article>
        <article>
          <strong>{totals.ventas}</strong>
          <span>Ventas</span>
          <small>{porcentaje(totals.ventas, totals.leads)} de conversión total</small>
        </article>
      </section>

      <section className="crm-dash-panel">
        <h2>Embudo por etapa</h2>
        {porEtapa.length ? (
          <Barras datos={porEtapa} etiqueta={(key) => STAGE_LABEL[key] ?? key} />
        ) : (
          <p className="crm-dash-vacio">Sin leads en el período.</p>
        )}
      </section>

      <div className="crm-dash-dos">
        <section className="crm-dash-panel">
          <h2>Leads por día</h2>
          {porDia.length ? (
            /* Barras verticales y no una línea: con pocos días una línea sugiere continuidad
               entre puntos que son conteos sueltos, no una serie que evolucione. */
            <div className="crm-dash-dias" role="img" aria-label={`Leads por día en los últimos ${ventana} días`}>
              {porDia.map((dia) => (
                <span key={dia.key} title={`${dia.key}: ${dia.total}`}>
                  <i style={{ height: `${(dia.total / maxDia) * 100}%` }} />
                </span>
              ))}
            </div>
          ) : (
            <p className="crm-dash-vacio">Sin leads en el período.</p>
          )}
        </section>

        <section className="crm-dash-panel">
          <h2>Leads por fuente</h2>
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
          <Barras datos={motivos} etiqueta={(key) => key} />
        ) : (
          /* Distinto de «no hay datos»: puede haber leads descartados sin motivo anotado, y
             decirlo es lo que empuja a que se anote. */
          <p className="crm-dash-vacio">
            Ningún lead descartado tiene motivo anotado. Sin motivo no se puede saber qué corregir.
          </p>
        )}
      </section>
    </div>
  );
}
