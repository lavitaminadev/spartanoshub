/**
 * @fileoverview Barra propia de Reservas, para que la lateral tenga una sola entrada.
 *
 * La barra global sólo mueve entre contextos. Agenda, disponibilidad, cupones y ajustes se
 * abren desde un local seleccionado: mostrarlos aquí hacía parecer que operaban toda la empresa
 * a la vez y era la principal fuente de vistas mezcladas.
 *
 * Es el mismo patrón de navegación que usa el CRM, pero **no comparte nada con él**: son dos
 * servicios distintos, con datos y personas distintas. Lo único común es la forma de moverse, y
 * eso vive en una hoja neutra de `shared`. Importar la del CRM habría atado los dos módulos por
 * el lado equivocado: tocar el CRM le cambiaría el aspecto a Reservas.
 */

import type { JSX } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { isPathEnabled } from '../../core/navigation.registry';
import '../../shared/section-nav.css';

/** Secciones, en el orden en que se usan durante el día. */
const SECCIONES: Array<{ to: string; label: string }> = [
  // La operacion del dia va primero: es lo que abre cada jornada quien recibe las reservas,
  // mientras que configurar un local ocurre una vez. Todas traen su propio selector de local,
  // asi que no dependen de haber entrado antes por la ficha del local.
  { to: '/reservations/agenda', label: 'Hoy' },
  // Antes vivían como pestañas dentro de Sucursales: quien buscaba una persona o un cupón no
  // tenía cómo saber que estaban ahí dentro.
  { to: '/reservations?tab=bookings', label: 'Reservas' },
  { to: '/reservations?tab=groups', label: 'Grupos' },
  { to: '/reservations', label: 'Sucursales' },
  { to: '/reservations/calendar', label: 'Disponibilidad' },
  { to: '/reservations/waitlist', label: 'Lista de espera' },
  { to: '/reservations?tab=coupons', label: 'Cupones' },
  { to: '/reservations/analytics', label: 'Resultados' },
];

export function ReservationsLayout(): JSX.Element {
  const { user } = useAuth();
  const ubicacion = useLocation();

  /*
   * Cuál sección está activa.
   *
   * Varias comparten el camino de la lista y se distinguen por su pestaña, así que el
   * emparejado por camino de NavLink marcaría «Reservas» en todas ellas a la vez.
   */
  const pestanaActual = new URLSearchParams(ubicacion.search).get('tab') || 'forms';
  const esActiva = (destino: string) => {
    const [camino, consulta] = destino.split('?');
    if (camino !== '/reservations') return ubicacion.pathname === camino || ubicacion.pathname.startsWith(camino + '/');
    if (ubicacion.pathname !== '/reservations') return false;
    return (new URLSearchParams(consulta).get('tab') || 'forms') === pestanaActual;
  };

  // La misma función que la lateral general: mismo módulo, mismos permisos, misma respuesta.
  // Enumerar cargos acá obligaría a desplegar para un cambio que la pantalla de permisos ya sabe
  // hacer, y dejaría dos respuestas a la misma pregunta.
  const visibles = SECCIONES.filter((seccion) => isPathEnabled(
    seccion.to,
    user?.features,
    user?.permissions,
    user?.moduleLifecycle,
    user?.role,
    user?.capabilities,
  ));

  // Sin secciones visibles no se dibuja un marco que promete una navegación que no existe para
  // esa persona. La pantalla a la que llegó se sigue mostrando.
  if (!visibles.length) return <Outlet />;

  return (
    <div className="section-shell">
      <nav className="section-nav" aria-label="Secciones de reservas">
        <div className="section-nav-items">
          {/*
            * Enlaces simples, no NavLink.
            *
            * Reservas, Grupos y Cupones son la misma ruta con distinta pestaña en la consulta, y
            * NavLink decide por la ruta: las tres quedaban marcadas como página actual a la vez
            * —tres veces anunciadas como tal— y ninguna recibía la marca que sí mira la pestaña.
            */}
          {visibles.map((seccion) => {
            const activa = esActiva(seccion.to);
            return (
              <Link
                key={seccion.to}
                to={seccion.to}
                aria-current={activa ? 'page' : undefined}
                className={activa ? 'section-nav-link activo' : 'section-nav-link'}
              >
                {seccion.label}
              </Link>
            );
          })}
        </div>
        {/* Anotar la reserva de una persona —una llamada, el mostrador— va a mano en todas las
            pantallas. La sucursal se elige dentro del formulario, sin tener que entrar antes a ella. */}
        {visibles.some((seccion) => seccion.to === '/reservations') && <Link className="btn btn-primary btn-sm section-nav-cta" to="/reservations?tab=bookings&nueva=1">Anotar reserva</Link>}
      </nav>
      <Outlet />
    </div>
  );
}
