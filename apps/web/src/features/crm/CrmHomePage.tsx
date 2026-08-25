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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { JSX } from 'react';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { useCrmScope } from './crm-scope';
import { useVocabulario } from './use-vocabulario';
import './crm-home.css';

interface LeadPreview {
  id: string;
  name: string;
  source?: string | null;
  campaignName?: string | null;
  createdAt: string;
}

interface Alert {
  key: string;
  count: number;
  level: 'critico' | 'alto';
  items: LeadPreview[];
  sample: LeadPreview | null;
}
interface TeamRow { userId: string; name: string; open: number; uncontacted: number; cooling: number }
interface Home {
  month: { leads: number; ventas: number; monto: number };
  /** El servidor avisa si acotó la respuesta a esta persona, para poder decirlo en pantalla. */
  personalScope?: boolean;
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
  calificados_sin_visita: {
    title: 'Calificados sin visita agendada',
    why: 'Están listos para visitar pero no tienen fecha.',
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
  // De qué empresa son los avisos. Sin esto el inicio respondía siempre por toda la
  // organización, así que cambiar de empresa arriba dejaba los mismos avisos de antes.
  const scope = useCrmScope();
  // Cómo llama esta empresa a sus cosas. De fábrica para lo que no haya renombrado.
  const { termino } = useVocabulario(scope.clientId);
  const queryClient = useQueryClient();

  /** Hacerse cargo de un lead sin dueño, desde el aviso que pide que alguien lo haga. */
  /*
   * Si quien mira puede quedar a cargo de un lead de este CRM.
   *
   * Es la misma lista que llena el desplegable de la ficha y el filtro del tablero. Sin esto,
   * alguien de otra empresa se tomaba un lead desde el aviso y dejaba de verlo enseguida: su
   * alcance de cuenta no llega a esa empresa, y el lead quedaba a nombre de quien no lo atiende.
   */
  const { data: asignables } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['crm-responsables', scope.clientId],
    queryFn: () => api.get(
      `/crm/leads/responsables${scope.clientId ? `?clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
    retry: false,
  });
  const puedeTomar = Boolean(user?.id) && (asignables ?? []).some((persona) => persona.id === user?.id);

  const tomar = useMutation({
    mutationFn: (id: string) => api.put(`/crm/leads/${id}`, { assignedTo: user?.id }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['crm-home'] }),
      queryClient.invalidateQueries({ queryKey: ['crm-leads-board'] }),
    ]),
  });
  const { data, isLoading, error, refetch, isFetching } = useQuery<Home>({
    queryKey: ['crm-home', scope.domain, scope.clientId],
    queryFn: () => api.get(
      `/crm/home?domain=${scope.domain}${scope.clientId ? `&clientId=${encodeURIComponent(scope.clientId)}` : ''}`,
    ),
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
  const urgentes = data?.urgentCount ?? 0;
  const team = data?.team ?? [];
  const leadsEnCartera = data?.month?.leads ?? 0;
  const ventasDelMes = data?.month?.ventas ?? 0;
  const montoVendido = `$${Math.round(data?.month?.monto ?? 0).toLocaleString('es-CL')}`;
  const primerNombre = user?.name?.split(/\s+/)[0] ?? '';

  return (
    <div className="page crm-home">
      <header className="crm-home-greeting">
        <h1>{saludo()}{primerNombre ? `, ${primerNombre}` : ''}</h1>
<p>
          {urgentes === 0
            ? 'Nada urgente por ahora. Revisa tu agenda y el seguimiento.'
            : urgentes === 1
              ? 'Tienes 1 asunto urgente que atender primero.'
              : `Tienes ${urgentes} asuntos urgentes que atender primero.`}
        </p>
      </header>

      {/*
        Decir que la vista está acotada, en vez de dejar que parezca que no hay trabajo.
        Un embudo con tres tarjetas se lee como un CRM vacío si nadie explica que son las tuyas.
      */}
      {data?.personalScope ? (
        <p className="crm-home-alcance">Estás viendo tus leads y los que todavía no tienen dueño.</p>
      ) : null}

      <section className="crm-home-kpis">
        <article>
          <strong>{leadsEnCartera}</strong>
          <span>{termino('leads')} del mes</span>
          <small>ingresados</small>
        </article>
        <article>
          <strong>{ventasDelMes}</strong>
          <span>Ventas del mes</span>
          <small>cerradas</small>
        </article>
        <article>
          <strong>{montoVendido}</strong>
          <span>Monto vendido</span>
          <small>en el mes</small>
        </article>
      </section>

      {/*
        * Cada aviso lista nombres, no un ejemplo.
        *
        * Con un solo nombre el aviso decía «hay 12» y mostraba uno: para trabajar los otros once
        * había que irse a otra pantalla y volver a filtrarlos a mano. Muestra los primeros —los
        * que llevan más esperando— y cuenta el resto, que es como se empieza sin salir de acá.
        */}
      <section className="crm-home-alerts">
        {alerts.length === 0 ? (
          <p className="crm-home-al-dia">Todo al día. No hay nada pendiente que requiera tu atención.</p>
        ) : alerts.map((alert) => {
          const texto = ALERTS[alert.key];
          if (!texto) return null;
          const restantes = alert.count - alert.items.length;
          return (
            <article key={alert.key} className={`crm-home-alert es-${alert.level}`}>
              <div className="crm-home-alert-head">
                <b>{alert.count}</b>
                <div>
                  <h3>{texto.title}</h3>
                  <p>{texto.why}</p>
                </div>
              </div>
              <div className="crm-home-alert-items">
                {alert.items.map((lead) => (
                  <div key={lead.id} className="crm-home-alert-fila">
                    <Link
                      className="crm-home-alert-sample"
                      to={`/crm/leads?q=${encodeURIComponent(lead.name)}`}
                    >
                      <strong>{lead.name}</strong>
                      <span>
                        {desde(lead.createdAt)}
                        {lead.campaignName ? ` · ${lead.campaignName}` : ''}
                        {lead.source ? ` · ${lead.source}` : ''}
                      </span>
                    </Link>
                    {/*
                      Tomar el lead desde el propio aviso.

                      El aviso de «sin asignar» existe para que alguien se haga cargo; mandar a
                      otra pantalla a hacerlo convierte un gesto en un recado. Solo aparece en
                      ese aviso: en los demás el lead ya tiene dueño.
                    */}
                    {alert.key === 'sin_asignar' && puedeTomar ? (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        disabled={tomar.isPending}
                        onClick={() => tomar.mutate(lead.id)}
                      >
                        Tomar
                      </button>
                    ) : null}
                  </div>
                ))}
                {restantes > 0 ? <p className="crm-home-alert-mas">y {restantes} más…</p> : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="crm-home-team">
        <header>
          <h2>Carga del equipo <span className="crm-home-solo">Solo jefatura</span></h2>
        </header>
        {team.length ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ejecutivo</th>
                  <th>{termino('leads')} abiertos</th>
                  <th>Sin contactar</th>
                  <th>Enfriándose</th>
                </tr>
              </thead>
              <tbody>
                {team.map((row) => (
                  <tr key={row.userId}>
                    <td data-label="Ejecutivo"><strong>{row.name}</strong></td>
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
