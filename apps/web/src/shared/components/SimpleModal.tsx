/**
 * @fileoverview Modal de acción simple (crear/editar un registro corto) para los flujos
 * nuevos: fondo semitransparente + tarjeta blanca con título, contenido libre y un pie con
 * "Cancelar" / acción principal. Reutiliza `useFocusTrap` para el mismo comportamiento
 * accesible que el resto de overlays de la app (foco atrapado, Escape cierra, foco vuelve
 * al disparador).
 *
 * No es un reemplazo de `shared/Modal.tsx`: ese modal ya está en uso en varias pantallas con
 * sus propias clases (`.modal-overlay`, `.modal-content`, `.modal-close`) y no expone un pie
 * de "acción primaria" fijo. Este componente cubre el patrón del prototipo (wizard, altas
 * rápidas) con una API más corta (`action` + `submit`) pensada para formularios de un paso.
 */

import { useEffect, useId, useRef, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../useFocusTrap';
import './SimpleModal.css';

/**
 * Props del modal simple.
 */
export interface SimpleModalProps {
  /** Texto pequeño en mayúsculas sobre el título (equivalente al `.kicker` del prototipo). */
  eyebrow?: string;
  /** Título del modal. */
  title: string;
  /** Cierra el modal sin enviar (botón "×" y "Cancelar"). */
  close: () => void;
  /** Etiqueta del botón de acción principal, ej. "Crear sesión". */
  action: string;
  /** Ejecuta la acción principal. */
  submit: () => void;
  /** Deshabilita el botón de acción principal (ej. mientras se valida o se envía). */
  submitDisabled?: boolean;
  /** Etiqueta del botón de cancelar. Por defecto "Cancelar". */
  cancelLabel?: string;
  /** Ancho amplio (`650px`) para formularios en grilla de dos columnas. Por defecto `true`. */
  wide?: boolean;
  /** Contenido del formulario. */
  children: ReactNode;
}

/**
 * Modal de acción con backdrop, tarjeta blanca y pie fijo de Cancelar/acción principal.
 */
export function SimpleModal({
  eyebrow,
  title,
  close,
  action,
  submit,
  submitDisabled = false,
  cancelLabel = 'Cancelar',
  wide = true,
  children,
}: SimpleModalProps): JSX.Element {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  const titleId = useId();
  closeRef.current = close;

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return createPortal(
    <div
      className="simple-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className={`simple-modal${wide ? ' simple-modal--wide' : ''}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button type="button" className="simple-modal-close" onClick={close} aria-label="Cerrar">
          ×
        </button>
        {eyebrow && <span className="simple-modal-eyebrow">{eyebrow}</span>}
        <h2 id={titleId} className="simple-modal-title">{title}</h2>
        <div className="simple-modal-body">{children}</div>
        <footer className="simple-modal-actions">
          <button type="button" className="btn btn-outline" onClick={close}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={submitDisabled}>
            {action}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
