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
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { isPathEnabled } from '../../core/navigation.registry';
import '../../shared/section-nav.css';

/** Secciones, en el orden en que se usan durante el día. */
const SECCIONES: Array<{ to: string; label: string; end?: boolean }> = [
  // `end` porque su ruta es prefijo de las demás: sin eso quedaría marcada como activa siempre.
  { to: '/reservations', label: 'Hoy', end: true },
  { to: '/reservations/manage', label: 'Locales' },
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
    user?.capabilities,
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
