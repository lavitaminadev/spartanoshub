/**
 * @fileoverview Envoltorio base de un paso del asistente de reservas: título, descripción
 * opcional y el contenido propio del paso. Cada `Reservation*Form` lo usa para no repetir el
 * mismo encabezado con estilos ligeramente distintos en cada paso.
 */

import type { JSX, ReactNode } from 'react';

export interface ReservationFormSectionProps {
  /** Etiqueta corta en mayúsculas sobre el título, ej. "CONTEXTO". */
  eyebrow?: string;
  /** Pregunta o título del paso. */
  title: string;
  /** Explicación de una línea de qué se pide en este paso. */
  description?: string;
  children: ReactNode;
}

/** Encabezado + cuerpo de un paso del wizard, con el mismo espaciado vertical en los 4 pasos. */
export function ReservationFormSection({ eyebrow, title, description, children }: ReservationFormSectionProps): JSX.Element {
  return (
    <div className="wizard-step-body">
      <div className="reservation-step-heading">
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {children}
    </div>
  );
}
