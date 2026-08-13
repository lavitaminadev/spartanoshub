/**
 * @fileoverview Componente de estado vacío usado en vistas de listado y detalle.
 */

import { memo, type JSX, type ReactNode } from 'react';
import { VitaIcons, type VitaIconName } from './Icons';

/**
 * Props del componente de estado vacío.
 */
export interface EmptyStateProps {
  /** Nombre de icono de `VitaIcons` o símbolo en texto plano mostrado sobre el mensaje. */
  icon?: string;
  /** Título breve. */
  title?: string;
  /** Mensaje descriptivo. */
  description?: string;
  /** Elemento de acción opcional (botón, link, etc.). */
  action?: ReactNode;
}

/**
 * Renderiza un mensaje de estado vacío amigable.
 */
export const EmptyState = memo(function EmptyState({
  icon = 'inbox',
  title = 'Sin datos',
  description = 'No hay información disponible aún.',
  action,
}: EmptyStateProps): JSX.Element {
  const Icon = icon && (icon as VitaIconName) in VitaIcons ? VitaIcons[icon as VitaIconName] : undefined;
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {Icon ? <Icon /> : icon}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
});
