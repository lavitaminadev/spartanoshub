import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento accesible de una ventana modal (WCAG 2.1.1, 2.4.3):
 *
 * - Escape cierra.
 * - El foco entra en la ventana, Tab y Mayús+Tab no salen de ella, y al cerrar vuelve al elemento
 *   que la abrió.
 * - La página de fondo no se desplaza mientras está abierta.
 *
 * @param contenedor Elemento de la ventana; el foco queda atrapado dentro.
 * @param onCerrar Se llama con Escape.
 */
export function useDialogo(contenedor: RefObject<HTMLElement | null>, onCerrar: () => void, activo = true): void {
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    if (!activo) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const nodo = contenedor.current;
    // Si nada pidió foco (autoFocus), entra al primer elemento enfocable.
    if (nodo && !nodo.contains(document.activeElement)) (nodo.querySelector<HTMLElement>(ENFOCABLES) ?? nodo).focus();

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') { evento.stopPropagation(); cerrar.current(); return; }
      if (evento.key !== 'Tab' || !contenedor.current) return;
      const elementos = Array.from(contenedor.current.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((el) => el.offsetParent !== null);
      if (!elementos.length) { evento.preventDefault(); return; }
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = desborde;
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [activo, contenedor]);
}

/**
 * Ventana modal que se cierra tocando en cualquier lugar fuera de lo que retiene el toque, con
 * Escape o con sus botones.
 *
 * Lo que no debe cerrarla al tocarse se marca con `data-retiene-toque` (el cuadro de contenido,
 * una foto). El toque cuenta sólo si empieza y termina fuera de eso: arrastrar o seleccionar texto
 * desde dentro hacia afuera no la cierra.
 */
export function DialogoModal({ etiqueta, onCerrar, className, children, activo = true }: { etiqueta: string; onCerrar: () => void; className: string; children: ReactNode; /** Falso mientras otra ventana queda encima. */ activo?: boolean }) {
  const fondo = useRef<HTMLDivElement>(null);
  const empezoEnFondo = useRef(false);
  useDialogo(fondo, onCerrar, activo);
  return <div
    ref={fondo}
    role="dialog"
    aria-modal="true"
    aria-label={etiqueta}
    className={className}
    tabIndex={-1}
    onPointerDown={(evento) => { empezoEnFondo.current = !(evento.target as Element).closest('[data-retiene-toque]'); }}
    onClick={(evento) => { if (activo && empezoEnFondo.current && !(evento.target as Element).closest('[data-retiene-toque]')) onCerrar(); empezoEnFondo.current = false; }}
  >{children}</div>;
}
