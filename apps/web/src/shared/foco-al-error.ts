/**
 * @fileoverview Llevar el foco al primer campo con error de un formulario.
 */

/** Controles que marcan su error con `aria-invalid` o viven dentro de un bloque `.has-error`. */
const SELECTOR_DE_ERROR = '[aria-invalid="true"], .has-error :is(input, select, textarea, button)';

/**
 * Enfoca el primer control con error, en el orden en que aparece en la página, y lo deja a la vista.
 *
 * Devuelve `false` si no hay ninguno, para que quien llama decida qué hacer. El campo enfocado ya
 * enlaza su mensaje con `aria-describedby`, así que el lector de pantalla lo dice al llegar.
 */
export function enfocarPrimerError(raiz: ParentNode | null): boolean {
  const campo = raiz?.querySelector<HTMLElement>(SELECTOR_DE_ERROR);
  if (!campo) return false;
  campo.focus({ preventScroll: true });
  campo.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  return true;
}
