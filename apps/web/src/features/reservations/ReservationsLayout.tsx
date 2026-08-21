/**
 * @fileoverview Barra propia de Reservas, para que la lateral tenga una sola entrada.
 *
 * Reservas se recorre igual que el CRM: se mira la bandeja, se abre la agenda del día, se
 * revisa la disponibilidad y se vuelve. Repartir esas cinco pantallas en la lateral general
 * ponía cinco entradas de un módulo entre las demás, y desde cualquiera de ellas había que
 * volver al menú para pasar a la de al lado.
 *
 * Es el mismo patrón de navegación que usa el CRM, pero **no comparte nada con él**: son dos
 * servicios distintos, con datos y personas distintas. Lo único común es la forma de moverse, y
 * eso vive en una hoja neutra de `shared`. Importar la del CRM habría atado los dos módulos por
 * el lado equivocado: tocar el CRM le cambiaría el aspecto a Reservas.
 */

import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { isPathEnabled } from '../../core/navigation.registry';
import '../../shared/section-nav.css';

/** Secciones, en el orden en que se usan durante el día. */
const SECCIONES: Array<{ to: string; label: string; end?: boolean }> = [
  // `end` porque su ruta es prefijo de las demás: sin eso quedaría marcada como activa siempre.
  { to: '/reservations', label: 'Reservas', end: true },
  { to: '/reservations/agenda', label: 'Agenda del día' },
  { to: '/reservations/calendar', label: 'Disponibilidad' },
  { to: '/reservations/waitlist', label: 'Lista de espera' },
  { to: '/reservations/analytics', label: 'Resultados' },
];

export function ReservationsLayout(): JSX.Element {
  const { user } = useAuth();

  // La misma función que la lateral general: mismo módulo, mismos permisos, misma respuesta.
  // Enumerar cargos acá obligaría a desplegar para un cambio que la pantalla de permisos ya sabe
  // hacer, y dejaría dos respuestas a la misma pregunta.
  const visibles = SECCIONES.filter((seccion) => isPathEnabled(
    seccion.to,
    user?.features,
    user?.permissions,
    user?.moduleLifecycle,
    user?.role,
  ));

  // Sin secciones visibles no se dibuja un marco que promete una navegación que no existe para
  // esa persona. La pantalla a la que llegó se sigue mostrando.
  if (!visibles.length) return <Outlet />;

  return (
    <div className="section-shell">
      <nav className="section-nav" aria-label="Secciones de reservas">
        <div className="section-nav-items">
          {visibles.map((seccion) => (
            <NavLink
              key={seccion.to}
              to={seccion.to}
              end={seccion.end}
              className={({ isActive }) => (isActive ? 'section-nav-link activo' : 'section-nav-link')}
            >
              {seccion.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
