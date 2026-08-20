/**
 * @fileoverview Barra propia del CRM, con sus seis secciones.
 *
 * El CRM se recorre entero sin salir de él —se mira el inicio, se abre el tablero, se revisa una
 * ficha, se vuelve—, así que sus secciones viven en una barra suya y no repartidas en la lateral
 * general. Con la lateral sola, «Inicio» aparecía dos veces: el del sistema y el del CRM, y lo
 * único que los distinguía era el título de la sección.
 *
 * La lateral conserva una sola entrada, «CRM», que trae acá. Desde adentro se navega con esta
 * barra, igual que en la herramienta que se tomó como referencia.
 */

import { NavLink, Outlet } from 'react-router-dom';
import type { JSX } from 'react';
import { useAuth } from '../../core/auth';
import './crm-layout.css';

/**
 * Secciones, en el orden en que se usan durante el día.
 *
 * `end` en el inicio porque su ruta es prefijo de todas las demás: sin eso quedaría marcado como
 * activo estando en cualquier otra sección.
 */
const SECCIONES: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/crm', label: 'Inicio', end: true },
  { to: '/crm/tablero', label: 'Tablero' },
  { to: '/crm/leads', label: 'Leads' },
  { to: '/crm/dashboard', label: 'Dashboard' },
  { to: '/crm/calendario', label: 'Calendario' },
  { to: '/crm/administracion', label: 'Administración' },
];

export function CrmLayout(): JSX.Element {
  const { user } = useAuth();

  return (
    <div className="crm-shell">
      <nav className="crm-nav" aria-label="Secciones del CRM">
        <div className="crm-nav-secciones">
          {SECCIONES.map((seccion) => (
            <NavLink
              key={seccion.to}
              to={seccion.to}
              end={seccion.end}
              className={({ isActive }) => (isActive ? 'crm-nav-link activo' : 'crm-nav-link')}
            >
              {seccion.label}
            </NavLink>
          ))}
        </div>
        {/* Quién está mirando: varias secciones cambian con el cargo, y verlo evita atribuir a un
            fallo lo que es una diferencia de permisos. */}
        <span className="crm-nav-usuario">{user?.name}</span>
      </nav>

      <Outlet />
    </div>
  );
}
