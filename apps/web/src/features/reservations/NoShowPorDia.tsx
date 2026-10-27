import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';

interface DiaDeLaSemana { dia: number; nombre: string; total: number; noAsistio: number; tasa: number | null }
interface LocalConNoShow {
  formId: string;
  nombre: string;
  total: number;
  noAsistio: number;
  tasa: number | null;
  porDia: DiaDeLaSemana[];
  peorDia: { nombre: string; tasa: number; frase: string } | null;
}
interface RespuestaNoShow { dias: number; muestraMinimaPorDia: number; locales: LocalConNoShow[] }

const porcentaje = (tasa: number | null) => (tasa === null ? '—' : `${Math.round(tasa * 100)}%`);
/** De lunes a domingo, que es como se lee una semana de trabajo. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

/**
 * Qué porcentaje de las reservas no se presenta, por local y por día de la semana.
 *
 * Los días con pocas reservas se muestran atenuados: una tasa sobre tres reservas no dice nada.
 */
export function NoShowPorDia({ clientId }: { clientId?: string }) {
  const { data } = useQuery<RespuestaNoShow>({
    queryKey: ['no-show-por-dia', clientId ?? ''],
    queryFn: () => api.get(`/reservations/analytics/no-show${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    retry: false,
  });
  const locales = (data?.locales ?? []).filter((local) => local.total > 0);
  if (!data || locales.length === 0) return null;

  return <section className="motivos-de-perdida">
    <header>
      <span className="page-eyebrow">ASISTENCIA</span>
      <h2>Quién no se presenta, por día</h2>
      <p className="page-subtitle">Últimos {data.dias} días. Cuentan las reservas que asistieron o no se presentaron; las canceladas no.</p>
    </header>
    {locales.map((local) => <div key={local.formId}>
      <h3>{local.nombre} · {porcentaje(local.tasa)} en total</h3>
      {local.peorDia && <p><strong>{local.peorDia.frase}</strong></p>}
      <ul>
        {ORDEN.map((indice) => local.porDia[indice]).map((dia) => <li key={dia.dia} style={dia.total < data.muestraMinimaPorDia ? { opacity: 0.55 } : undefined}>
          <span>{dia.nombre}</span>
          <span className="motivos-barra" aria-hidden="true"><i style={{ width: `${Math.round((dia.tasa ?? 0) * 100)}%` }} /></span>
          <strong>{porcentaje(dia.tasa)}</strong>
          <small>{dia.noAsistio} de {dia.total}</small>
        </li>)}
      </ul>
    </div>)}
  </section>;
}
