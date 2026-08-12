/**
 * @fileoverview Aviso flotante simple, controlado por props, para los flujos nuevos que
 * siguen el patrón del prototipo (`{toast && <div className="toast">…}`). Se oculta solo
 * a los 2.5 s llamando a `onDismiss`, así el llamador no repite `window.setTimeout` en cada
 * acción que notifica algo.
 *
 * No sustituye a `shared/Toast.tsx` (`ToastContainer` + `triggerToast`), que es el sistema
 * de avisos global de la app —montado una vez en `Layout`, con cola de mensajes y tipos para
 * errores de API (conexión, permisos)—. Este componente es para una pantalla que quiere un
 * solo aviso local con la forma exacta del prototipo, sin depender del bus de eventos global.
 */

import { useEffect, useRef, type JSX } from 'react';
import './Toast.css';

/** Tono del aviso. */
export type ToastType = 'success' | 'warning' | 'error';

/**
 * Props del aviso flotante.
 */
export interface ToastProps {
  /** Texto del aviso. */
  message: string;
  /** Tono visual. Por defecto "success". */
  type?: ToastType;
  /** Se invoca cuando el aviso debe ocultarse (automático o por click en cerrar). */
  onDismiss?: () => void;
  /** Milisegundos antes de auto-ocultarse. Por defecto 2500. */
  duration?: number;
}

const ICON: Record<ToastType, string> = {
  success: '✓',
  warning: '!',
  error: '×',
};

/**
 * Aviso flotante fijo en la esquina inferior derecha. Se auto-oculta transcurrido `duration`
 * y también puede cerrarse manualmente.
 */
export function Toast({ message, type = 'success', onDismiss, duration = 2500 }: ToastProps): JSX.Element {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!onDismissRef.current) return undefined;
    const timer = window.setTimeout(() => onDismissRef.current?.(), duration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, type, duration]);

  return (
    <div className={`flow-toast flow-toast--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="flow-toast-icon" aria-hidden="true">{ICON[type]}</span>
      <span className="flow-toast-message">{message}</span>
      {onDismiss && (
        <button type="button" className="flow-toast-close" onClick={onDismiss} aria-label="Cerrar aviso">
          ×
        </button>
      )}
    </div>
  );
}
