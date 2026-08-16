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
 * Devuelve `false` —que TanStack Query entiende como «no refrescar»— cuando hay un formulario en
 * uso. En cuanto deja de haberlo, el intervalo vuelve solo, sin que la pantalla tenga que
 * suscribirse a nada.
 *
 * @param baseMs - Cada cuánto refrescar cuando no hay nadie escribiendo.
 * @param blocked - Condición propia de la pantalla, como un modal abierto.
 */
export function refetchWhenIdle(baseMs: number, blocked = false): number | false {
  if (blocked || isEditing()) return false;
  return baseMs;
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
