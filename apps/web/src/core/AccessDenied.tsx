/**
 * @fileoverview Pantalla que se muestra cuando un cargo entra a una ruta que no tiene abierta.
 *
 * Reemplaza al redirect mudo hacia el inicio. Antes, escribir `/admin` sin permiso devolvía al
 * tablero sin decir nada, y eso se lee como «la pantalla está rota» en vez de «este cargo no la
 * abre». La diferencia importa: lo primero se reporta como falla, lo segundo se resuelve
 * pidiendo el acceso a quien corresponde.
 *
 * Muestra tres datos y ninguno más: con qué cargo entraste, qué cargos abren esa pantalla, y qué
 * hacer al respecto.
 */

import { Link } from 'react-router-dom';
import { ROLE_LABELS, roleLabel } from './role-labels';

interface AccessDeniedProps {
  /** Ruta que se intentó abrir, tal como aparece en la barra de direcciones. */
  path?: string;
  /** Cargo con el que la persona entró. */
  userRole?: string;
  /** Cargos que sí tienen esta pantalla abierta, si el manifiesto los declara. */
  allowedRoles?: readonly string[];
  /**
   * Motivo del bloqueo. `role` cuando el cargo no está en la lista de la pantalla; `module`
   * cuando el módulo está apagado o fuera del alcance de su fase. El texto cambia porque la
   * salida es distinta: uno se resuelve con permisos, el otro encendiendo el módulo.
   */
  reason: 'role' | 'module';
}

export function AccessDenied({ path, userRole, allowedRoles, reason }: AccessDeniedProps) {
  const abren = (allowedRoles ?? [])
    .filter((rol) => rol in ROLE_LABELS)
    .map((rol) => ROLE_LABELS[rol]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">SIN ACCESO</span>
          <h2>Este cargo no abre esta pantalla</h2>
          <p>
            {reason === 'module'
              ? 'El módulo está apagado o todavía no se libera para uso general.'
              : 'La pantalla existe y funciona, pero está asignada a otros cargos.'}
          </p>
        </div>
      </div>

      <div className="card">
        <dl className="access-denied-detail">
          <dt>Entraste como</dt>
          <dd>{roleLabel(userRole) || 'Sin cargo asignado'}</dd>

          {path ? (
            <>
              <dt>Pantalla</dt>
              <dd><code>{path}</code></dd>
            </>
          ) : null}

          {abren.length > 0 ? (
            <>
              <dt>La abren</dt>
              <dd>{abren.join(', ')}</dd>
            </>
          ) : null}
        </dl>

        <p className="access-denied-next">
          {reason === 'module'
            ? 'Desarrollo puede encenderlo desde Accesos y seguridad.'
            : 'Si necesitas entrar, pide el permiso a Desarrollo: se otorga por cargo o solo para tu cuenta, sin abrirlo a todo el equipo.'}
        </p>

        <Link to="/dashboard" className="btn btn-outline">Volver al inicio</Link>
      </div>
    </div>
  );
}
