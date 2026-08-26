import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../core/auth';
import { api } from '../../core/api';
import { PulsoEspartano } from '../pulse/PulsoEspartano';
import { PageHero } from '../../shared/PageHero';
import { activePortalCards, isPortalPulseVisible } from './client-portal-scope';

/** Un pendiente del CRM, tal como lo calcula el mismo servicio que usa el equipo. */
interface Pendiente { key: string; count: number; level: 'critico' | 'alto' }

interface Inicio {
  /** Ausente cuando la empresa no tiene CRM contratado. No es lo mismo que estar en cero. */
  crm?: { leadsDelMes: number; pendientes: Pendiente[] };
  reservas?: { proximasDosDias: number; sinConfirmar: number };
}

/**
 * Cómo se lee cada pendiente, y por qué importa.
 *
 * El nombre solo no basta: «sin contactar» dice qué son, no por qué hay que mirarlos hoy. La
 * segunda línea es la que convierte un número en una decisión.
 */
const PENDIENTES: Record<string, { titulo: string; porque: string }> = {
  sin_contactar: {
    titulo: 'sin contactar',
    porque: 'Nadie les ha llamado ni escrito. Mientras más pasa, menos responden.',
  },
  calificados_sin_visita: {
    titulo: 'listos para visitar',
    porque: 'Están calificados pero no tienen fecha agendada.',
  },
};

/**
 * El portal de una empresa cliente.
 *
 * Era un menú: dos tarjetas que decían qué servicios tiene contratados. Eso sirve la primera vez
 * y no dice nada el día treinta, cuando la pregunta ya no es «qué tengo» sino «qué hago». Ahora
 * lo primero que se ve es lo que hay que atender, y las tarjetas quedan debajo como el acceso que
 * siempre fueron.
 *
 * Cada bloque aparece solo si su servicio está contratado: el servidor omite la clave entera, así
 * que un cero acá significa «no hay nada pendiente» y nunca «no lo tienes».
 */
export function ClientDashboard() {
  const { user } = useAuth();

  const { data } = useQuery<Inicio>({
    queryKey: ['portal-inicio'],
    queryFn: () => api.get('/portal/inicio'),
    // Es un resumen, no un dato transaccional: si falla, la pantalla sigue sirviendo como menú.
    retry: false,
  });

  /*
   * Lo que urge de verdad, sumado en leads y no en avisos.
   *
   * Contar avisos daría el mismo «2» con tres leads sin contactar que con treinta. Es la misma
   * decisión que toma el inicio del equipo, por el mismo motivo.
   */
  const urgentes = (data?.crm?.pendientes ?? [])
    .filter((pendiente) => pendiente.level === 'critico')
    .reduce((suma, pendiente) => suma + pendiente.count, 0);
  const reservasHoy = data?.reservas?.proximasDosDias ?? 0;

  const saludo = urgentes > 0
    ? `Tienes ${urgentes} contacto${urgentes === 1 ? '' : 's'} esperando respuesta.`
    : reservasHoy > 0
      ? `Tienes ${reservasHoy} reserva${reservasHoy === 1 ? '' : 's'} entre hoy y mañana.`
      : 'Tu panel de avances y decisiones.';

  return (
    <div className="page">
      <PageHero
        tone="portal"
        eyebrow="TU ESPACIO DE MARCA"
        title={`Bienvenido, ${user?.name ?? ''}`}
        subtitle={saludo}
        footer={<div className="portal-pulse"><span><i className="online-dot" />Cuenta activa</span><span>Actualizado hoy</span></div>}
      />
      {isPortalPulseVisible(user) ? <PulsoEspartano compact /> : null}

      {data?.crm || data?.reservas ? (
        <div className="card-grid portal-resumen">
          {data.crm ? (
            <div className="card portal-home-card">
              <h3>{data.crm.leadsDelMes}</h3>
              <p>contactos llegaron este mes</p>
              {data.crm.pendientes.filter((pendiente) => pendiente.count > 0).map((pendiente) => (
                <p key={pendiente.key} className={`portal-pendiente es-${pendiente.level}`}>
                  <strong>{pendiente.count} {PENDIENTES[pendiente.key]?.titulo ?? pendiente.key}</strong>
                  <span>{PENDIENTES[pendiente.key]?.porque}</span>
                </p>
              ))}
              {/*
                El silencio se dice, no se deja en blanco.

                Una tarjeta sin avisos y una que no cargó se ven igual si no hay una frase. Con
                ella, quien entra sabe que miró y que no hay nada, en vez de dudar.
              */}
              {data.crm.pendientes.every((pendiente) => pendiente.count === 0) ? (
                <p className="portal-pendiente es-ok"><strong>Todo al día</strong><span>Ningún contacto está esperando.</span></p>
              ) : null}
              <Link to="/crm" className="btn btn-primary btn-sm">Abrir CRM</Link>
            </div>
          ) : null}

          {data.reservas ? (
            <div className="card portal-home-card">
              <h3>{data.reservas.proximasDosDias}</h3>
              <p>reservas entre hoy y mañana</p>
              {data.reservas.sinConfirmar > 0 ? (
                <p className="portal-pendiente es-critico">
                  <strong>{data.reservas.sinConfirmar} sin confirmar</strong>
                  {/*
                    Sin límite de fecha a propósito: una reserva sin confirmar de la semana pasada
                    sigue siendo trabajo sin hacer, y esconderla no la resuelve.
                  */}
                  <span>Esperan tu confirmación para quedar en firme.</span>
                </p>
              ) : (
                <p className="portal-pendiente es-ok"><strong>Todo confirmado</strong><span>No queda ninguna esperando.</span></p>
              )}
              <Link to="/portal/reservations" className="btn btn-primary btn-sm">Abrir reservas</Link>
            </div>
          ) : null}
        </div>
      ) : (
        /*
         * Las tarjetas de siempre, como respaldo.
         *
         * Se muestran cuando el resumen todavía no llegó o falló. El portal nunca se queda sin
         * puerta de entrada por un resumen que no cargó.
         */
        <div className="card-grid">
          {activePortalCards(user).map((card) => (
            <div key={card.link} className="card portal-home-card">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <Link to={card.link} className="btn btn-primary btn-sm">
                {card.action}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
