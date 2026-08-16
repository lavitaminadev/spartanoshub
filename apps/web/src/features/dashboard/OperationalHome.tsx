import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { refetchWhenIdle } from '../../core/refetch-policy';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface MetaConversionStatus {
  schedule: string | null;
  attended: string | null;
  matchFields: number;
}

interface OperationalHomeData {
  date: string;
  timezone: string;
  today: {
    total: number;
    attended: number;
    pending: number;
    noShow: number;
    dailyCap: number;
    occupancyPct: number | null;
  };
  upcoming: Array<{
    id: string;
    startsAt: string;
    guestName: string;
    partySize: number;
    status: string;
    metaConversion: MetaConversionStatus | null;
  }>;
}

/**
 * Señal de Meta resumida a una palabra.
 *
 * Es la misma lectura que la bandeja de reservas, en corto: acá interesa saber si algo hay que
 * mirar, no el detalle. Un evento enviado sin identificadores de coincidencia cuenta como
 * conversión perdida aunque el envío haya sido correcto, así que se marca igual que un fallo.
 */
function signalOf(conversion: MetaConversionStatus | null): { tone: 'ok' | 'warn' | 'off'; label: string; title: string } {
  if (!conversion) return { tone: 'off', label: '—', title: 'Sin eventos de conversión todavía.' };
  const { schedule, attended, matchFields } = conversion;
  if (!schedule && !attended) return { tone: 'off', label: '—', title: 'Sin eventos de conversión todavía.' };
  if (schedule === 'failed' || attended === 'failed' || schedule === 'expired' || attended === 'expired') {
    return { tone: 'warn', label: 'revisar', title: 'El evento falló o quedó fuera de la ventana que acepta Meta.' };
  }
  if (matchFields === 0) return { tone: 'warn', label: 'sin match', title: 'Salió sin teléfono, correo ni identificador de clic: Meta no puede atribuirlo.' };
  if ([schedule, attended].some((status) => status && status !== 'processed')) {
    return { tone: 'warn', label: 'en cola', title: `Envío pendiente. ${matchFields} datos de coincidencia.` };
  }
  return { tone: 'ok', label: 'ok', title: `Confirmado con ${matchFields} datos de coincidencia.` };
}

function hourOf(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
}

/**
 * Portada operativa: cómo viene el día y si la señal a Meta está llegando bien.
 *
 * Antepone lo que va a pasar en las próximas horas al resumen del mes. Es el gesto que el
 * equipo hace a primera hora, y tenerlo detrás de un tablero de indicadores obligaba a
 * buscarlo.
 */
export function OperationalHome({ clientId }: { clientId?: string }) {
  const { data, isLoading, error, refetch } = useQuery<OperationalHomeData>({
    queryKey: ['operational-home', clientId ?? 'all'],
    queryFn: () => api.get(`/reservations/analytics/operational-home${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    // La jornada cambia sola: se refresca para que quien deja la pantalla abierta no mire
    // cifras de hace una hora sin saberlo.
    refetchInterval: refetchWhenIdle(120_000),
  });

  if (isLoading) return <LoadingSpinner text="Cargando el día..." />;
  if (error) return <QueryErrorState message={(error as Error).message} onRetry={() => { void refetch(); }} />;
  if (!data) return null;

  const { today, upcoming, timezone } = data;
  const cards = [
    { label: 'Reservas hoy', value: String(today.total), detail: `${today.pending} por confirmar` },
    { label: 'Asistencia hoy', value: `${today.attended}/${today.total}`, detail: today.noShow > 0 ? `${today.noShow} no se presentó` : 'sin ausencias' },
    {
      label: 'Ocupación del cupo',
      value: today.occupancyPct === null ? '—' : `${today.occupancyPct}%`,
      detail: today.dailyCap > 0 ? `de ${today.dailyCap} reservas/día` : 'sin tope definido',
    },
    {
      label: 'Señal a Meta',
      value: `${upcoming.filter((item) => signalOf(item.metaConversion).tone === 'ok').length}/${upcoming.length}`,
      detail: 'de las próximas, confirmadas',
    },
  ];

  return (
    <section className="op-home">
      <header className="op-home-head">
        <h2>Inicio Operativo</h2>
        <p>Cómo viene el día, y si la señal a Meta está llegando bien.</p>
      </header>

      <div className="op-home-stats">
        {cards.map((card) => (
          <div key={card.label} className="op-stat card">
            <span className="op-stat-label">{card.label}</span>
            <strong className="op-stat-value">{card.value}</strong>
            <span className="op-stat-detail">{card.detail}</span>
          </div>
        ))}
      </div>

      <div className="op-upcoming card">
        <h2>Próximas 3 horas</h2>
        {upcoming.length === 0 ? (
          <p className="op-empty">Nada agendado en las próximas tres horas.</p>
        ) : (
          <ul>
            {upcoming.map((item) => {
              const signal = signalOf(item.metaConversion);
              return (
                <li key={item.id}>
                  <span className="op-time">{hourOf(item.startsAt, timezone)}</span>
                  <span className="op-name">{item.guestName}</span>
                  <span className="op-party">{item.partySize} pers.</span>
                  <span className={`op-signal is-${signal.tone}`} title={signal.title}>{signal.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        <Link className="op-link" to="/reservations">Ver la bandeja completa</Link>
      </div>
    </section>
  );
}
