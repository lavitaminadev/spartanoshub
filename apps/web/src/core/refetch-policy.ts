/**
 * Cuándo puede una pantalla refrescarse sola sin estorbar.
 *
 * Varias pantallas vuelven a consultar cada minuto para no quedar desactualizadas. Eso está bien
 * mientras nadie las está usando, y es una molestia cuando sí: el refresco reordena listas y
 * vuelve a dibujar mientras alguien escribe, y lo que estaba a medio llenar se mueve debajo del
 * cursor o se pierde.
 *
 * La regla es simple: **no se refresca mientras la persona está escribiendo o con algo abierto.**
 * Nada se pierde por esperar; el refresco ocurre en cuanto suelta el teclado.
 */

/**
 * Intervalo efectivo para `refetchInterval`.
 *
 * **Devuelve una función, no un número.** TanStack Query evalúa `refetchInterval` en cada
 * vencimiento del temporizador cuando recibe una función, y una sola vez cuando recibe un
 * valor. Con un valor, la guardia solo miraba si había alguien escribiendo en el instante del
 * renderizado: quien empezaba a escribir después seguía recibiendo el refresco encima, que es
 * exactamente lo que esta política venía a evitar. Devolver la función traslada la decisión al
 * momento en que el refresco iría a ocurrir, que es el único que importa.
 *
 * @param baseMs - Cada cuánto refrescar cuando no hay nadie escribiendo.
 * @param blocked - Condición propia de la pantalla, como un modal abierto. Se lee en cada
 *   vencimiento, así que puede cambiar sin volver a montar la consulta.
 */
export function refetchWhenIdle(baseMs: number, blocked: boolean | (() => boolean) = false): () => number | false {
  return () => {
    const bloqueado = typeof blocked === 'function' ? blocked() : blocked;
    if (bloqueado || isEditing() || isInteracting()) return false;
    return baseMs;
  };
}

/**
 * Si hay una interacción en curso que un redibujado interrumpiría.
 *
 * Escribir no es lo único que se pierde con un refresco: arrastrar una tarjeta entre columnas,
 * tener un menú desplegado o una selección hecha también se deshacen si la lista se reordena
 * debajo. Se detecta por señales del documento y no por un registro propio para que una
 * pantalla nueva quede cubierta sin acordarse de avisar.
 */
export function isInteracting(): boolean {
  if (typeof document === 'undefined') return false;

  // dnd-kit marca el elemento arrastrado mientras dura el gesto. Refrescar en mitad de un
  // arrastre devuelve la tarjeta a su columna original y el movimiento se pierde.
  if (document.querySelector('[aria-pressed="true"], .kanban-card.is-dragging')) return true;

  // Un diálogo abierto casi siempre está mostrando algo a medio completar.
  if (document.querySelector('dialog[open], [role="dialog"]')) return true;

  // Texto seleccionado: alguien está leyendo o por copiar, y el redibujado lo deshace.
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return true;

  return false;
}

/**
 * Si hay una entrada de texto en uso.
 *
 * Se mira el elemento con el foco en vez de llevar un registro propio: cualquier pantalla queda
 * cubierta sin tener que acordarse de avisar, que es lo que se olvida al agregar un formulario
 * nuevo.
 *
 * Un `select` no cuenta: elegir una opción es instantáneo y no se pierde nada al refrescar.
 */
export function isEditing(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  if (active.isContentEditable) return true;
  const tag = active.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;

  // Los controles que no guardan texto —casillas, botones de opción— no corren riesgo de perder
  // nada, así que no bloquean el refresco.
  const type = (active as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
}
