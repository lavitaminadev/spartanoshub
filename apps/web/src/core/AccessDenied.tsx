/**
 * @fileoverview Pantalla que se muestra cuando un cargo entra a una ruta que no tiene abierta.
 *
 * Reemplaza al redirect mudo hacia el inicio. Antes, escribir `/admin` sin permiso devolvía al
 * tablero sin decir nada, y eso se lee como «la pantalla está rota» en vez de «este cargo no la
 * abre». La diferencia importa: lo primero se reporta como falla, lo segundo se resuelve
 * pidiendo el acceso a quien corresponde.
 *
 * No expone la matriz interna ni rutas técnicas. Saber qué cargos abren una pantalla no ayuda a
 * quien fue bloqueado y sí revela estructura operativa que no le corresponde ver.
 */

import { Link } from 'react-router-dom';
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
  // Se mantienen en la firma por compatibilidad con las rutas ya montadas, pero no se muestran:
  // un rechazo no debe enumerar cargos ni revelar la URL que activó la puerta.
  void path;
  void userRole;
  void allowedRoles;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">SIN ACCESO</span>
          <h2>No tienes acceso a esta sección</h2>
          <p>
            {reason === 'module'
              ? 'Esta sección no está disponible en tu servicio actual.'
              : 'Tu cuenta no tiene permiso para abrir esta sección.'}
          </p>
        </div>
      </div>

      <div className="card">
        <p className="access-denied-next">
          {reason === 'module'
            ? 'Si crees que deberías verla, contacta a tu administrador.'
            : 'Si necesitas acceso, solicita autorización a tu administrador.'}
        </p>

        <Link to="/dashboard" className="btn btn-outline">Volver al inicio</Link>
      </div>
    </div>
  );
}
