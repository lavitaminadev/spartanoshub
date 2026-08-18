import type { JSX } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/** Una serie a dibujar. Varias comparten los mismos ejes. */
export interface TrendSeries {
  key: string;
  label: string;
  color?: string;
}

export interface TrendChartProps<T extends Record<string, unknown>> {
  data: T[];
  /** Campo del eje horizontal, normalmente una fecha ya formateada. */
  xKey: string;
  series: TrendSeries[];
  kind?: 'line' | 'area' | 'bar';
  height?: number;
  /** Formatea el valor en el tooltip: dinero, porcentaje, unidades. */
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}

/**
 * Paleta por defecto, tomada de los tokens de marca.
 *
 * Se define acá y no en cada pantalla para que dos gráficos del mismo tablero no asignen
 * colores distintos a la misma serie, que es lo que hace que un tablero se lea mal aunque
 * cada gráfico por separado esté bien.
 */
const DEFAULT_COLORS = ['#0fb9b1', '#b90749', '#706a73', '#f0a202', '#5b4b8a'];

/**
 * Gráfico de evolución en el tiempo.
 *
 * Envuelve `recharts` —ya presente en el proyecto— para fijar de una vez los ejes, la grilla,
 * el tooltip y los colores. Sin esta capa, cada pantalla repetía unas veinte líneas de
 * configuración y ninguna quedaba igual a la anterior.
 *
 * No pretende cubrir todo lo que `recharts` puede hacer: cuando un gráfico necesite algo
 * fuera de esto, lo correcto es usar `recharts` directamente y no ensanchar esta interfaz
 * hasta que sea una copia peor de la original.
 */
export function TrendChart<T extends Record<string, unknown>>({
  data, xKey, series, kind = 'line', height = 260, valueFormatter, emptyMessage = 'Sin datos para el período',
}: TrendChartProps<T>): JSX.Element {
  if (!data.length) return <p className="chart-empty">{emptyMessage}</p>;

  const colorOf = (index: number, serie: TrendSeries) => serie.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  const formatear = (value: number | string) => (
    typeof value === 'number' && valueFormatter ? valueFormatter(value) : String(value)
  );

  const ejes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
      <XAxis dataKey={xKey} stroke="var(--muted)" fontSize={11} tickLine={false} />
      <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
      <Tooltip formatter={(value) => formatear(value as number)} contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 12 }} />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === 'bar' ? (
        <BarChart data={data}>
          {ejes}
          {series.map((serie, index) => (
            <Bar key={serie.key} dataKey={serie.key} name={serie.label} fill={colorOf(index, serie)} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      ) : kind === 'area' ? (
        <AreaChart data={data}>
          {ejes}
          {series.map((serie, index) => (
            <Area
              key={serie.key} dataKey={serie.key} name={serie.label} type="monotone"
              stroke={colorOf(index, serie)} fill={colorOf(index, serie)} fillOpacity={0.15}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data}>
          {ejes}
          {series.map((serie, index) => (
            <Line
              key={serie.key} dataKey={serie.key} name={serie.label} type="monotone"
              stroke={colorOf(index, serie)} strokeWidth={2} dot={false}
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
