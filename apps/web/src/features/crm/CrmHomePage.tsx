/**
 * @fileoverview Inicio del CRM: lo que hay que atender hoy, antes de cualquier lista.
 *
 * Una lista obliga a decidir qué mirar; un aviso ya lo decidió. Por eso la pantalla abre con lo
 * que está esperando gestión y no con los leads ordenados por fecha.
 *
 * Cada aviso dice **la consecuencia, no la condición**: «nunca se les ha llamado» explica poco;
 * «mientras más pasa, menos responden» explica por qué vale la pena hacerlo ahora. Y trae un
 * ejemplo concreto, para que el aviso sea un punto de partida y no un recordatorio.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { JSX } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import './crm-home.css';

interface LeadPreview {
  id: string;
  name: string;
  source?: string | null;
  campaignName?: string | null;
  createdAt: string;
}

interface Alert { key: string; count: number; sample: LeadPreview | null }
interface TeamRow { userId: string; name: string; open: number; uncontacted: number; cooling: number }
interface Home {
  month: { leads: number };
  urgentCount: number;
  alerts: Alert[];
  team: TeamRow[];
  coolingDays: number;
}

/**
 * Texto de cada aviso.
 *
 * Vive acá y no en el servidor porque es copia, no lógica: cambiar una redacción no debería
 * exigir desplegar la API. El servidor manda la clave y el número; la pantalla los explica.
 */
const ALERTS: Record<string, { title: string; why: string }> = {
  sin_contactar: {
    title: 'Leads sin contactar',
    why: 'Nunca se les ha llamado ni escrito. Mientras más pasa, menos responden.',
  },
  sin_asignar: {
    title: 'Leads sin asignar',
    why: 'Nadie los está trabajando. Asígnalos para que alguien se haga cargo.',
  },
  listos_sin_avanzar: {
    title: 'Listos y sin avanzar',
    why: 'Ya recibieron propuesta y llevan días sin movimiento. Son los más cerca de cerrarse.',
  },
};

/** El saludo cambia con la hora: entrar a las nueve y a las siete no es lo mismo. */
function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Cuántos días lleva esperando, en palabras. */
function desde(fecha: string): string {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
  if (dias <= 0) return 'ingresó hoy';
  if (dias === 1) return 'ingresó ayer';
  return `ingresó hace ${dias} días`;
}

export function CrmHomePage(): JSX.Element {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery<Home>({
    queryKey: ['crm-home'],
    queryFn: () => api.get('/crm/home'),
  });

  if (isLoading) return <LoadingSpinner text="Revisando qué hay pendiente..." />;
  if (error) {
    return (
      <QueryErrorState
        title="No pudimos abrir el inicio del CRM"
        message={(error as Error).message}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  /*
   * Se desarma con valores por defecto en vez de leer `data?.month.leads` en cada uso.
   *
   * El opcional cuida `data` pero no el contenedor de adentro: con una respuesta parcial —o
   * vacía, mientras la integración se configura— `data.month` es indefinido y leer `.leads`
   * revienta la pantalla entera. Desarmar acá lo resuelve una vez para toda la vista.
   */
  const alerts = data?.alerts ?? [];
  const team = data?.team ?? [];
  const leadsEnCartera = data?.month?.leads ?? 0;
  const coolingDays = data?.coolingDays ?? 7;
  const enGestion = team.reduce((total, row) => total + row.open, 0);
  const enfriandose = team.reduce((total, row) => total + row.cooling, 0);
  const primerNombre = user?.name?.split(/\s+/)[0] ?? '';

  return (
    <div className="page crm-home">
      <header className="crm-home-greeting">
        <h1>{saludo()}{primerNombre ? `, ${primerNombre}` : ''}</h1>
        <p>
          {alerts.length === 0
            ? 'No hay nada urgente esperando. Buen momento para adelantar seguimientos.'
            : alerts.length === 1
              ? 'Tienes 1 asunto urgente que atender primero.'
              : `Tienes ${alerts.length} asuntos urgentes que atender primero.`}
        </p>
      </header>

      <section className="crm-home-kpis">
        <article>
          <strong>{leadsEnCartera}</strong>
          <span>Leads en cartera</span>
          <small>abiertos y cerrados</small>
        </article>
        <article>
          <strong>{enGestion}</strong>
          <span>En gestión</span>
          <small>asignados y sin cerrar</small>
        </article>
        <article>
          <strong>{enfriandose}</strong>
          <span>Enfriándose</span>
          <small>sin movimiento hace +{coolingDays} días</small>
        </article>
      </section>

      {alerts.length > 0 ? (
        <section className="crm-home-alerts">
          {alerts.map((alert) => {
            const texto = ALERTS[alert.key];
            if (!texto) return null;
            return (
              <article key={alert.key}>
                <div className="crm-home-alert-head">
                  <b>{alert.count}</b>
                  <div>
                    <h3>{texto.title}</h3>
                    <p>{texto.why}</p>
                  </div>
                </div>
                {alert.sample ? (
                  <Link className="crm-home-alert-sample" to={`/crm/leads?q=${encodeURIComponent(alert.sample.name)}`}>
                    <strong>{alert.sample.name}</strong>
                    <span>
                      {desde(alert.sample.createdAt)}
                      {alert.sample.campaignName ? ` · ${alert.sample.campaignName}` : ''}
                      {alert.sample.source ? ` · ${alert.sample.source}` : ''}
                    </span>
                  </Link>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="crm-home-team">
        <header>
          <h2>Carga del equipo</h2>
        </header>
        {team.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Leads abiertos</th>
                  <th>Sin contactar</th>
                  <th>Enfriándose</th>
                </tr>
              </thead>
              <tbody>
                {team.map((row) => (
                  <tr key={row.userId}>
                    <td data-label="Persona"><strong>{row.name}</strong></td>
                    <td data-label="Leads abiertos">{row.open}</td>
                    <td data-label="Sin contactar">{row.uncontacted}</td>
                    <td data-label="Enfriándose">{row.cooling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Todavía no hay leads asignados"
            description="Cuando alguien tome un lead o se le asigne, su carga aparecerá acá."
          />
        )}
      </section>
    </div>
  );
}
