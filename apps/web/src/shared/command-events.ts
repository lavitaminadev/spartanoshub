/**
 * Apertura de la paleta de comandos desde fuera del propio componente.
 *
 * El nombre del evento vive acá y no como texto suelto en cada punto de emisión, para que quien
 * agregue un acceso nuevo no dependa de escribirlo igual.
 */
export const COMMAND_PALETTE_EVENT = 'espartanos:open-command';

/** Pide que se abra la paleta de comandos. */
export function openCommandPalette(): void {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}
